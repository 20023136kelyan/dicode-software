import os
import json
import sys
from flask import Flask, request, jsonify, send_file, send_from_directory, Response, stream_with_context
from flask_cors import CORS
import queue
import threading
import uuid
from dotenv import load_dotenv

# Load environment variables from .env file
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
load_dotenv(env_path)

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from generator import generate_video_sequence, check_video_status, load_api_key, remix_existing_video, remix_video_sequence
from stitcher import stitch_videos
from auth_middleware import initialize_firebase_admin, require_auth, optional_auth

app = Flask(__name__)

# Configure CORS - Allow all origins since we're handling auth with Firebase tokens
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": False
    }
})

# Initialize Firebase Admin SDK
initialize_firebase_admin()

# Dictionary to store progress queues for each generation task
progress_queues = {}
# Dictionary to store results for each generation task
generation_results = {}

# Configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(BASE_DIR, "output")
FRONTEND_DIR = os.path.join(os.path.dirname(BASE_DIR), "frontend")


@app.route('/')
def index():
    """Serve the frontend index page"""
    return send_from_directory(FRONTEND_DIR, 'index.html')


@app.route('/styles.css')
def serve_css():
    """Serve CSS file"""
    return send_from_directory(FRONTEND_DIR, 'styles.css')


@app.route('/app.js')
def serve_js():
    """Serve JavaScript file"""
    return send_from_directory(FRONTEND_DIR, 'app.js')


@app.route('/firebase-init.js')
def serve_firebase_init():
    """Serve Firebase initialization script"""
    return send_from_directory(FRONTEND_DIR, 'firebase-init.js')


@app.route('/api/check-key', methods=['GET'])
@optional_auth
def check_key():
    """Check if API key is configured"""
    api_key = load_api_key()
    return jsonify({
        "configured": api_key is not None,
        "has_value": bool(api_key and api_key != "your-api-key-here")
    })


@app.route('/api/firebase-config', methods=['GET'])
def get_firebase_config():
    """Get Firebase configuration from environment variables"""
    config = {
        "apiKey": os.getenv('FIREBASE_API_KEY'),
        "authDomain": os.getenv('FIREBASE_AUTH_DOMAIN'),
        "projectId": os.getenv('FIREBASE_PROJECT_ID'),
        "storageBucket": os.getenv('FIREBASE_STORAGE_BUCKET'),
        "messagingSenderId": os.getenv('FIREBASE_MESSAGING_SENDER_ID'),
        "appId": os.getenv('FIREBASE_APP_ID')
    }
    
    # Check if all required fields are present
    missing_fields = [key for key, value in config.items() if not value]
    
    if missing_fields:
        return jsonify({
            "error": "Firebase configuration incomplete",
            "missing_fields": missing_fields
        }), 400
    
    return jsonify(config)


@app.route('/api/set-key', methods=['POST'])
def set_key():
    """Update API key in config"""
    data = request.json
    api_key = data.get("api_key")
    
    if not api_key:
        return jsonify({"error": "API key is required"}), 400
    
    config_path = os.path.join(BASE_DIR, "config.json")
    config = {"openai_api_key": api_key}
    
    with open(config_path, "w") as f:
        json.dump(config, f, indent=4)
    
    return jsonify({"success": True, "message": "API key updated. Please restart the server."})


@app.route('/api/progress/<task_id>', methods=['GET'])
def stream_progress(task_id):
    """Stream progress updates via Server-Sent Events"""
    def generate():
        if task_id not in progress_queues:
            yield f"data: {json.dumps({'error': 'Task not found'})}\n\n"
            return
        
        q = progress_queues[task_id]
        
        while True:
            try:
                message = q.get(timeout=1)
                if message is None:  # End of stream
                    break
                yield f"data: {json.dumps(message)}\n\n"
            except queue.Empty:
                yield ": keepalive\n\n"  # Keep connection alive
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
                break
        
        # Clean up
        del progress_queues[task_id]
    
    return Response(stream_with_context(generate()), mimetype='text/event-stream')


def run_generation_in_thread(shots_data, reference_images, task_id, result_container, q, quality='720x1280', model='sora-2-pro'):
    """Run video generation in a separate thread"""
    try:
        result = generate_video_sequence(shots_data, reference_images or [], progress_queue=q, task_id=task_id, quality=quality, model=model)
        
        # Clean up temporary images (including .jpg versions if converted)
        if reference_images:
            for img_path in reference_images:
                if img_path and os.path.exists(img_path):
                    try:
                        os.remove(img_path)
                    except:
                        pass
                # Also try to remove the .jpg version if it was created
                if img_path:
                    jpeg_path = os.path.splitext(img_path)[0] + '.jpg'
                    if os.path.exists(jpeg_path):
                        try:
                            os.remove(jpeg_path)
                        except:
                            pass
        
        result_container['result'] = result
        generation_results[task_id] = result
        
        # Send final result message
        q.put({'type': 'complete', 'result': result})
    except Exception as e:
        error_msg = str(e)
        result_container['error'] = error_msg
        q.put({'type': 'error', 'message': error_msg})
        generation_results[task_id] = {'status': 'error', 'error': error_msg}
    finally:
        q.put(None)  # Signal end of stream


def run_remix_in_thread(video_id, shot_data, task_id, result_container, q):
    """Run remix in a separate thread"""
    try:
        result = remix_existing_video(video_id, shot_data, progress_queue=q)
        result_container['result'] = result
        generation_results[task_id] = result
        q.put({'type': 'complete', 'result': result})
    except Exception as e:
        error_msg = str(e)
        result_container['error'] = error_msg
        q.put({'type': 'error', 'message': error_msg})
        generation_results[task_id] = {'status': 'error', 'error': error_msg}
    finally:
        q.put(None)

@app.route('/api/generate', methods=['POST'])
@require_auth
def generate():
    """Generate video sequence"""
    try:
        # Check if multipart/form-data or JSON
        if request.content_type and 'multipart/form-data' in request.content_type:
            # Handle with file uploads
            shots_json = request.form.get('shots')
            if not shots_json:
                return jsonify({"error": "No shots provided"}), 400
            
            shots_data = json.loads(shots_json)
            quality = request.form.get('quality', '720x1280')
            model = request.form.get('model', 'sora-2-pro')
            print(f"Received quality selection: {quality}")
            print(f"Received model selection: {model}")
            
            # Handle uploaded images - only shot 1 uses reference images (remix shots 2 and 3 don't)
            reference_images = [None] * len(shots_data)  # Initialize with None
            # Only process image_1 (shots 2 and 3 are remix and don't support reference images)
            if 'image_1' in request.files:
                file = request.files['image_1']
                if file.filename:
                    # Save temporarily
                    import hashlib
                    from werkzeug.utils import secure_filename
                    
                    filename = secure_filename(file.filename)
                    img_hash = hashlib.md5(filename.encode()).hexdigest()
                    img_path = os.path.join(BASE_DIR, "temp", f"{img_hash}_{filename}")
                    
                    os.makedirs(os.path.dirname(img_path), exist_ok=True)
                    file.save(img_path)
                    reference_images[0] = img_path  # Only shot 1 (index 0) gets the image
        else:
            # Handle JSON
            data = request.json
            shots_data = data.get("shots", [])
            quality = data.get("quality", "720x1280")
            model = data.get("model", "sora-2-pro")
            print(f"Received quality selection: {quality}")
            print(f"Received model selection: {model}")
            reference_images = None
        
        if not shots_data:
            return jsonify({"error": "No shots provided"}), 400
        
        if len(shots_data) > 3:
            return jsonify({"error": "Maximum 3 shots allowed"}), 400
        
        # Create a unique task ID and progress queue
        task_id = str(uuid.uuid4())
        q = queue.Queue()
        progress_queues[task_id] = q
        
        # Store reference images in a way that the thread can access them
        # We'll pass them to the thread, and let it clean them up
        result_container = {}
        
        # Start generation in a separate thread
        thread = threading.Thread(
            target=run_generation_in_thread,
            args=(shots_data, reference_images or [], task_id, result_container, q, quality, model)
        )
        thread.daemon = True
        thread.start()
        
        # Return task ID immediately so frontend can start listening
        return jsonify({
            "task_id": task_id,
            "status": "started",
            "progress_url": f"/api/progress/{task_id}"
        })
    
    except Exception as e:
        return jsonify({"error": str(e), "status": "error"}), 500


@app.route('/api/generate-result/<task_id>', methods=['GET'])
def get_result(task_id):
    """Get the final result of a generation task"""
    if task_id not in generation_results:
        return jsonify({"status": "not_found", "message": "Result not found"}), 404
    
    result = generation_results[task_id]
    return jsonify(result)


@app.route('/api/remix', methods=['POST'])
@require_auth
def remix():
    """Remix an existing video by id with new dialog and optional fields"""
    try:
        data = request.json
        if not data:
            return jsonify({"error": "Invalid JSON"}), 400
        video_id = data.get('video_id')
        if not video_id:
            return jsonify({"error": "video_id is required"}), 400

        # Branch: multi-shot via 'shots' or single-shot via top-level fields
        shots = data.get('shots')

        # Create task + progress queue
        task_id = str(uuid.uuid4())
        q = queue.Queue()
        progress_queues[task_id] = q
        result_container = {}

        if isinstance(shots, list) and 1 <= len(shots) <= 3:
            # Normalize and validate each shot
            normalized = []
            for s in shots:
                s = s or {}
                sd = {
                    'characters': s.get('characters', '') or '',
                    'environment': s.get('environment', '') or '',
                    'lighting': s.get('lighting', '') or '',
                    'camera_angles': s.get('camera_angles', '') or '',
                    'dialog': s.get('dialog', '') or '',
                }
                if not sd['dialog']:
                    return jsonify({"error": "Each shot requires dialog"}), 400
                normalized.append(sd)

            def run_multi():
                try:
                    result = remix_video_sequence(video_id, normalized, progress_queue=q)
                    result_container['result'] = result
                    generation_results[task_id] = result
                    q.put({'type': 'complete', 'result': result})
                except Exception as e:
                    error_msg = str(e)
                    result_container['error'] = error_msg
                    q.put({'type': 'error', 'message': error_msg})
                    generation_results[task_id] = {'status': 'error', 'error': error_msg}
                finally:
                    q.put(None)

            thread = threading.Thread(target=run_multi)
        else:
            # Single-shot
            shot_data = {
                'characters': data.get('characters', '') or '',
                'environment': data.get('environment', '') or '',
                'lighting': data.get('lighting', '') or '',
                'camera_angles': data.get('camera_angles', '') or '',
                'dialog': data.get('dialog', '') or ''
            }
            if not shot_data['dialog']:
                return jsonify({"error": "dialog is required"}), 400

            thread = threading.Thread(
                target=run_remix_in_thread,
                args=(video_id, shot_data, task_id, result_container, q)
            )
        thread.daemon = True
        thread.start()

        return jsonify({
            "task_id": task_id,
            "status": "started",
            "progress_url": f"/api/progress/{task_id}"
        })
    except Exception as e:
        return jsonify({"error": str(e), "status": "error"}), 500


@app.route('/api/stitch/<sequence_id>', methods=['POST'])
@require_auth
def stitch(sequence_id):
    """Stitch multiple shots into a single video"""
    try:
        sequence_dir = os.path.join(OUTPUT_DIR, sequence_id)
        
        if not os.path.exists(sequence_dir):
            print(f"ERROR: Sequence directory not found: {sequence_dir}")
            return jsonify({"error": f"Sequence not found: {sequence_id}"}), 404
        
        # Find all shot videos
        shot_files = []
        for i in range(1, 4):
            shot_path = os.path.join(sequence_dir, f"shot_{i}.mp4")
            if os.path.exists(shot_path):
                shot_files.append(shot_path)
                print(f"Found shot file: {shot_path}")
            else:
                print(f"Shot file not found: {shot_path}")
        
        if not shot_files:
            print(f"ERROR: No videos to stitch in {sequence_dir}")
            return jsonify({"error": "No videos to stitch"}), 400
        
        print(f"Stitching {len(shot_files)} videos...")
        
        # Stitch the videos
        output_path = os.path.join(sequence_dir, "stitched_sequence.mp4")
        stitch_videos(shot_files, output_path)
        
        print(f"Successfully stitched video to: {output_path}")
        
        return jsonify({
            "success": True,
            "output_path": output_path,
            "download_url": f"/api/download-sequence/{sequence_id}"
        })
    
    except Exception as e:
        print(f"ERROR during stitching: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/download/<sequence_id>/<shot_number>', methods=['GET'])
@require_auth
def download_shot(sequence_id, shot_number):
    """Download individual shot"""
    shot_path = os.path.join(OUTPUT_DIR, sequence_id, f"shot_{shot_number}.mp4")
    
    if not os.path.exists(shot_path):
        return jsonify({"error": "Shot not found"}), 404
    
    return send_file(shot_path, as_attachment=True)


@app.route('/api/download-sequence/<sequence_id>', methods=['GET'])
@require_auth
def download_sequence(sequence_id):
    """Download stitched sequence"""
    stitched_path = os.path.join(OUTPUT_DIR, sequence_id, "stitched_sequence.mp4")
    
    if not os.path.exists(stitched_path):
        return jsonify({"error": "Stitched video not found"}), 404
    
    return send_file(stitched_path, as_attachment=True)


@app.route('/api/status/<video_id>', methods=['GET'])
def status(video_id):
    """Check video generation status"""
    result = check_video_status(video_id)
    return jsonify(result)


if __name__ == '__main__':
    # Create temp directory for uploaded images
    temp_dir = os.path.join(BASE_DIR, "temp")
    os.makedirs(temp_dir, exist_ok=True)
    
    # Get port from environment variable (for Cloud Run) or use default
    port = int(os.environ.get('PORT', 8080))
    app.run(debug=True, host='0.0.0.0', port=port)

