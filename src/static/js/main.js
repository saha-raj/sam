document.addEventListener('DOMContentLoaded', function() {
    const imageInput = document.getElementById('imageInput');
    const imageCanvas = document.getElementById('imageCanvas');
    const pointCanvas = document.getElementById('pointCanvas');
    const maskCanvas = document.getElementById('maskCanvas');
    const clearButton = document.getElementById('clearPoints');
    const positiveButton = document.getElementById('positivePoint');
    const negativeButton = document.getElementById('negativePoint');
    const generateButton = document.getElementById('generateSegment');

    // Parameter inputs
    const parameterInputs = {
        pred_iou_thresh: document.getElementById('pred_iou_thresh'),
        stability_score_thresh: document.getElementById('stability_score_thresh'),
        min_mask_region_area: document.getElementById('min_mask_region_area')
    };

    let points = [];
    let pointLabels = [];
    let currentImage = null;
    let isPositivePoint = true;

    // Update parameter display values
    Object.entries(parameterInputs).forEach(([key, input]) => {
        if (input.type === 'range') {
            const valueDisplay = input.nextElementSibling;
            input.addEventListener('input', () => {
                valueDisplay.textContent = input.value;
            });
        }
    });

    function setupCanvases(width, height) {
        [imageCanvas, pointCanvas, maskCanvas].forEach(canvas => {
            canvas.width = width;
            canvas.height = height;
        });
    }

    async function loadImage(file) {
        const formData = new FormData();
        formData.append('image', file);
        
        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) throw new Error('Upload failed');

            const reader = new FileReader();
            reader.onload = function(event) {
                const img = new Image();
                img.onload = function() {
                    setupCanvases(img.width, img.height);
                    const ctx = imageCanvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    currentImage = img;
                }
                img.src = event.target.result;
            }
            reader.readAsDataURL(file);
            
        } catch (error) {
            console.error('Error:', error);
        }
    }

    async function generateMask() {
        if (points.length === 0) return;

        try {
            const params = {};
            Object.entries(parameterInputs).forEach(([key, input]) => {
                params[key] = parseFloat(input.value);
            });

            const requestData = {
                points: points,
                labels: pointLabels,
                parameters: params
            };
            console.log("Sending to server:", requestData);

            const response = await fetch('/segment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Segmentation failed: ${errorData.error || 'Unknown error'}`);
            }

            const data = await response.json();
            
            // Display mask
            const img = new Image();
            img.onload = function() {
                const ctx = maskCanvas.getContext('2d');
                ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
                ctx.globalAlpha = 0.5;
                ctx.drawImage(img, 0, 0);
            }
            img.src = 'data:image/png;base64,' + data.mask;

        } catch (error) {
            console.error('Error:', error);
        }
    }

    pointCanvas.addEventListener('click', async function(e) {
        if (!currentImage) return;

        const rect = pointCanvas.getBoundingClientRect();
        const scaleX = pointCanvas.width / rect.width;
        const scaleY = pointCanvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        points.push([x, y]);
        pointLabels.push(isPositivePoint ? 1 : 0);

        const ctx = pointCanvas.getContext('2d');
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = isPositivePoint ? '#00ff00' : '#ff0000';
        ctx.fill();
    });

    clearButton.addEventListener('click', function() {
        points = [];
        pointLabels = [];
        const ctx = pointCanvas.getContext('2d');
        ctx.clearRect(0, 0, pointCanvas.width, pointCanvas.height);
        maskCanvas.getContext('2d').clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    });

    positiveButton.addEventListener('click', () => {
        isPositivePoint = true;
        positiveButton.classList.add('active');
        negativeButton.classList.remove('active');
    });

    negativeButton.addEventListener('click', () => {
        isPositivePoint = false;
        negativeButton.classList.add('active');
        positiveButton.classList.remove('active');
    });

    generateButton.addEventListener('click', async function() {
        if (points.length > 0) {
            await generateMask();
        }
    });

    imageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) loadImage(file);
    });
});
