const HF_TOKEN = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_TOKEN || "";

/**
 * Queries Hugging Face Inference API for image aesthetic scoring.
 * 
 * Attempts to query:
 * 1. somepago/AestheticSigLIP (custom SigLIP-based aesthetic model)
 * 2. cafeai/cafe_aesthetic (fallback image classification model, mapped to 1-10)
 * 
 * @param imageBuffer The binary buffer of the image.
 * @returns A promise resolving to a score between 1.0 and 10.0.
 */
export async function queryAestheticScore(imageBuffer: Buffer): Promise<number> {
  const models = [
    {
      id: "somepago/AestheticSigLIP",
      parse: (data: any): number => {
        // Handle various potential output shapes of aesthetic predictor regression heads
        if (Array.isArray(data)) {
          const first = data[0];
          if (first && typeof first.score === "number") {
            return first.score;
          }
          if (first && typeof first.label === "string" && !isNaN(parseFloat(first.label))) {
            return parseFloat(first.label);
          }
        } else if (typeof data === "number") {
          return data;
        } else if (data && typeof data.score === "number") {
          return data.score;
        }
        throw new Error("Could not parse numeric score from AestheticSigLIP output.");
      }
    },
    {
      id: "cafeai/cafe_aesthetic",
      parse: (data: any): number => {
        // cafeai/cafe_aesthetic is a classifier returning:
        // [{ label: "aesthetic", score: 0.85 }, { label: "not_aesthetic", score: 0.15 }]
        if (Array.isArray(data)) {
          const aestheticObj = data.find((item: any) => item.label === "aesthetic");
          if (aestheticObj && typeof aestheticObj.score === "number") {
            // Map probability [0, 1] to a rating [1, 10]
            const score = aestheticObj.score * 9 + 1;
            return Math.round(score * 10) / 10;
          }
        }
        throw new Error("Could not parse aesthetic probability from cafe_aesthetic output.");
      }
    }
  ];

  let lastError: any = null;

  for (const model of models) {
    try {
      console.log(`[HF API] Querying aesthetic score model: ${model.id}...`);
      const url = `https://api-inference.huggingface.co/models/${model.id}`;
      const headers: Record<string, string> = {
        "Content-Type": "application/octet-stream",
      };
      if (HF_TOKEN) {
        headers["Authorization"] = `Bearer ${HF_TOKEN}`;
      }

      const response = await fetch(url, {
        headers,
        method: "POST",
        body: new Uint8Array(imageBuffer),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HF Inference API returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log(`[HF API] Model ${model.id} returned data:`, JSON.stringify(data).substring(0, 150));

      const score = model.parse(data);
      if (typeof score === "number" && !isNaN(score)) {
        return Math.max(1.0, Math.min(10.0, score));
      }
    } catch (err: any) {
      console.warn(`[HF API] Warning: Model ${model.id} request failed:`, err.message || err);
      lastError = err;
    }
  }

  throw lastError || new Error("All Hugging Face aesthetic models failed to execute.");
}

/**
 * Queries Hugging Face Inference API for image tagging.
 * 
 * Attempts to query:
 * 1. xinyu1205/recognize-anything-plus-model (RAM++)
 * 2. google/vit-base-patch16-224 (fallback classification)
 * 3. microsoft/resnet-50 (fallback classification)
 * 
 * @param imageBuffer The binary buffer of the image.
 * @returns A promise resolving to an array of string tags.
 */
export async function queryImageTags(imageBuffer: Buffer): Promise<string[]> {
  const models = [
    {
      id: "xinyu1205/recognize-anything-plus-model",
      parse: (data: any): string[] => {
        if (Array.isArray(data)) {
          return data
            .filter((item: any) => typeof item.label === "string" && (item.score === undefined || item.score > 0.12))
            .map((item: any) => item.label.toLowerCase().trim());
        }
        if (typeof data === "string") {
          return data.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
        }
        if (data && typeof data.tags === "string") {
          return data.tags.split(",").map((t: string) => t.trim().toLowerCase()).filter(Boolean);
        }
        if (data && Array.isArray(data.tags)) {
          return data.tags.map((t: any) => String(t).trim().toLowerCase()).filter(Boolean);
        }
        throw new Error("Could not parse tags from RAM++ output shape.");
      }
    },
    {
      id: "google/vit-base-patch16-224",
      parse: (data: any): string[] => {
        if (Array.isArray(data)) {
          return data
            .filter((item: any) => typeof item.label === "string" && (item.score === undefined || item.score > 0.12))
            .map((item: any) => item.label.toLowerCase().trim());
        }
        throw new Error("Could not parse tags from ViT output shape.");
      }
    },
    {
      id: "microsoft/resnet-50",
      parse: (data: any): string[] => {
        if (Array.isArray(data)) {
          return data
            .filter((item: any) => typeof item.label === "string" && (item.score === undefined || item.score > 0.12))
            .map((item: any) => item.label.toLowerCase().trim());
        }
        throw new Error("Could not parse tags from ResNet output shape.");
      }
    }
  ];

  let lastError: any = null;

  for (const model of models) {
    try {
      console.log(`[HF API] Querying image tags model: ${model.id}...`);
      const url = `https://api-inference.huggingface.co/models/${model.id}`;
      const headers: Record<string, string> = {
        "Content-Type": "application/octet-stream",
      };
      if (HF_TOKEN) {
        headers["Authorization"] = `Bearer ${HF_TOKEN}`;
      }

      const response = await fetch(url, {
        headers,
        method: "POST",
        body: new Uint8Array(imageBuffer),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HF Inference API returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log(`[HF API] Model ${model.id} returned tags data:`, JSON.stringify(data).substring(0, 150));

      const tags = model.parse(data);
      if (Array.isArray(tags) && tags.length > 0) {
        // Remove duplicate tags, filter sub-commas or too long labels
        const uniqueTags = Array.from(new Set(tags))
          .map(t => t.split(",")[0].trim())
          .filter(t => t.length > 0 && t.length < 30);
        return uniqueTags;
      }
    } catch (err: any) {
      console.warn(`[HF API] Warning: Tag model ${model.id} failed:`, err.message || err);
      lastError = err;
    }
  }

  throw lastError || new Error("All Hugging Face tagging models failed to execute.");
}

/**
 * Queries Hugging Face Inference API for object detection with bounding boxes.
 * 
 * Target model: facebook/detr-resnet-50 (DEtection TRansformer)
 * 
 * @param imageBuffer The binary buffer of the image.
 * @returns A promise resolving to an array of object labels, confidence scores, and bounding boxes.
 */
export async function queryObjectDetection(imageBuffer: Buffer): Promise<any[]> {
  try {
    console.log(`[HF API] Querying object detection model: facebook/detr-resnet-50...`);
    const url = "https://api-inference.huggingface.co/models/facebook/detr-resnet-50";
    const headers: Record<string, string> = {
      "Content-Type": "application/octet-stream",
    };
    if (HF_TOKEN) {
      headers["Authorization"] = `Bearer ${HF_TOKEN}`;
    }

    const response = await fetch(url, {
      headers,
      method: "POST",
      body: new Uint8Array(imageBuffer),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HF Inference API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log(`[HF API] Object detection returned:`, JSON.stringify(data).substring(0, 150));

    if (Array.isArray(data)) {
      // Filter out detections with confidence below 55% and ensure boxes exist
      return data
        .filter((item: any) => typeof item.score === "number" && item.score >= 0.55 && item.box)
        .map((item: any) => ({
          label: String(item.label).toLowerCase().trim(),
          score: Math.round(item.score * 100) / 100,
          box: {
            xmin: Math.round(item.box.xmin),
            ymin: Math.round(item.box.ymin),
            xmax: Math.round(item.box.xmax),
            ymax: Math.round(item.box.ymax)
          }
        }));
    }
    return [];
  } catch (err: any) {
    console.warn("[HF API] Warning: Object detection request failed:", err.message || err);
    return [];
  }
}
