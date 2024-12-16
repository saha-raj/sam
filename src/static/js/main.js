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
        pred_iou_thresh: { value: 0.88 },
        stability_score_thresh: { value: 0.95 },
        stability_score_offset: { value: 1.0 },
        box_nms_thresh: { value: 0.7 },
        crop_n_layers: { value: 0 },
        crop_nms_thresh: { value: 0.7 },
        crop_overlap_ratio: { value: 512 / 1500 },
        crop_n_points_downscale_factor: { value: 1 },
        min_mask_region_area: { value: 0 }
    };

    let points = [];
    let pointLabels = [];
    let currentImage = null;
    let isPositivePoint = true;
    let originalFilename = '';

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
        console.log('Setting up canvases with dimensions:', width, height);
        [imageCanvas, pointCanvas, maskCanvas].forEach(canvas => {
            canvas.width = width;
            canvas.height = height;
        });
    }

    async function loadImage(file) {
        const formData = new FormData();
        formData.append('image', file);
        
        try {
            originalFilename = file.name;
            
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) throw new Error('Upload failed');
            const data = await response.json();

            // Use the resized image from server
            const img = new Image();
            img.onload = function() {
                setupCanvases(img.width, img.height);
                const ctx = imageCanvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                currentImage = img;
            }
            img.src = 'data:image/png;base64,' + data.image;
            
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
            
            // Get image data
            const imageCtx = imageCanvas.getContext('2d');
            const imageData = imageCtx.getImageData(0, 0, imageCanvas.width, imageCanvas.height);
            
            // Create composite
            const finalImageData = ctx.createImageData(tempCanvas.width, tempCanvas.height);
            for (let i = 0; i < imageData.data.length; i += 4) {
                if (maskData.data[i] > 0) {  // Check red channel
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
            
            // Create download link with original filename
            const link = document.createElement('a');
            const downloadName = originalFilename ? 
                'masked_' + originalFilename : 
                'masked_image.png';
            link.download = downloadName;
            link.href = tempCanvas.toDataURL('image/png');
            link.click();
        } catch (error) {
            console.error('Error creating download:', error);
        }
    }

    downloadButton.addEventListener('click', downloadMaskedImage);
});
