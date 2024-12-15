document.addEventListener('DOMContentLoaded', function() {
    const imageInput = document.getElementById('imageInput');
    const imageCanvas = document.getElementById('imageCanvas');
    const pointCanvas = document.getElementById('pointCanvas');
    const maskCanvas = document.getElementById('maskCanvas');
    const clearButton = document.getElementById('clearPoints');
    const positiveButton = document.getElementById('positivePoint');
    const negativeButton = document.getElementById('negativePoint');
    const generateButton = document.getElementById('generateSegment');
    const loaderContainer = document.querySelector('.loader-container');
    const downloadButton = document.getElementById('downloadMask');

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

    // Add at the top with other constants
    const allButtons = [
        positiveButton, 
        negativeButton, 
        clearButton, 
        generateButton,
        downloadButton
    ];

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

    function showLoader() {
        const imageCanvas = document.getElementById('imageCanvas');
        const loader = document.querySelector('.loader');
        
        // Get image dimensions
        const imageWidth = imageCanvas.width;
        const imageHeight = imageCanvas.height;
        
        // Position loader at center of image
        loader.style.left = `${imageWidth/2}px`;
        loader.style.top = `${imageHeight/2}px`;
        
        loaderContainer.style.display = 'block';
        allButtons.forEach(button => {
            button.disabled = true;
        });
    }

    function hideLoader() {
        loaderContainer.style.display = 'none';
        allButtons.forEach(button => {
            button.disabled = false;
        });
    }

    async function generateMask() {
        if (points.length === 0) return;

        try {
            showLoader();
            const params = {};
            Object.entries(parameterInputs).forEach(([key, input]) => {
                params[key] = parseFloat(input.value);
            });

            const response = await fetch('/segment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    points: points,
                    labels: pointLabels,
                    parameters: params
                })
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
                hideLoader();
            }
            img.src = 'data:image/png;base64,' + data.mask;

        } catch (error) {
            console.error('Error:', error);
            hideLoader();
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

    function downloadMaskedImage() {
        if (!currentImage || !maskCanvas) return;
        
        try {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = imageCanvas.width;
            tempCanvas.height = imageCanvas.height;
            const ctx = tempCanvas.getContext('2d');
            
            console.log('Canvas dimensions:', tempCanvas.width, tempCanvas.height);
            
            // Fill with black background
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            
            // Get mask data
            const maskCtx = maskCanvas.getContext('2d');
            const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
            
            // DEBUG: More detailed mask inspection
            console.log('First few mask pixels:');
            for(let i = 0; i < 40; i += 4) {
                console.log(`Pixel ${i/4}:`, {
                    r: maskData.data[i],
                    g: maskData.data[i+1],
                    b: maskData.data[i+2],
                    a: maskData.data[i+3]
                });
            }
            
            // Get image data
            const imageCtx = imageCanvas.getContext('2d');
            const imageData = imageCtx.getImageData(0, 0, imageCanvas.width, imageCanvas.height);
            
            // Create composite
            const finalImageData = ctx.createImageData(tempCanvas.width, tempCanvas.height);
            for (let i = 0; i < imageData.data.length; i += 4) {
                // Try using the red channel of the mask instead of alpha
                if (maskData.data[i] > 0) {  // Changed to check red channel
                    finalImageData.data[i] = imageData.data[i];        // R
                    finalImageData.data[i + 1] = imageData.data[i + 1];// G
                    finalImageData.data[i + 2] = imageData.data[i + 2];// B
                    finalImageData.data[i + 3] = 255;                  // A
                } else {
                    finalImageData.data[i] = 0;     // R
                    finalImageData.data[i + 1] = 0; // G
                    finalImageData.data[i + 2] = 0; // B
                    finalImageData.data[i + 3] = 255; // A
                }
            }
            
            ctx.putImageData(finalImageData, 0, 0);
            
            // Create download link
            const link = document.createElement('a');
            link.download = 'masked_image.png';
            link.href = tempCanvas.toDataURL('image/png');
            link.click();
        } catch (error) {
            console.error('Error creating download:', error);
        }
    }

    downloadButton.addEventListener('click', downloadMaskedImage);
});
