import os
import base64
import numpy as np
import cv2
from flask import Flask, render_template, request, jsonify
from segment_anything import sam_model_registry, SamPredictor
import logging

logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
app.secret_key = 'your_secret_key_here'  # Required for session

# # Initialize SAM - large model
# CHECKPOINT_PATH = "models/checkpoints/sam_vit_h_4b8939.pth"
# DEVICE = "cpu"
# MODEL_TYPE = "vit_h"

# Initialize SAM - small model
CHECKPOINT_PATH = "models/checkpoints/sam_vit_b_01ec64.pth"
DEVICE = "cpu"
MODEL_TYPE = "vit_b"

sam = sam_model_registry[MODEL_TYPE](checkpoint=CHECKPOINT_PATH)
sam.to(device=DEVICE)
predictor = SamPredictor(sam)

# Set points_per_side to a lower value (default is 32)
predictor.model.points_per_side = 8  # Try a lower value for faster computation
predictor.model.num_multimask_outputs = 1
# Global variable to store the current image
current_image = None

def resize_image(image, max_size=640):
    height, width = image.shape[:2]
    if max(height, width) > max_size:
        scale = max_size / max(height, width)
        new_height = int(height * scale)
        new_width = int(width * scale)
        return cv2.resize(image, (new_width, new_height))
    return image

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_image():
    global current_image
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image uploaded'}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({'error': 'No image selected'}), 400
        
        # Read and store the image
        file_bytes = np.frombuffer(file.read(), np.uint8)
        current_image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
        if current_image is None:
            return jsonify({'error': 'Failed to read image'}), 400
            
        # Resize image
        current_image = resize_image(current_image, max_size=640)
        
        # Convert to base64 and send back to client
        _, buffer = cv2.imencode('.png', current_image)
        image_base64 = base64.b64encode(buffer).decode('utf-8')
        
        return jsonify({
            'success': True,
            'image': image_base64
        })
        
    except Exception as e:
        print(f"Error in upload: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/generate_masks', methods=['POST'])
def generate_masks():
    global current_image
    try:
        print("Starting generate_masks endpoint")
        
        if current_image is None:
            print("No current image found")
            return jsonify({'error': 'No image set in predictor'}), 400
            
        # Ensure predictor has the current image
        predictor.set_image(current_image)
        
        h, w = current_image.shape[:2]
        print(f"Image dimensions: {w}x{h}")
        
        # Create grid points
        stride = 64
        points = []
        for i in range(stride, h, stride):
            for j in range(stride, w, stride):
                points.append([j, i])
        
        print(f"Generated {len(points)} points")
        
        if not points:
            return jsonify({'error': 'No points generated'}), 400
            
        point_coords = np.array(points)
        point_labels = np.ones(len(points))
        
        print("Starting mask prediction")
        # Generate masks for all points
        masks, scores, _ = predictor.predict(
            point_coords=point_coords,
            point_labels=point_labels,
            multimask_output=True
        )
        print(f"Generated {len(masks)} masks")
        
        # Convert masks to base64
        encoded_masks = []
        for i, mask in enumerate(masks):
            mask_img = mask.astype(np.uint8) * 255
            _, buffer = cv2.imencode('.png', mask_img)
            mask_b64 = base64.b64encode(buffer).decode('utf-8')
            encoded_masks.append({
                'mask': mask_b64,
                'score': float(scores[i])
            })
        
        print(f"Encoded {len(encoded_masks)} masks")
        return jsonify({'masks': encoded_masks})
        
    except Exception as e:
        import traceback
        print(f"Error in generate_masks: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

@app.route('/segment', methods=['POST'])
def segment():
    global current_image
    try:
        if current_image is None:
            return jsonify({'error': 'No image set'}), 400
            
        # Move the color conversion and predictor setup here
        rgb_image = cv2.cvtColor(current_image, cv2.COLOR_BGR2RGB)
        predictor.set_image(rgb_image)
        
        data = request.json
        point_coords = np.array(data['points'])
        point_labels = np.array(data['labels'])
        parameters = data.get('parameters', {})
        
        # Get masks using the correct parameter names
        masks, scores, _ = predictor.predict(
            point_coords=point_coords,
            point_labels=point_labels,
            multimask_output=True
        )
        
        # Select the mask with the highest score
        mask = masks[np.argmax(scores)].astype(np.uint8) * 255
        _, buffer = cv2.imencode('.png', mask)
        mask_b64 = base64.b64encode(buffer).decode('utf-8')
        
        return jsonify({
            'mask': mask_b64,
            'score': float(np.max(scores))
        })
        
    except Exception as e:
        import traceback
        print(f"Error in segment: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
