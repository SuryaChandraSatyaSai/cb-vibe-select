/**
 * CB VibeSelect — Utility Functions
 * Helpers for file handling, ZIP export, UI utilities
 */

// =========================================
// File Helpers
// =========================================

/**
 * Check if a file is a supported image type
 */
export function isImageFile(file) {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff'];
    return validTypes.includes(file.type);
}

/**
 * Format file size to human-readable
 */
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Format duration in seconds to human-readable
 */
export function formatDuration(seconds) {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
}

/**
 * Create a thumbnail from an image file
 * Returns a promise that resolves to a data URL
 */
export function createThumbnail(file, maxSize = 200) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > h) { h = (h / w) * maxSize; w = maxSize; }
                else { w = (w / h) * maxSize; h = maxSize; }
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Load image from file and return HTMLImageElement
 */
export function loadImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Get image data URL from file
 */
export function getImageDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}


// =========================================
// ZIP Export (using JSZip)
// =========================================

/**
 * Download selected images as a ZIP file
 * @param {Array} images - Array of { file, name } objects
 * @param {string} zipName - Name for the downloaded ZIP
 */
export async function downloadAsZip(images, zipName = 'CB_VibeSelect_BestShots') {
    if (typeof JSZip === 'undefined') {
        throw new Error('JSZip library not loaded');
    }

    const zip = new JSZip();
    const folder = zip.folder(zipName);

    for (const img of images) {
        const arrayBuffer = await img.file.arrayBuffer();
        folder.file(img.name || img.file.name, arrayBuffer);
    }

    const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
    }, (metadata) => {
        // Progress callback — can be used to update UI
        if (window._zipProgressCallback) {
            window._zipProgressCallback(metadata.percent);
        }
    });

    // Trigger download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${zipName}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}


// =========================================
// UI Utilities
// =========================================

/**
 * Debounce function
 */
export function debounce(fn, delay = 250) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * Throttle function
 */
export function throttle(fn, limit = 100) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            fn.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Show a toast notification
 */
export function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = {
        info: 'ℹ️',
        success: '✅',
        error: '❌',
        warning: '⚠️'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${message}</span>
    <span class="toast-close" onclick="this.parentElement.remove()">✕</span>
  `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * Get score class based on score value
 */
export function getScoreClass(score) {
    if (score >= 65) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
}

/**
 * Get score label
 */
export function getScoreLabel(score) {
    if (score >= 80) return 'Excellent';
    if (score >= 65) return 'Good';
    if (score >= 50) return 'Acceptable';
    return 'Poor';
}

/**
 * Sleep helper for async operations
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
