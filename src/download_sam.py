import os
import torch
import requests
from tqdm import tqdm

def download_sam_checkpoint(model_type="vit_h"):
    """Download the SAM checkpoint if it doesn't exist.
    Args:
        model_type (str): Either 'vit_h' or 'vit_b'
    """
    checkpoint_dir = "models/checkpoints"
    
    # Model configurations
    models = {
        "vit_h": {
            "name": "sam_vit_h_4b8939.pth",
            "url": "https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth"
        },
        "vit_b": {
            "name": "sam_vit_b_01ec64.pth",
            "url": "https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth"
        }
    }
    
    if model_type not in models:
        raise ValueError(f"Model type must be one of {list(models.keys())}")
        
    model_info = models[model_type]
    checkpoint_path = os.path.join(checkpoint_dir, model_info["name"])
    
    # Create checkpoint directory if it doesn't exist
    os.makedirs(checkpoint_dir, exist_ok=True)
    
    if not os.path.exists(checkpoint_path):
        print(f"Downloading SAM {model_type} checkpoint...")
        url = model_info["url"]
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
        print(f"Downloaded {model_type} checkpoint to {checkpoint_path}")
    else:
        print(f"SAM {model_type} checkpoint already exists.")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', type=str, default='vit_h', choices=['vit_h', 'vit_b'],
                      help='Model type to download (vit_h or vit_b)')
    args = parser.parse_args()
    
    download_sam_checkpoint(args.model)
