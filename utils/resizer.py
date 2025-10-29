from PIL import Image
import os


def resize_image(image_path: str, target_size: tuple[int, int] = (1024, 1792)) -> str:
    """
    Resize image to target size and convert to RGB JPEG format for better compatibility.
    
    This ensures the image is in a format that's most compatible with Sora's API.
    The image will be cropped to fit the exact target dimensions.
    
    Args:
        image_path: Path to the image file
        target_size: Tuple of (width, height) for target dimensions (default: 1024x1792)
    
    Returns:
        str: Path to the resized image file
    """
    img = Image.open(image_path)
    width, height = img.size
    target_width, target_height = target_size

    # Convert to RGB if necessary (some images might be RGBA or other formats)
    if img.mode != 'RGB':
        # Create a white background
        rgb_img = Image.new('RGB', img.size, (255, 255, 255))
        if img.mode == 'RGBA':
            # Use alpha channel for transparency
            rgb_img.paste(img, mask=img.split()[3])
        else:
            rgb_img.paste(img)
        img = rgb_img

    scale = max(target_width / width, target_height / height)
    new_width, new_height = int(width * scale), int(height * scale)
    img_resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

    left = (new_width - target_width) // 2
    top = (new_height - target_height) // 2
    img_cropped = img_resized.crop(
        (left, top, left + target_width, top + target_height)
    )

    # Save as high-quality JPEG for best compatibility
    # Change extension to .jpg
    jpeg_path = os.path.splitext(image_path)[0] + '.jpg'
    img_cropped.save(jpeg_path, 'JPEG', quality=95)
    
    # Delete original file if it was converted
    if jpeg_path != image_path and os.path.exists(image_path):
        os.remove(image_path)
    
    return jpeg_path