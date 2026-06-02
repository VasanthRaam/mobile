from PIL import Image
import os

input_path = "assets/icon.png"
output_path = "assets/icon_fixed.png"

try:
    print(f"Opening {input_path}...")
    with Image.open(input_path) as img:
        print(f"Current format: {img.format}")
        # Convert to RGBA (adds transparency support if needed) and save as PNG
        img.convert("RGBA").save(output_path, "PNG")
        print(f"Saved true PNG to {output_path}")
    
    # Replace the old one
    os.remove(input_path)
    os.rename(output_path, input_path)
    print("Successfully replaced icon with true PNG version.")
except Exception as e:
    print(f"Error: {e}")
