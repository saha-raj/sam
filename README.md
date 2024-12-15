# SAM Annotator

A web application for image annotation using Meta's Segment Anything Model (SAM).

## Setup

1. Create virtual environment:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

3. Download SAM checkpoint (will be added in setup instructions)

## Usage

(To be added)

## Project Structure
sam_annotator/
├── data/
│ ├── raw/ # Input images
│ └── processed/ # Generated masks
├── models/
│ └── segment-anything/ # SAM model
├── src/
│ ├── static/ # Static files (CSS, JS)
│ ├── templates/ # HTML templates
│ ├── app.py # Main application
│ └── utils.py # Utility functions
├── tests/ # Test files
└── requirements.txt # Project dependencies
