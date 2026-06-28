// Objective image-quality analysis from raw pixels.
// We pull a small uncompressed BMP straight from Cloudinary (no decode library
// needed) and compute lighting, colour and focus metrics, then a transparent score
// that ranks images for curation (sharp + well-exposed + colourful = higher).
//
// ponytail: true learned NR-IQA (MUSIQ/BRISQUE/NIMA) needs a Python/GPU service and
// isn't available on HF serverless, so we measure the objective factors directly.
// Variance-of-Laplacian is content-dependent (a legitimately smooth scene reads as
// soft); the knobs below are the calibration handles if scores drift in practice.

const ANALYZE_DIM = 256; // max edge of the analysis thumbnail
const SHARP_VAR_FULL = 250; // Laplacian variance that maps to 100% sharpness (calibrated for Gaussian-smoothed variance)
const WEIGHTS = { sharpness: 0.45, exposure: 0.35, color: 0.12, contrast: 0.08 };

export interface ImageMetrics {
  brightness: number; // 0-100 mean luminance
  contrast: number; // 0-100 luminance spread
  saturation: number; // 0-100 mean chroma
  colorfulness: number; // 0-100 Hasler-Süsstrunk colourfulness
  temperature: "warm" | "cool" | "neutral";
  sharpness: number; // 0-100 variance-of-Laplacian
  qualityScore: number; // 1-10 weighted objective quality
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));



/** Parse a 24/32-bit BMP into a flat luminance grid + raw channel arrays. */
function parseBmp(buffer: Buffer) {
  if (buffer[0] !== 0x42 || buffer[1] !== 0x4d) throw new Error("Invalid BMP signature.");
  const dataOffset = buffer.readUInt32LE(10);
  const width = buffer.readInt32LE(18);
  const height = Math.abs(buffer.readInt32LE(22)); // negative height = top-down; irrelevant to our stats
  const bpp = buffer.readUInt16LE(28);
  if (bpp !== 24 && bpp !== 32) throw new Error(`Unsupported BMP depth: ${bpp}-bit`);
  if (width <= 0 || height <= 0) throw new Error("Invalid BMP dimensions.");

  const bytesPP = bpp / 8;
  const rowSize = Math.floor((bpp * width + 31) / 32) * 4; // rows padded to 4-byte boundary
  const n = width * height;
  const lum = new Float64Array(n);
  const R = new Float64Array(n), G = new Float64Array(n), B = new Float64Array(n);

  for (let y = 0; y < height; y++) {
    const rowStart = dataOffset + y * rowSize;
    for (let x = 0; x < width; x++) {
      const p = rowStart + x * bytesPP;
      if (p + 2 >= buffer.length) continue;
      const b = buffer[p], g = buffer[p + 1], r = buffer[p + 2];
      const i = y * width + x;
      R[i] = r; G[i] = g; B[i] = b;
      lum[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    }
  }
  return { width, height, lum, R, G, B, n };
}

function gaussianBlur(lum: Float64Array, width: number, height: number): Float64Array {
  const output = new Float64Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      // 3x3 Gaussian kernel convolution
      const sum =
        (lum[i - width - 1] + 2 * lum[i - width] + lum[i - width + 1] +
         2 * lum[i - 1]     + 4 * lum[i]         + 2 * lum[i + 1]     +
         lum[i + width - 1] + 2 * lum[i + width] + lum[i + width + 1]) / 16;
      output[i] = sum;
    }
  }
  // Keep borders identical
  for (let x = 0; x < width; x++) {
    output[x] = lum[x];
    output[(height - 1) * width + x] = lum[(height - 1) * width + x];
  }
  for (let y = 0; y < height; y++) {
    output[y * width] = lum[y * width];
    output[y * width + width - 1] = lum[y * width + width - 1];
  }
  return output;
}

function computeMetricsFromPixels(px: ReturnType<typeof parseBmp>): ImageMetrics {
  const { width, height, lum, R, G, B, n } = px;
  const smoothedLum = gaussianBlur(lum, width, height);

  let sumL = 0, sumL2 = 0, sumChroma = 0, crushed = 0, blown = 0;
  let sumR = 0, sumBch = 0;
  let sumRg = 0, sumYb = 0, sumRg2 = 0, sumYb2 = 0;
  for (let i = 0; i < n; i++) {
    const r = R[i], g = G[i], b = B[i], L = lum[i];
    sumL += L; sumL2 += L * L;
    sumR += r; sumBch += b;
    sumChroma += Math.max(r, g, b) - Math.min(r, g, b);
    if (L <= 5) crushed++; else if (L >= 250) blown++;
    const rg = r - g, yb = 0.5 * (r + g) - b;
    sumRg += rg; sumYb += yb; sumRg2 += rg * rg; sumYb2 += yb * yb;
  }

  const meanL = sumL / n;
  const stdL = Math.sqrt(Math.max(0, sumL2 / n - meanL * meanL));
  const brightness = clamp(Math.round((meanL / 255) * 100), 0, 100);
  const contrast = clamp(Math.round((stdL / 64) * 100), 0, 100);
  const saturation = clamp(Math.round((sumChroma / n / 255) * 100), 0, 100);

  // Hasler-Süsstrunk colourfulness (std + 0.3*mean of the opponent channels).
  const meanRg = sumRg / n, meanYb = sumYb / n;
  const stdRg = Math.sqrt(Math.max(0, sumRg2 / n - meanRg * meanRg));
  const stdYb = Math.sqrt(Math.max(0, sumYb2 / n - meanYb * meanYb));
  const C = Math.sqrt(stdRg * stdRg + stdYb * stdYb) + 0.3 * Math.sqrt(meanRg * meanRg + meanYb * meanYb);
  const colorfulness = clamp(Math.round(C), 0, 100);

  const meanR = sumR / n, meanB = sumBch / n;
  const temperature: "warm" | "cool" | "neutral" =
    meanR > meanB + 10 ? "warm" : meanB > meanR + 10 ? "cool" : "neutral";

  // Sharpness: variance of the 4-neighbour Laplacian on smoothed luminance (interior pixels).
  let lapSum = 0, lapSum2 = 0, lapN = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap = 4 * smoothedLum[i] - smoothedLum[i - 1] - smoothedLum[i + 1] - smoothedLum[i - width] - smoothedLum[i + width];
      lapSum += lap; lapSum2 += lap * lap; lapN++;
    }
  }
  const lapVar = lapN > 0 ? Math.max(0, lapSum2 / lapN - (lapSum / lapN) ** 2) : 0;
  const sharpness = clamp(Math.round((lapVar / SHARP_VAR_FULL) * 100), 0, 100);

  const qualityScore = scoreQuality({ brightness, contrast, saturation, colorfulness, sharpness, crushed: crushed / n, blown: blown / n });
  return { brightness, contrast, saturation, colorfulness, temperature, sharpness, qualityScore };
}

/** Transparent 1-10 quality from the objective metrics: blur, lighting, colour. */
function scoreQuality(m: {
  brightness: number; contrast: number; saturation: number;
  colorfulness: number; sharpness: number; crushed: number; blown: number;
}): number {
  const sharpnessScore = m.sharpness / 10;

  let exposure = 10;
  exposure -= Math.max(0, Math.abs(m.brightness - 55) - 15) * 0.25; // ideal ~40-70 (increased penalty)
  exposure -= Math.min(4, (m.crushed + m.blown) * 100 * 0.3); // blown/crushed pixels (increased penalty)
  if (m.contrast < 20) exposure -= (20 - m.contrast) * 0.15; // flat / hazy
  exposure = clamp(exposure, 0, 10);

  let color = clamp(2 + m.colorfulness * 0.08, 0, 10);
  if (m.saturation > 92) color -= (m.saturation - 92) * 0.2; // neon / clipped colour
  color = clamp(color, 0, 10);

  const contrast = clamp(m.contrast / 8, 0, 10);

  let q =
    sharpnessScore * WEIGHTS.sharpness +
    exposure * WEIGHTS.exposure +
    color * WEIGHTS.color +
    contrast * WEIGHTS.contrast;

  // If sharpness is very poor, cap the overall score to reflect that it is blurry/out-of-focus
  if (m.sharpness < 35) {
    q = Math.min(q, 4.5);
  }

  return clamp(Math.round(q * 10) / 10, 1, 10);
}

export async function extractImageMetrics(cloudinaryUrl: string): Promise<ImageMetrics> {
  // c_limit keeps aspect ratio and never upscales; f_bmp gives us raw pixels.
  const bmpUrl = cloudinaryUrl.includes("/upload/")
    ? cloudinaryUrl.replace("/upload/", `/upload/c_limit,w_${ANALYZE_DIM},h_${ANALYZE_DIM},f_bmp/`)
    : cloudinaryUrl;

  const res = await fetch(bmpUrl);
  if (!res.ok) throw new Error(`Failed to fetch analysis BMP (${res.status} ${res.statusText})`);
  const metrics = computeMetricsFromPixels(parseBmp(Buffer.from(await res.arrayBuffer())));
  console.log(`[Metrics] ${cloudinaryUrl.split("/").pop()}:`, metrics);
  return metrics;
}

// --- self-check: `node --experimental-strip-types -e "import('./lib/metrics.ts').then(m=>m.demo())"`
function buildBmp(width: number, height: number, pixel: (x: number, y: number) => [number, number, number]): Buffer {
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const buf = Buffer.alloc(54 + rowSize * height);
  buf.write("BM", 0);
  buf.writeUInt32LE(buf.length, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y);
      const p = 54 + y * rowSize + x * 3;
      buf[p] = clamp(b, 0, 255); buf[p + 1] = clamp(g, 0, 255); buf[p + 2] = clamp(r, 0, 255);
    }
  }
  return buf;
}

export function demo() {
  const D = 64;
  const m = (fn: (x: number, y: number) => [number, number, number]) => computeMetricsFromPixels(parseBmp(buildBmp(D, D, fn)));
  const sharp = m((x, y) => { const v = ((x + y) % 2) * 255; return [v, v, v]; }); // checkerboard
  const flat = m(() => [128, 128, 128]); // uniform grey
  const dark = m(() => [8, 8, 8]); // underexposed
  const blown = m(() => [252, 252, 252]); // overexposed
  const warm = m(() => [200, 120, 60]);
  const cool = m(() => [60, 120, 200]);

  console.assert(sharp.sharpness > flat.sharpness, "sharp should beat flat on sharpness");
  console.assert(sharp.qualityScore > flat.qualityScore, "sharp should score higher than flat");
  console.assert(dark.qualityScore < flat.qualityScore, "underexposed should be penalised");
  console.assert(blown.brightness > 95 && dark.brightness < 10, "brightness tracks exposure");
  console.assert(warm.temperature === "warm" && cool.temperature === "cool", "temperature classification");
  console.log("metrics demo OK", { sharp: sharp.qualityScore, flat: flat.qualityScore, dark: dark.qualityScore, blown: blown.qualityScore });
}
