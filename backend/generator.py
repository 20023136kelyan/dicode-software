import os
import json
import sys
from datetime import datetime
from openai import OpenAI

# Add parent directory to path to import utils
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from utils.downloader import download_sora_video
from utils.resizer import resize_image


def load_api_key():
    """Load API key from config.json"""
    config_path = os.path.join(os.path.dirname(__file__), "config.json")
    if not os.path.exists(config_path):
        print(f"Config file not found at {config_path}")
        return None
    
    with open(config_path, "r") as f:
        config = json.load(f)
        api_key = config.get("openai_api_key")
        if api_key:
            print(f"API key loaded successfully (length: {len(api_key)})")
        else:
            print("API key not found in config.json")
        return api_key


def build_prompt(shot_data):
    """
    Build a comprehensive Sora prompt from user inputs.
    
    Args:
        shot_data: Dictionary containing shot configuration
            - characters: str
            - environment: str
            - lighting: str
            - camera_angles: str
            - dialog: str
    
    Returns:
        str: Complete Sora prompt
    """
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
    
    return ". ".join(prompt_parts)


def generate_video_sequence(shots_data, reference_images=None):
    """
    Generate a video sequence with 1-3 shots using Sora API.
    
    Args:
        shots_data: List of shot configurations
        reference_images: List of uploaded image file paths
    
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
            prompt = build_prompt(shot_data)
            
            print(f"Generating Shot {i} with prompt: {prompt[:100]}...")
            
            # Check if we have a reference image for this shot
            reference_image = None
            if reference_images and i <= len(reference_images):
                reference_image = reference_images[i - 1]  # i-1 because shots are 1-indexed
            
            # Build video creation parameters
            # Note: Using sora-2-pro for higher quality/resolution options
            video_params = {
                "model": "sora-2-pro",
                "prompt": prompt,
                "size": "1024x1792",  # Vertical high-res (sora-2-pro only)
                "seconds": "12",  # Maximum available: 4, 8, or 12 seconds
            }
            
            # Add reference image if available
            if reference_image and os.path.exists(reference_image):
                # Resize the image to match video dimensions (1024x1792)
                # Note: resize_image returns the path, which may change (e.g., .png -> .jpg)
                print(f"Resizing reference image to 1024x1792: {reference_image}")
                resized_image_path = resize_image(reference_image, target_size=(1024, 1792))
                
                # Read the image file and pass it to the API
                from pathlib import Path
                video_params["input_reference"] = Path(resized_image_path)
                print(f"Using reference image: {resized_image_path}")
            
            # For the first shot, create a new video
            if i == 1:
                video = openai_client.videos.create(**video_params)
                previous_video = video
            else:
                # For subsequent shots, remix from the immediately previous shot
                # This creates a sequential sequence where each shot continues from the last
                # Note: remix doesn't support input_reference, so we only use image for the first shot
                remix_params = {
                    "video_id": previous_video.id,
                    "prompt": prompt,
                }
                video = openai_client.videos.remix(**remix_params)
                previous_video = video
            
            # Download and save the video
            downloaded_video = download_sora_video(video, output_dir, f"shot_{i}")
            
            results["shots"].append({
                "shot_number": i,
                "video_id": downloaded_video.id,
                "file_path": os.path.join(output_dir, f"shot_{i}.mp4"),
                "status": "completed"
            })
        
        results["status"] = "completed"
        
    except Exception as e:
        results["status"] = "error"
        results["error"] = str(e)
        print(f"Generation error: {e}")
    
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

