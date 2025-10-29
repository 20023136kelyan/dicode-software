import os
from moviepy import VideoFileClip, concatenate_videoclips, CompositeVideoClip


def stitch_videos(video_paths, output_path):
    """
    Stitch multiple video files together into a single sequence.
    
    This function ensures all videos are resized to a consistent size
    before stitching to prevent cropping issues.
    
    Args:
        video_paths: List of paths to video files
        output_path: Path where stitched video will be saved
    
    Returns:
        str: Path to the stitched video
    """
    # Target dimensions (1024x1792 for high-res vertical video)
    target_size = (1024, 1792)
    
    clips = []
    for video_path in video_paths:
        if os.path.exists(video_path):
            clip = VideoFileClip(video_path)
            
            # Resize clip to match target size while maintaining aspect ratio
            # This prevents cropping by fitting the video within the target dimensions
            # and centering it with black bars if needed
            clip_w, clip_h = clip.size
            target_w, target_h = target_size
            
            # Calculate scaling to fit within target size while maintaining aspect ratio
            scale_w = target_w / clip_w
            scale_h = target_h / clip_h
            scale = min(scale_w, scale_h)  # Use the smaller scale to ensure it fits
            
            # Resize the clip
            new_width = int(clip_w * scale)
            new_height = int(clip_h * scale)
            clip_resized = clip.resize((new_width, new_height))
            
            # Always create a composite to ensure consistent dimensions
            # Center the clip and add black bars if needed
            clip_positioned = clip_resized.set_position(('center', 'center'))
            final_clip = CompositeVideoClip([clip_positioned], size=target_size, bg_color=(0,0,0)).set_duration(clip.duration)
            
            clips.append(final_clip)
    
    if not clips:
        raise ValueError("No valid video clips to stitch")
    
    # Concatenate with compose to handle different sized clips
    final_video = concatenate_videoclips(clips, method="compose")
    final_video.write_videofile(output_path, codec="libx264", audio_codec="aac")
    
    # Release clips from memory
    for clip in clips:
        if hasattr(clip, 'close'):
            clip.close()
    if hasattr(final_video, 'close'):
        final_video.close()
    
    return output_path

