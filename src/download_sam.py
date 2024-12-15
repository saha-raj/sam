import os
import torch
import requests
from tqdm import tqdm

def download_sam_checkpoint():
    """Download the SAM checkpoint if it doesn't exist."""
    checkpoint_dir = "models/checkpoints"
    checkpoint_path = os.path.join(checkpoint_dir, "sam_vit_h_4b8939.pth")
    
    # Create checkpoint directory if it doesn't exist
    os.makedirs(checkpoint_dir, exist_ok=True)
    
    if not os.path.exists(checkpoint_path):
        print("Downloading SAM checkpoint...")
        url = "https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth"
        response = requests.get(url, stream=True)
        total_size = int(response.headers.get("content-length", 0))
        
        with open(checkpoint_path, "wb") as f, tqdm(
            total=total_size,
            unit='iB',
            unit_scale=True,
            unit_divisor=1024,
        ) as pbar:
            for data in response.iter_content(chunk_size=1024):
                size = f.write(data)
                pbar.update(size)
    else:
        print("SAM checkpoint already exists.")

if __name__ == "__main__":
    download_sam_checkpoint()
