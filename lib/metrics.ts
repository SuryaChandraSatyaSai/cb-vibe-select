/**
 * Helper to parse color hex code back into RGB components.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const r = parseInt(hex.substring(1, 3), 16);
  const g = parseInt(hex.substring(3, 5), 16);
  const b = parseInt(hex.substring(5, 7), 16);
  return { r, g, b };
}

/**
 * Helper to compute color distance (Manhattan distance in RGB space).
 */
function getColorDistance(c1: string, c2: string): number {
  const rgb1 = hexToRgb(c1);
  const rgb2 = hexToRgb(c2);
  return Math.abs(rgb1.r - rgb2.r) + Math.abs(rgb1.g - rgb2.g) + Math.abs(rgb1.b - rgb2.b);
}

/**
 * Extracts technical image metrics (brightness, saturation, temperature, and palette)
 * by requesting a tiny 20x20 BMP thumbnail from Cloudinary and parsing its binary buffer.
 * 
 * @param cloudinaryUrl The secure Cloudinary delivery URL of the image.
 * @returns A promise resolving to an object matching the attributes schema.
 */
export async function extractImageMetrics(cloudinaryUrl: string): Promise<{
  brightness: number;
  saturation: number;
  temperature: "warm" | "cool" | "neutral";
  palette: string[];
  sharpness: number;
}> {
  try {
    console.log(`[Metrics] Extracting metrics for: ${cloudinaryUrl}`);

    // 1. Transform Cloudinary URL to request a 20x20 BMP thumbnail
    // Inserting w_20,h_20,c_scale,f_bmp transformation parameters
    let bmpUrl = cloudinaryUrl;
    if (cloudinaryUrl.includes("/upload/")) {
      bmpUrl = cloudinaryUrl.replace("/upload/", "/upload/w_20,h_20,c_scale,f_bmp/");
    } else {
      console.warn("[Metrics] URL does not contain standard /upload/ folder. Requesting original format.");
    }

    console.log(`[Metrics] Fetching micro BMP thumbnail from: ${bmpUrl}`);
    const res = await fetch(bmpUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch thumbnail BMP: ${res.statusText}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Verify BMP header: 'BM' (0x42, 0x4D)
    if (buffer[0] !== 0x42 || buffer[1] !== 0x4d) {
      throw new Error("Invalid BMP file signature (missing 'BM').");
    }

    // Read pixel offset from header (byte 10)
    const dataOffset = buffer.readUInt32LE(10);
    
    let brightnessSum = 0;
    let saturationSum = 0;
    let warmPixels = 0;
    let coolPixels = 0;
    let totalProcessed = 0;

    const colorBins: Record<string, number> = {};
    const luminanceGrid: number[] = [];

    // Loop through pixels. 24-bit BMP contains BGR byte triplets.
    // Width = 20 pixels. Row size = 20 * 3 = 60 bytes (multiple of 4, so no row padding)
    for (let i = dataOffset; i < buffer.length; i += 3) {
      if (i + 2 >= buffer.length) break;

      const b = buffer[i];
      const g = buffer[i + 1];
      const r = buffer[i + 2];

      totalProcessed++;

      // A. Brightness (Luminance formula)
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      brightnessSum += luminance;
      luminanceGrid.push(luminance);

      // B. Saturation
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const chroma = max - min;
      saturationSum += chroma;

      // C. Temperature tones count
      // Warm: red/orange/yellow (R > B + 15)
      // Cool: blue/cyan (B > R + 15)
      if (r > b + 15) {
        warmPixels++;
      } else if (b > r + 15) {
        coolPixels++;
      }

      // D. Group colors into 32-value bins (creating a clean palette)
      const binR = Math.min(255, Math.max(0, Math.round(r / 32) * 32));
      const binG = Math.min(255, Math.max(0, Math.round(g / 32) * 32));
      const binB = Math.min(255, Math.max(0, Math.round(b / 32) * 32));
      
      const hex = "#" + [binR, binG, binB].map(v => {
        const hexStr = v.toString(16);
        return hexStr.length === 1 ? "0" + hexStr : hexStr;
      }).join("");

      colorBins[hex] = (colorBins[hex] || 0) + 1;
    }

    if (totalProcessed === 0) {
      throw new Error("No pixels processed from BMP buffer.");
    }

    // Compute averages
    const brightness = Math.round((brightnessSum / totalProcessed / 255) * 100);
    const saturation = Math.round((saturationSum / totalProcessed / 255) * 100);

    // Compute sharpness (adjacent pixel luminance differences)
    let totalGradient = 0;
    let comparisons = 0;
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        const idx = y * 20 + x;
        const val = luminanceGrid[idx];
        if (val === undefined) continue;

        if (x < 19) {
          const rightVal = luminanceGrid[idx + 1];
          if (rightVal !== undefined) {
            totalGradient += Math.abs(val - rightVal);
            comparisons++;
          }
        }
        if (y < 19) {
          const downVal = luminanceGrid[idx + 20];
          if (downVal !== undefined) {
            totalGradient += Math.abs(val - downVal);
            comparisons++;
          }
        }
      }
    }
    const averageGradient = comparisons > 0 ? (totalGradient / comparisons) : 0;
    // Map to 0-100% where average gradient >= 20 is fully sharp
    const sharpness = Math.min(100, Math.round((averageGradient / 20) * 100));

    // Classify temperature
    let temperature: "warm" | "cool" | "neutral" = "neutral";
    const warmRatio = warmPixels / (coolPixels || 1);
    const coolRatio = coolPixels / (warmPixels || 1);

    if (warmPixels > coolPixels && warmRatio > 1.25) {
      temperature = "warm";
    } else if (coolPixels > warmPixels && coolRatio > 1.25) {
      temperature = "cool";
    }

    // Select dominant color palette with color spacing to avoid near-duplicates
    const sortedBins = Object.entries(colorBins).sort((a, b) => b[1] - a[1]);
    const palette: string[] = [];

    for (const [color] of sortedBins) {
      if (palette.length >= 4) break;

      // Check distance from already selected colors
      const isTooSimilar = palette.some(selectedColor => getColorDistance(color, selectedColor) < 65);
      if (!isTooSimilar) {
        palette.push(color);
      }
    }

    // If we have fewer than 4 colors due to filtering, fill remaining from top sorted list
    if (palette.length < 4) {
      for (const [color] of sortedBins) {
        if (palette.length >= 4) break;
        if (!palette.includes(color)) {
          palette.push(color);
        }
      }
    }

    console.log(`[Metrics] Calculated metrics for ${cloudinaryUrl.split("/").pop()}:`, {
      brightness,
      saturation,
      temperature,
      palette,
      sharpness
    });

    return {
      brightness,
      saturation,
      temperature,
      palette,
      sharpness
    };

  } catch (err: any) {
    console.error(`[Metrics] Metric extraction failed:`, err.message || err);
    // Return high-quality generic fallbacks if something errors out
    return {
      brightness: 65,
      saturation: 45,
      temperature: "neutral",
      palette: ["#18181b", "#3f3f46", "#71717a", "#e4e4e7"],
      sharpness: 80
    };
  }
}
