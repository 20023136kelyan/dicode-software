import os
import json
import sys
import re
from datetime import datetime
from openai import OpenAI

# Add parent directory to path to import utils
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils.downloader import download_sora_video
from utils.resizer import resize_image


def parse_openai_error(error_str):
    """
    Parse OpenAI error message to extract user-friendly error text.
    
    Args:
        error_str: Error string from OpenAI API
    
    Returns:
        str: User-friendly error message
    """
    # Check for billing errors
    if 'billing' in error_str.lower() or 'Billing hard limit' in error_str:
        return 'OpenAI Billing Error: Your OpenAI account has reached its billing limit. Please add payment method or increase limits at https://platform.openai.com/account/billing'
    
    # Check for API key errors
    if 'invalid_api_key' in error_str.lower() or 'incorrect api key' in error_str.lower():
        return 'Invalid API Key: Please check your API key in backend/config.json'
    
    # Try to extract error message from JSON if present
    try:
        # Look for JSON-like structure in the error
        json_match = re.search(r'\{.*\}', error_str)
        if json_match:
            error_dict = json.loads(json_match.group())
            if isinstance(error_dict, dict):
                error_info = error_dict.get('error', {})
                if isinstance(error_info, dict):
                    return error_info.get('message', error_str)
    except:
        pass
    
    # Return original error if we can't parse it
    return error_str


def load_api_key():
    """Load API key from environment variable or config.json"""
    # First, try to load from environment variable (for Railway, Cloud Run, etc.)
    api_key = os.environ.get('OPENAI_API_KEY')
    if api_key:
        print(f"API key loaded from environment variable (length: {len(api_key)})")
        return api_key

    # Fall back to config.json for local development
    config_path = os.path.join(os.path.dirname(__file__), "config.json")
    if not os.path.exists(config_path):
        print(f"Config file not found at {config_path} and no OPENAI_API_KEY environment variable")
        return None

    with open(config_path, "r") as f:
        config = json.load(f)
        api_key = config.get("openai_api_key")
        if api_key:
            print(f"API key loaded from config.json (length: {len(api_key)})")
        else:
            print("API key not found in config.json")
        return api_key


def build_prompt(shot_data, shot_number=1, shots_data=None):
    """
    Build a comprehensive Sora prompt from user inputs.
    
    Args:
        shot_data: Dictionary containing shot configuration
            - characters: str
            - environment: str
            - lighting: str
            - camera_angles: str
            - dialog: str
        shot_number: The shot number (1, 2, or 3)
        shots_data: List of all shot data (used to get shot 1's data as fallback for shots 2 and 3)
    
    Returns:
        str: Complete Sora prompt
    """
    # For Remix shots (2 and 3), use explicit consistency instructions
    if shot_number > 1:
        # Remix prompt: maintain everything, only change dialog
        prompt_parts = []
        
        # Get character - use shot_data if provided, otherwise fall back to shot 1's character
        characters = shot_data.get("characters", "").strip()
        if not characters and shots_data and len(shots_data) > 0:
            characters = shots_data[0].get("characters", "").strip()
        
        if characters:
            prompt_parts.append(f"The same {characters}")
        
        # Get environment - use shot_data if provided, otherwise fall back to shot 1's environment
        environment = shot_data.get("environment", "").strip()
        if not environment and shots_data and len(shots_data) > 0:
            environment = shots_data[0].get("environment", "").strip()
        
        if environment:
            prompt_parts.append(f"in the same {environment}")
        
        # Get lighting - use shot_data if provided, otherwise fall back to shot 1's lighting
        lighting = shot_data.get("lighting", "").strip()
        if not lighting and shots_data and len(shots_data) > 0:
            lighting = shots_data[0].get("lighting", "").strip()
        
        if lighting:
            prompt_parts.append(f"{lighting}")
        
        # Get camera angles - use shot_data if provided, otherwise fall back to shot 1's camera_angles
        camera_angles = shot_data.get("camera_angles", "").strip()
        if not camera_angles and shots_data and len(shots_data) > 0:
            camera_angles = shots_data[0].get("camera_angles", "").strip()
        
        if camera_angles:
            prompt_parts.append(f"{camera_angles}")
        
        # Voice/mic consistency: prefer explicit voice spec if provided, else match previous shot
        voice_spec = shot_data.get("voice", "").strip()
        if not voice_spec and shots_data and len(shots_data) > 0:
            voice_spec = (shots_data[0].get("voice", "") or "").strip()
        if voice_spec:
            prompt_parts.append(
                f"Use the same speaking voice: {voice_spec}. Maintain identical microphone tone and recording chain."
            )
        else:
            prompt_parts.append(
                "Use the exact same speaking voice, accent, delivery, and microphone tone as the previous shot."
            )
        
        # Add explicit maintenance instructions for visuals and performance
        prompt_parts.append("maintaining exact same appearance, clothing, tone, and speaking style from previous shot")
        
        # Change only dialog and maintain background audio
        if shot_data.get("dialog"):
            prompt_parts.append(f"Maintain background audio and ambient sounds. Change only the dialog to: '{shot_data['dialog']}'")
        
        return ". ".join(prompt_parts)
    
    # For Shot 1, build normal prompt
    prompt_parts = []
    
    # Add character description
    if shot_data.get("characters"):
        prompt_parts.append(f"{shot_data['characters']}")
    
    # Add environment
    if shot_data.get("environment"):
        prompt_parts.append(f"in {shot_data['environment']}")
    
    # Add lighting
    if shot_data.get("lighting"):
        prompt_parts.append(f"{shot_data['lighting']}")
    
    # Add camera angles
    if shot_data.get("camera_angles"):
        prompt_parts.append(f"{shot_data['camera_angles']}")
    
    # Add dialog
    if shot_data.get("dialog"):
        prompt_parts.append(f"'{shot_data['dialog']}'")
    
    # Optional: seed an explicit voice spec for shot 1 if provided to stabilize across sequence
    voice_spec = (shot_data.get("voice", "") or "").strip()
    if voice_spec:
        prompt_parts.append(
            f"Speaking voice: {voice_spec}. Microphone tone and recording chain should be consistent across shots."
        )
    
    return ". ".join(prompt_parts)


def generate_video_sequence(shots_data, reference_images=None, progress_queue=None, task_id=None, quality='720x1280', model='sora-2-pro'):
    """
    Generate a video sequence with 1-3 shots using Sora API.
    
    Args:
        shots_data: List of shot configurations
        reference_images: List of uploaded image file paths
        progress_queue: Queue to send progress updates
        task_id: Task ID for tracking
        quality: Video quality/resolution (default: '720x1280')
        model: Sora model to use - 'sora-2' or 'sora-2-pro' (default: 'sora-2-pro')
    
    Returns:
        dict: Generation results with status and video paths
    """
    api_key = load_api_key()
    if not api_key or not api_key.strip():
        return {
            "error": "API key not configured or is empty",
            "status": "error"
        }
    
    # Try both environment variable and direct parameter
    if not os.environ.get("OPENAI_API_KEY"):
        os.environ["OPENAI_API_KEY"] = api_key
    
    openai_client = OpenAI(api_key=api_key.strip())
    
    # Create unique sequence folder
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = os.path.join(os.path.dirname(__file__), "output", f"sequence_{timestamp}")
    os.makedirs(output_dir, exist_ok=True)
    
    results = {
        "sequence_id": f"sequence_{timestamp}",
        "output_dir": output_dir,
        "shots": [],
        "status": "in_progress"
    }
    
    try:
        previous_video = None
        
        for i, shot_data in enumerate(shots_data, 1):
            prompt = build_prompt(shot_data, shot_number=i, shots_data=shots_data)
            
            print(f"Generating Shot {i} with prompt: {prompt[:100]}...")
            
            # Send progress update for starting shot generation
            if progress_queue:
                progress_queue.put({
                    'type': 'shot_start',
                    'shot_number': i,
                    'total_shots': len(shots_data),
                    'message': f'Starting generation of Shot {i}...'
                })
            
            # Build video creation parameters
            # Use user-selected model (sora-2 or sora-2-pro)
            video_params = {
                "model": model,
                "prompt": prompt,
                "size": quality,  # Dynamic quality based on user selection
                "seconds": "12",  # Maximum available: 4, 8, or 12 seconds
            }
            
            print(f"Shot {i}: Using model: {model}, quality/resolution: {quality}")
            
            # For the first shot, create a new video with optional reference image
            if i == 1:
                # Only shot 1 can use reference images (remix shots 2 and 3 don't support input_reference)
                reference_image = None
                if reference_images and len(reference_images) > 0:
                    reference_image = reference_images[0]  # Shot 1 is at index 0
                
                # Add reference image if available for shot 1
                if reference_image and os.path.exists(reference_image):
                    # Parse quality string to get width and height
                    width, height = map(int, quality.split('x'))
                    # Resize the image to match video dimensions
                    # Note: resize_image returns the path, which may change (e.g., .png -> .jpg)
                    print(f"Resizing reference image to {quality}: {reference_image}")
                    resized_image_path = resize_image(reference_image, target_size=(width, height))
                    
                    # Read the image file and pass it to the API
                    from pathlib import Path
                    video_params["input_reference"] = Path(resized_image_path)
                    print(f"Using reference image: {resized_image_path}")
                video = openai_client.videos.create(**video_params)
                previous_video = video
            else:
                # For subsequent shots, remix from the immediately previous shot
                # This creates a sequential sequence where each shot continues from the last
                # Note: remix doesn't support input_reference, so we only use image for the first shot
                # Remix videos automatically inherit the quality/resolution from the source video
                print(f"Shot {i}: Remixing from Shot {i-1} (quality: {quality} - inherited from source video)")
                remix_params = {
                    "video_id": previous_video.id,
                    "prompt": prompt,
                }
                video = openai_client.videos.remix(**remix_params)
                previous_video = video
            
            # Create progress callback for this shot
            def progress_callback(progress, status):
                if progress_queue:
                    progress_queue.put({
                        'type': 'progress',
                        'shot_number': i,
                        'total_shots': len(shots_data),
                        'progress': progress,
                        'status': status,
                        'message': f'Shot {i}: {status}... {progress:.1f}%'
                    })
            
            # Download and save the video
            downloaded_video = download_sora_video(
                video, 
                output_dir, 
                f"shot_{i}",
                progress_callback=progress_callback
            )
            
            # Send progress update for completed shot
            if progress_queue:
                progress_queue.put({
                    'type': 'shot_complete',
                    'shot_number': i,
                    'total_shots': len(shots_data),
                    'message': f'Shot {i} completed!'
                })
            
            results["shots"].append({
                "shot_number": i,
                "video_id": downloaded_video.id,
                "file_path": os.path.join(output_dir, f"shot_{i}.mp4"),
                "status": "completed"
            })
        
        results["status"] = "completed"
        
    except Exception as e:
        results["status"] = "error"
        error_str = str(e)
        results["error"] = error_str
        print(f"Generation error: {e}")
        
        # Try to extract the actual error message from OpenAI's error response
        error_message = parse_openai_error(error_str)
        
        # Send error to progress queue if it exists
        if progress_queue:
            progress_queue.put({
                'type': 'error',
                'message': error_message,
                'full_error': error_str
            })
    
    return results


def check_video_status(video_id):
    """Check the status of a video generation"""
    api_key = load_api_key()
    if not api_key or not api_key.strip():
        return {"status": "error", "error": "API key not configured or is empty"}
    
    # Try both environment variable and direct parameter
    if not os.environ.get("OPENAI_API_KEY"):
        os.environ["OPENAI_API_KEY"] = api_key
    
    openai_client = OpenAI(api_key=api_key.strip())
    
    try:
        video = openai_client.videos.retrieve(video_id)
        return {
            "status": video.status,
            "progress": getattr(video, "progress", 0)
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}


def remix_existing_video(video_id, shot_data, progress_queue=None):
    """Remix an existing Sora video by id with a new prompt built from provided fields.

    Args:
        video_id: The source Sora video id to remix
        shot_data: Dict with optional keys characters, environment, lighting, camera_angles, dialog, voice
        progress_queue: Optional queue to stream progress updates

    Returns:
        dict containing status, output_dir, sequence_id, and single-shot results
    """
    api_key = load_api_key()
    if not api_key or not api_key.strip():
        return {
            "error": "API key not configured or is empty",
            "status": "error"
        }

    if not os.environ.get("OPENAI_API_KEY"):
        os.environ["OPENAI_API_KEY"] = api_key

    openai_client = OpenAI(api_key=api_key.strip())

    # Create unique output folder
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = os.path.join(os.path.dirname(__file__), "output", f"sequence_{timestamp}")
    os.makedirs(output_dir, exist_ok=True)

    results = {
        "sequence_id": f"sequence_{timestamp}",
        "output_dir": output_dir,
        "shots": [],
        "status": "in_progress"
    }

    try:
        # Build a remix prompt. We reuse build_prompt with shot_number=2 so it uses remix-style constraints
        prompt = build_prompt(shot_data or {}, shot_number=2, shots_data=[shot_data or {}])

        if progress_queue:
            progress_queue.put({
                'type': 'shot_start',
                'shot_number': 1,
                'total_shots': 1,
                'message': 'Starting remix...'
            })

        remix_params = {
            "video_id": video_id,
            "prompt": prompt,
        }

        video = openai_client.videos.remix(**remix_params)

        def progress_callback(progress, status):
            if progress_queue:
                progress_queue.put({
                    'type': 'progress',
                    'shot_number': 1,
                    'total_shots': 1,
                    'progress': progress,
                    'status': status,
                    'message': f'Remix: {status}... {progress:.1f}%'
                })

        downloaded_video = download_sora_video(
            video,
            output_dir,
            "shot_1",
            progress_callback=progress_callback
        )

        if progress_queue:
            progress_queue.put({
                'type': 'shot_complete',
                'shot_number': 1,
                'total_shots': 1,
                'message': 'Remix completed!'
            })

        results["shots"].append({
            "shot_number": 1,
            "video_id": downloaded_video.id,
            "file_path": os.path.join(output_dir, "shot_1.mp4"),
            "status": "completed"
        })

        results["status"] = "completed"
    except Exception as e:
        results["status"] = "error"
        error_str = str(e)
        results["error"] = error_str
        error_message = parse_openai_error(error_str)
        if progress_queue:
            progress_queue.put({
                'type': 'error',
                'message': error_message,
                'full_error': error_str
            })

    return results


def remix_video_sequence(video_id, shots_data, progress_queue=None):
    """Remix up to 3 shots starting from a single source video id.

    The first remix uses the provided video_id. Each subsequent shot remixes from
    the immediately previous remix result to maintain visual and audio consistency.
    """
    api_key = load_api_key()
    if not api_key or not api_key.strip():
        return {
            "error": "API key not configured or is empty",
            "status": "error"
        }

    if not os.environ.get("OPENAI_API_KEY"):
        os.environ["OPENAI_API_KEY"] = api_key

    openai_client = OpenAI(api_key=api_key.strip())

    # Create unique output folder
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = os.path.join(os.path.dirname(__file__), "output", f"sequence_{timestamp}")
    os.makedirs(output_dir, exist_ok=True)

    results = {
        "sequence_id": f"sequence_{timestamp}",
        "output_dir": output_dir,
        "shots": [],
        "status": "in_progress"
    }

    try:
        previous_video_id = video_id

        for i, shot_data in enumerate(shots_data, 1):
            # Use remix-style prompt rules (like shot_number > 1 in build_prompt)
            prompt = build_prompt(shot_data or {}, shot_number=2, shots_data=[shot_data or {}])

            if progress_queue:
                progress_queue.put({
                    'type': 'shot_start',
                    'shot_number': i,
                    'total_shots': len(shots_data),
                    'message': f'Starting remix of Shot {i}...'
                })

            remix_params = {
                "video_id": previous_video_id,
                "prompt": prompt,
            }

            video = openai_client.videos.remix(**remix_params)

            def progress_callback(progress, status):
                if progress_queue:
                    progress_queue.put({
                        'type': 'progress',
                        'shot_number': i,
                        'total_shots': len(shots_data),
                        'progress': progress,
                        'status': status,
                        'message': f'Shot {i}: {status}... {progress:.1f}%'
                    })

            downloaded_video = download_sora_video(
                video,
                output_dir,
                f"shot_{i}",
                progress_callback=progress_callback
            )

            if progress_queue:
                progress_queue.put({
                    'type': 'shot_complete',
                    'shot_number': i,
                    'total_shots': len(shots_data),
                    'message': f'Shot {i} completed!'
                })

            results["shots"].append({
                "shot_number": i,
                "video_id": downloaded_video.id,
                "file_path": os.path.join(output_dir, f"shot_{i}.mp4"),
                "status": "completed"
            })

            # Next shot remixes from this new result
            previous_video_id = downloaded_video.id

        results["status"] = "completed"
    except Exception as e:
        results["status"] = "error"
        error_str = str(e)
        results["error"] = error_str
        error_message = parse_openai_error(error_str)
        if progress_queue:
            progress_queue.put({
                'type': 'error',
                'message': error_message,
                'full_error': error_str
            })

    return results

