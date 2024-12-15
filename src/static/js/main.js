document.addEventListener('DOMContentLoaded', function() {
    console.log('Script loaded');
    const imageInput = document.getElementById('imageInput');
    const imageCanvas = document.getElementById('imageCanvas');
    const pointCanvas = document.getElementById('pointCanvas');
    const maskCanvas = document.getElementById('maskCanvas');
    const clearButton = document.getElementById('clearPoints');
    const generateButton = document.getElementById('generateMask');
    const positiveButton = document.getElementById('positivePoint');
    const negativeButton = document.getElementById('negativePoint');
    
    let points = [];
    let pointLabels = [];
    let currentImage = null;
    let isPositivePoint = true;
    let allMasks = [];
    let selectedMasks = new Set();
    let currentHoverMask = null;
    
    function setupCanvases(width, height) {
        console.log('Setting up canvases with dimensions:', width, height);
        [imageCanvas, pointCanvas, maskCanvas].forEach(canvas => {
            canvas.width = width;
            canvas.height = height;
            canvas.style.width = width + 'px';
            canvas.style.height = height + 'px';
        });
    }
    
    // Mode selection
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
    
    imageInput.addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        // Upload image to server
        await loadImage(file);
    });
    
    async function loadImage(file) {
        console.log("Starting image load");
        const formData = new FormData();
        formData.append('image', file);
        
        try {
            // Upload image
            console.log("Uploading image to server...");
            let response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Upload failed: ${errorData.error || 'Unknown error'}`);
            }
            
            const uploadResult = await response.json();
            console.log("Upload response:", uploadResult);

            // Display image
            const reader = new FileReader();
            reader.onload = async function(event) {
                console.log("Local image loaded, creating Image object");
                const img = new Image();
                img.onload = async function() {
                    console.log("Image loaded into canvas, dimensions:", img.width, "x", img.height);
                    setupCanvases(img.width, img.height);
                    const ctx = imageCanvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    currentImage = img;
                    
                    // Wait a moment for the server to process the image
                    console.log("Waiting before generating masks...");
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // Generate all possible masks
                    console.log("Requesting mask generation...");
                    await generateAllMasks();
                }
                img.src = event.target.result;
            }
            reader.readAsDataURL(file);
            
        } catch (error) {
            console.error('Error:', error);
        }
    }
    
    async function generateAllMasks() {
        try {
            console.log("Starting mask generation request");
            const response = await fetch('/generate_masks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({}) // Add any necessary parameters here
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Mask generation failed: ${errorData.error || 'Unknown error'}`);
            }
            
            const data = await response.json();
            console.log(`Generated ${data.masks?.length || 0} masks`);
            allMasks = data.masks || [];
            
        } catch (error) {
            console.error('Error generating masks:', error);
        }
    }
    
    function findMaskAtPoint(x, y) {
        // Find the mask that contains the point
        // This is a simplified version - you might want to add more sophisticated matching
        for (let maskData of allMasks) {
            // Load mask image and check if point is in mask
            const img = new Image();
            img.src = 'data:image/png;base64,' + maskData.mask;
            const tempCanvas = document.createElement('canvas');
            const ctx = tempCanvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const pixel = ctx.getImageData(x, y, 1, 1).data;
            if (pixel[0] > 0) {  // If point is in mask
                return maskData;
            }
        }
        return null;
    }
    
    pointCanvas.addEventListener('mousemove', function(e) {
        if (!currentImage) return;
        
        const rect = pointCanvas.getBoundingClientRect();
        const scaleX = pointCanvas.width / rect.width;
        const scaleY = pointCanvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        
        // Find mask under cursor
        const maskUnderCursor = findMaskAtPoint(x, y);
        
        if (maskUnderCursor !== currentHoverMask) {
            currentHoverMask = maskUnderCursor;
            // Update preview
            const ctx = maskCanvas.getContext('2d');
            ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
            
            // Draw selected masks
            selectedMasks.forEach(mask => {
                drawMask(mask, 'rgba(0, 255, 0, 0.3)');
            });
            
            // Draw hover mask
            if (currentHoverMask) {
                drawMask(currentHoverMask, 'rgba(0, 255, 0, 0.1)');
            }
        }
    });
    
    pointCanvas.addEventListener('click', function(e) {
        if (!currentImage || !currentHoverMask) return;
        
        const rect = pointCanvas.getBoundingClientRect();
        const scaleX = pointCanvas.width / rect.width;
        const scaleY = pointCanvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        
        if (isPositivePoint) {
            selectedMasks.add(currentHoverMask);
        } else {
            selectedMasks.delete(currentHoverMask);
        }
        
        // Draw point
        const ctx = pointCanvas.getContext('2d');
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = isPositivePoint ? '#00ff00' : '#ff0000';
        ctx.fill();
        
        // Update mask display
        updateMaskDisplay();
    });
    
    function drawMask(maskData, color) {
        const ctx = maskCanvas.getContext('2d');
        const img = new Image();
        img.onload = function() {
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = color;
            ctx.drawImage(img, 0, 0);
        }
        img.src = 'data:image/png;base64,' + maskData.mask;
    }
    
    function updateMaskDisplay() {
        const ctx = maskCanvas.getContext('2d');
        ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        selectedMasks.forEach(mask => {
            drawMask(mask, 'rgba(0, 255, 0, 0.3)');
        });
    }
    
    clearButton.addEventListener('click', function() {
        points = [];
        pointLabels = [];
        const ctx = pointCanvas.getContext('2d');
        ctx.clearRect(0, 0, pointCanvas.width, pointCanvas.height);
        maskCanvas.getContext('2d').clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    });
    
    generateButton.addEventListener('click', async function() {
        if (points.length === 0) return;
        
        try {
            const response = await fetch('/segment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    points: points,
                    labels: pointLabels
                })
            });
            
            if (!response.ok) throw new Error('Segmentation failed');
            
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
    });
});
