// Self-hosted face recognition — no cloud, no per-image cost, faces never leave the server.
// We use face-api with the tfjs *WASM* backend (not tfjs-node): tfjs-node has no prebuilt
// binary for Node 22 on Windows and would need a C++ toolchain to compile. The wasm kernels
// and the model weights both load from local node_modules, so this is fully offline.
//
// Recipe mirrors the package's own demos: decode with node-canvas -> rgb tensor
// (demo/node-wasm.js), detect + 128-d descriptor, match by euclidean distance.

import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import * as faceapi from "@vladmandic/face-api/dist/face-api.node-wasm.js";
import * as tf from "@tensorflow/tfjs"; // same cached singleton face-api requires internally, but fully typed
import * as wasm from "@tensorflow/tfjs-backend-wasm";
import * as canvas from "canvas";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const MATCH_THRESHOLD = 0.6; // max euclidean distance to accept an identity (face-api's standard default)
const ANALYZE_WIDTH = 1600; // cap the decoded image (via Cloudinary resize). Higher = small faces in group shots keep detail

let ready: Promise<void> | null = null;

/** Load wasm backend + the 3 models we need, once per process (lazy singleton, like lib/db.ts). */
function initOnce(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    const wasmDir =
      path.join(__dirname, "..", "node_modules", "@tensorflow", "tfjs-backend-wasm", "dist") + path.sep;
    wasm.setWasmPaths(wasmDir); // local disk, not a CDN
    await tf.setBackend("wasm");
    await tf.ready();
    const modelPath = path.join(__dirname, "..", "node_modules", "@vladmandic", "face-api", "model");
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);
  })();
  return ready;
}

const detectorOptions = () => new faceapi.SsdMobilenetv1Options({ minConfidence: 0.15, maxResults: 20 });

/** Decode image bytes -> [h,w,3] int32 tensor. Caller must tf.dispose() it.
 *  ponytail: Array.from copies the whole RGBA buffer; cap is w=1024. Matches the tested
 *  node-wasm demo (tf.browser.fromPixels is unreliable on the node+wasm path). */
async function decode(buffer: Buffer) {
  const img = await canvas.loadImage(buffer);
  const c = canvas.createCanvas(img.width, img.height);
  c.getContext("2d").drawImage(img as any, 0, 0);
  const { data, width, height } = c.getContext("2d").getImageData(0, 0, img.width, img.height);
  return tf.tidy(() => {
    const rgba = tf.tensor(Array.from(data), [height, width, 4], "int32");
    const [r, g, b] = tf.split(rgba, 4, 2);
    // `as any`: face-api bundles its own tfjs-core types, so its Tensor3D is nominally
    // distinct from this @tensorflow/tfjs one even though it's the same runtime singleton.
    return tf.squeeze(tf.stack([r, g, b], 2)) as any;
  });
}

export interface FaceMatch {
  personId: string;
  distance: number; // lower = closer; honest confidence, <= MATCH_THRESHOLD
  box: { x: number; y: number; width: number; height: number };
}

/** Single most-confident face -> 128 floats, or null if no face. Used when enrolling an avatar. */
export async function computeDescriptor(buffer: Buffer): Promise<number[] | null> {
  await initOnce();
  const tensor = await decode(buffer);
  try {
    const det = await faceapi.detectSingleFace(tensor, detectorOptions()).withFaceLandmarks().withFaceDescriptor();
    return det ? Array.from(det.descriptor as Float32Array) : null;
  } finally {
    tf.dispose(tensor);
  }
}

/** Build a FaceMatcher from seeded people; label = personId. null if nobody is seeded.
 *  Each person can have several reference descriptors (angles); FaceMatcher uses the closest.
 *  maxDistance defaults to MATCH_THRESHOLD; pass a large value for diagnostics (see raw distances). */
export function buildMatcher(people: Array<{ id: string; descriptors: number[][] }>, maxDistance: number = MATCH_THRESHOLD) {
  const labeled = people
    .map((p) => {
      const ds = (p.descriptors || []).filter((d) => Array.isArray(d) && d.length === 128).map((d) => Float32Array.from(d));
      return ds.length ? new faceapi.LabeledFaceDescriptors(p.id, ds) : null;
    })
    .filter((x): x is any => x !== null);
  return labeled.length ? new faceapi.FaceMatcher(labeled, maxDistance) : null;
}

/** Detect every face in an image and return the ones that match a seeded person.
 *  Unknown faces are dropped (no fabricated identities). */
export async function recognizeFaces(buffer: Buffer, matcher: any): Promise<FaceMatch[]> {
  if (!matcher) return [];
  await initOnce();
  const tensor = await decode(buffer);
  try {
    const results = await faceapi.detectAllFaces(tensor, detectorOptions()).withFaceLandmarks().withFaceDescriptors();
    return results
      .map((r: any): FaceMatch | null => {
        const m = matcher.findBestMatch(r.descriptor);
        if (m.label === "unknown") return null;
        const b = r.detection.box;
        return {
          personId: m.label,
          distance: Math.round(m.distance * 1000) / 1000,
          box: { x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height) },
        };
      })
      .filter((m: FaceMatch | null): m is FaceMatch => m !== null);
  } finally {
    tf.dispose(tensor);
  }
}

/** Fetch a size-capped copy of a Cloudinary image as a Buffer (reused by the queue). */
export async function fetchAnalysisBuffer(cloudinaryUrl: string): Promise<Buffer> {
  const url = cloudinaryUrl.includes("/upload/")
    ? cloudinaryUrl.replace("/upload/", `/upload/c_limit,w_${ANALYZE_WIDTH}/`)
    : cloudinaryUrl;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image for face recognition (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

// --- self-check: `node --experimental-strip-types -e "import('./lib/face.ts').then(m=>m.demo())"`
// Proves the whole pipeline end-to-end: decode -> detect -> 128-d descriptor -> a face
// matches itself (distance ~0) under the threshold.
export async function demo() {
  const fs = require("node:fs");
  const sample = path.join(__dirname, "..", "node_modules", "@vladmandic", "face-api", "demo", "sample1.jpg");
  const buffer = fs.readFileSync(sample);
  const descriptor = await computeDescriptor(buffer);
  console.assert(descriptor !== null && descriptor.length === 128, "descriptor is 128 floats");
  const matcher = buildMatcher([{ id: "sample-person", descriptors: [descriptor!] }]);
  const matches = await recognizeFaces(buffer, matcher);
  console.assert(matches.some((m) => m.personId === "sample-person" && m.distance < MATCH_THRESHOLD), "a face matches itself");
  console.log("face demo OK", { faces: matches.length, closest: matches[0]?.distance });
}
