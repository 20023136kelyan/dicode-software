import os
import json
import sys
from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from generator import generate_video_sequence, check_video_status, load_api_key
from stitcher import stitch_videos

app = Flask(__name__)
CORS(app)

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


@app.route('/api/check-key', methods=['GET'])
def check_key():
    """Check if API key is configured"""
    api_key = load_api_key()
    return jsonify({
        "configured": api_key is not None,
        "has_value": bool(api_key and api_key != "your-api-key-here")
    })


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


@app.route('/api/generate', methods=['POST'])
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
            
            # Handle uploaded images - map each shot to its reference image
            reference_images = [None] * len(shots_data)  # Initialize with None
            for i in range(1, len(shots_data) + 1):
                img_key = f'image_{i}'
                if img_key in request.files:
                    file = request.files[img_key]
                    if file.filename:
                        # Save temporarily
                        import hashlib
                        from werkzeug.utils import secure_filename
                        
                        filename = secure_filename(file.filename)
                        img_hash = hashlib.md5(filename.encode()).hexdigest()
                        img_path = os.path.join(BASE_DIR, "temp", f"{img_hash}_{filename}")
                        
                        os.makedirs(os.path.dirname(img_path), exist_ok=True)
                        file.save(img_path)
                        reference_images[i - 1] = img_path  # Map to shot index
        else:
            # Handle JSON
            data = request.json
            shots_data = data.get("shots", [])
            reference_images = None
        
        if not shots_data:
            return jsonify({"error": "No shots provided"}), 400
        
        if len(shots_data) > 3:
            return jsonify({"error": "Maximum 3 shots allowed"}), 400
        
        # Generate videos
        result = generate_video_sequence(shots_data, reference_images or [])
        
        # Clean up temporary images (including .jpg versions if converted)
        if reference_images:
            for img_path in reference_images:
                if os.path.exists(img_path):
                    try:
                        os.remove(img_path)
                    except:
                        pass
                # Also try to remove the .jpg version if it was created
                jpeg_path = os.path.splitext(img_path)[0] + '.jpg'
                if os.path.exists(jpeg_path):
                    try:
                        os.remove(jpeg_path)
                    except:
                        pass
        
        if result.get("status") == "error":
            return jsonify(result), 500
        
        return jsonify(result)
    
    except Exception as e:
        return jsonify({"error": str(e), "status": "error"}), 500


@app.route('/api/stitch/<sequence_id>', methods=['POST'])
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
def download_shot(sequence_id, shot_number):
    """Download individual shot"""
    shot_path = os.path.join(OUTPUT_DIR, sequence_id, f"shot_{shot_number}.mp4")
    
    if not os.path.exists(shot_path):
        return jsonify({"error": "Shot not found"}), 404
    
    return send_file(shot_path, as_attachment=True)


@app.route('/api/download-sequence/<sequence_id>', methods=['GET'])
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
    
    app.run(debug=True, host='0.0.0.0', port=8080)

