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
