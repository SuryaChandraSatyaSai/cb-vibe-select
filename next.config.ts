import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // face-api + the wasm tfjs backend load .wasm/native assets at runtime; keep them
  // out of the Server Components bundle so Next resolves them via native require()
  // instead of mangling the asset paths. (canvas + mongoose are already auto-external.)
  serverExternalPackages: [
    "@vladmandic/face-api",
    "@tensorflow/tfjs",
    "@tensorflow/tfjs-backend-wasm",
  ],
};

export default nextConfig;
