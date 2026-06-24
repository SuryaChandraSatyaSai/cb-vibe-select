/**
 * CB VibeSelect — AI Image Analyzer
 * Canvas-based image quality analysis with perceptual hashing for duplicate detection
 */

// =========================================
// Main Analysis Function
// =========================================

/**
 * Analyze a single image for quality metrics
 * @param {HTMLImageElement} img - Loaded image element
 * @returns {Object} Analysis results with scores and metrics
 */
export function analyzeImage(img) {
    // Create canvas at a reduced size for performance
    const maxDim = 512;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    let w = img.naturalWidth || img.width;
    let h = img.naturalHeight || img.height;
    const scale = Math.min(maxDim / w, maxDim / h, 1);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(img, 0, 0, w, h);

    const imageData = ctx.getImageData(0, 0, w, h);
    const pixels = imageData.data;

    // Run all analysis metrics
    const sharpness = measureSharpness(pixels, w, h);
    const brightness = measureBrightness(pixels);
    const contrast = measureContrast(pixels);
    const colorfulness = measureColorfulness(pixels);
    const composition = measureComposition(pixels, w, h);
    const noise = measureNoise(pixels, w, h);

    // Compute overall quality score (weighted average)
    const overallScore = Math.round(
        sharpness.score * 0.30 +
        brightness.score * 0.15 +
        contrast.score * 0.15 +
        colorfulness.score * 0.15 +
        composition.score * 0.15 +
        noise.score * 0.10
    );

    // Determine tags
    const tags = [];
    if (sharpness.score < 35) tags.push('blur');
    if (brightness.score < 30) tags.push('dark');
    if (brightness.value > 200) tags.push('bright');

    // Compute perceptual hash for duplicate detection
    const pHash = computePHash(img);

    return {
        overallScore,
        metrics: {
            sharpness,
            brightness,
            contrast,
            colorfulness,
            composition,
            noise
        },
        tags,
        pHash,
        dimensions: { width: img.naturalWidth || img.width, height: img.naturalHeight || img.height },
        classification: classifyImage(overallScore)
    };
}

/**
 * Classify image based on overall score
 */
function classifyImage(score) {
    if (score >= 65) return 'best';
    if (score >= 50) return 'acceptable';
    return 'rejected';
}


// =========================================
// Sharpness (Laplacian Variance)
// =========================================

function measureSharpness(pixels, width, height) {
    // Convert to grayscale and apply Laplacian kernel
    const gray = toGrayscale(pixels, width, height);

    // Laplacian kernel: [0, 1, 0], [1, -4, 1], [0, 1, 0]
    let sum = 0;
    let sumSq = 0;
    let count = 0;

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            const laplacian =
                gray[idx - width] +
                gray[idx - 1] +
                gray[idx + 1] +
                gray[idx + width] -
                4 * gray[idx];
            sum += laplacian;
            sumSq += laplacian * laplacian;
            count++;
        }
    }

    const mean = sum / count;
    const variance = (sumSq / count) - (mean * mean);

    // Map variance to 0-100 score
    // Typical sharp images have variance > 500, blurry < 100
    const score = Math.min(100, Math.max(0, Math.round((variance / 800) * 100)));

    return { score, value: Math.round(variance), label: 'Sharpness' };
}


// =========================================
// Brightness (Mean Luminance)
// =========================================

function measureBrightness(pixels) {
    let total = 0;
    const numPixels = pixels.length / 4;

    for (let i = 0; i < pixels.length; i += 4) {
        // Luminance formula: 0.299R + 0.587G + 0.114B
        total += 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
    }

    const meanBrightness = total / numPixels;

    // Ideal brightness is around 100-160
    // Too dark (<60) or too bright (>200) scores low
    let score;
    if (meanBrightness >= 90 && meanBrightness <= 170) {
        score = 100;
    } else if (meanBrightness < 90) {
        score = Math.max(0, Math.round((meanBrightness / 90) * 100));
    } else {
        score = Math.max(0, Math.round(((255 - meanBrightness) / 85) * 100));
    }

    return { score, value: Math.round(meanBrightness), label: 'Brightness' };
}


// =========================================
// Contrast (Standard Deviation of Luminance)
// =========================================

function measureContrast(pixels) {
    let sum = 0;
    let sumSq = 0;
    const numPixels = pixels.length / 4;

    for (let i = 0; i < pixels.length; i += 4) {
        const lum = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
        sum += lum;
        sumSq += lum * lum;
    }

    const mean = sum / numPixels;
    const variance = (sumSq / numPixels) - (mean * mean);
    const stdDev = Math.sqrt(Math.max(0, variance));

    // Good contrast has stdDev around 50-80
    const score = Math.min(100, Math.max(0, Math.round((stdDev / 70) * 100)));

    return { score, value: Math.round(stdDev), label: 'Contrast' };
}


// =========================================
// Colorfulness (Hasler-Süsstrunk metric)
// =========================================

function measureColorfulness(pixels) {
    let rg_sum = 0, rg_sumSq = 0;
    let yb_sum = 0, yb_sumSq = 0;
    const numPixels = pixels.length / 4;

    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
        const rg = r - g;
        const yb = 0.5 * (r + g) - b;

        rg_sum += rg;
        rg_sumSq += rg * rg;
        yb_sum += yb;
        yb_sumSq += yb * yb;
    }

    const rg_mean = rg_sum / numPixels;
    const yb_mean = yb_sum / numPixels;
    const rg_std = Math.sqrt(Math.max(0, (rg_sumSq / numPixels) - (rg_mean * rg_mean)));
    const yb_std = Math.sqrt(Math.max(0, (yb_sumSq / numPixels) - (yb_mean * yb_mean)));

    const stdRoot = Math.sqrt(rg_std * rg_std + yb_std * yb_std);
    const meanRoot = Math.sqrt(rg_mean * rg_mean + yb_mean * yb_mean);
    const colorfulness = stdRoot + 0.3 * meanRoot;

    // Map to 0-100 score. Values 40-120 are typical for colorful images
    const score = Math.min(100, Math.max(0, Math.round((colorfulness / 100) * 100)));

    return { score, value: Math.round(colorfulness), label: 'Colorfulness' };
}


// =========================================
// Composition (Rule of Thirds evaluation)
// =========================================

function measureComposition(pixels, width, height) {
    // Evaluate edge/interest distribution around rule-of-thirds lines
    const gray = toGrayscale(pixels, width, height);

    // Compute simple edge magnitude using Sobel-like
    const edges = new Float32Array(width * height);
    let totalEdge = 0;

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            const gx = gray[idx + 1] - gray[idx - 1];
            const gy = gray[idx + width] - gray[idx - width];
            const mag = Math.sqrt(gx * gx + gy * gy);
            edges[idx] = mag;
            totalEdge += mag;
        }
    }

    if (totalEdge === 0) return { score: 50, value: 0, label: 'Composition' };

    // Check edge concentration at rule-of-thirds intersections
    const thirdW = width / 3;
    const thirdH = height / 3;
    const radius = Math.min(width, height) * 0.08;

    const hotspots = [
        [thirdW, thirdH], [2 * thirdW, thirdH],
        [thirdW, 2 * thirdH], [2 * thirdW, 2 * thirdH]
    ];

    let hotspotEdge = 0;
    for (const [hx, hy] of hotspots) {
        for (let y = Math.max(1, Math.floor(hy - radius)); y < Math.min(height - 1, Math.ceil(hy + radius)); y++) {
            for (let x = Math.max(1, Math.floor(hx - radius)); x < Math.min(width - 1, Math.ceil(hx + radius)); x++) {
                hotspotEdge += edges[y * width + x];
            }
        }
    }

    const ratio = hotspotEdge / totalEdge;

    // Also check center-weightedness (not too much in corners)
    const centerX = width / 2, centerY = height / 2;
    const centerRadius = Math.min(width, height) * 0.25;
    let centerEdge = 0;
    for (let y = Math.floor(centerY - centerRadius); y < Math.ceil(centerY + centerRadius); y++) {
        for (let x = Math.floor(centerX - centerRadius); x < Math.ceil(centerX + centerRadius); x++) {
            if (y >= 0 && y < height && x >= 0 && x < width) {
                centerEdge += edges[y * width + x];
            }
        }
    }

    const centerRatio = centerEdge / totalEdge;

    // Blend score: reward rule-of-thirds AND reasonable center interest
    const score = Math.min(100, Math.max(0, Math.round(
        (ratio * 300 + centerRatio * 80) / 2
    )));

    return { score, value: Math.round(ratio * 100), label: 'Composition' };
}


// =========================================
// Noise Estimation
// =========================================

function measureNoise(pixels, width, height) {
    // Estimate noise using high-frequency content in small blocks
    const gray = toGrayscale(pixels, width, height);
    const blockSize = 8;
    let totalVariance = 0;
    let blockCount = 0;

    for (let by = 0; by < height - blockSize; by += blockSize) {
        for (let bx = 0; bx < width - blockSize; bx += blockSize) {
            let sum = 0, sumSq = 0;
            for (let y = by; y < by + blockSize; y++) {
                for (let x = bx; x < bx + blockSize; x++) {
                    const val = gray[y * width + x];
                    sum += val;
                    sumSq += val * val;
                }
            }
            const n = blockSize * blockSize;
            const mean = sum / n;
            const variance = (sumSq / n) - (mean * mean);
            totalVariance += variance;
            blockCount++;
        }
    }

    const avgVariance = totalVariance / Math.max(1, blockCount);
    // Low avg variance in uniform blocks = low noise = good
    // High variance across all blocks = noisy = bad
    const score = Math.min(100, Math.max(0, Math.round(100 - (avgVariance / 30))));

    return { score, value: Math.round(avgVariance), label: 'Low Noise' };
}


// =========================================
// Perceptual Hash (pHash) for Duplicates
// =========================================

/**
 * Compute a 64-bit perceptual hash of an image
 * Returns a hex string
 */
export function computePHash(img) {
    const size = 32;
    const smallSize = 8;

    // Resize to 32x32
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, size, size);

    const imageData = ctx.getImageData(0, 0, size, size);
    const pixels = imageData.data;

    // Convert to grayscale
    const gray = new Float64Array(size * size);
    for (let i = 0; i < size * size; i++) {
        const pi = i * 4;
        gray[i] = 0.299 * pixels[pi] + 0.587 * pixels[pi + 1] + 0.114 * pixels[pi + 2];
    }

    // Apply DCT (simplified)
    const dct = new Float64Array(smallSize * smallSize);
    for (let u = 0; u < smallSize; u++) {
        for (let v = 0; v < smallSize; v++) {
            let sum = 0;
            for (let i = 0; i < size; i++) {
                for (let j = 0; j < size; j++) {
                    sum += gray[i * size + j] *
                        Math.cos(((2 * i + 1) * u * Math.PI) / (2 * size)) *
                        Math.cos(((2 * j + 1) * v * Math.PI) / (2 * size));
                }
            }
            dct[u * smallSize + v] = sum;
        }
    }

    // Compute median of DCT values (excluding DC component)
    const dctValues = Array.from(dct.slice(1));
    dctValues.sort((a, b) => a - b);
    const median = dctValues[Math.floor(dctValues.length / 2)];

    // Build hash: 1 if above median, 0 if below
    let hash = '';
    for (let i = 0; i < dct.length; i++) {
        hash += dct[i] > median ? '1' : '0';
    }

    // Convert binary string to hex
    let hex = '';
    for (let i = 0; i < hash.length; i += 4) {
        hex += parseInt(hash.substr(i, 4), 2).toString(16);
    }

    return hex;
}

/**
 * Calculate Hamming distance between two hashes (hex strings)
 */
export function hammingDistance(hash1, hash2) {
    if (hash1.length !== hash2.length) return Infinity;
    let distance = 0;
    for (let i = 0; i < hash1.length; i++) {
        const b1 = parseInt(hash1[i], 16);
        const b2 = parseInt(hash2[i], 16);
        let xor = b1 ^ b2;
        while (xor) {
            distance += xor & 1;
            xor >>= 1;
        }
    }
    return distance;
}

/**
 * Find duplicates in a set of analyzed images
 * @param {Array} images - Array of objects with pHash property
 * @param {number} threshold - Max hamming distance for duplicates (default 5)
 * @returns {Map} Map of index -> array of duplicate indices
 */
export function findDuplicates(images, threshold = 5) {
    const duplicates = new Map();
    const processed = new Set();

    for (let i = 0; i < images.length; i++) {
        if (processed.has(i)) continue;
        const dupes = [];

        for (let j = i + 1; j < images.length; j++) {
            if (processed.has(j)) continue;
            const dist = hammingDistance(images[i].pHash, images[j].pHash);
            if (dist <= threshold) {
                dupes.push(j);
                processed.add(j);
            }
        }

        if (dupes.length > 0) {
            duplicates.set(i, dupes);
        }
    }

    return duplicates;
}


// =========================================
// Grayscale Helper
// =========================================

function toGrayscale(pixels, width, height) {
    const gray = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
        const pi = i * 4;
        gray[i] = 0.299 * pixels[pi] + 0.587 * pixels[pi + 1] + 0.114 * pixels[pi + 2];
    }
    return gray;
}
