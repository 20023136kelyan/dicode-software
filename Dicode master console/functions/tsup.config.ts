import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  splitting: false,
  sourcemap: true,
  clean: true,
  target: "node20",
  platform: "node",
  dts: false,
  // Bundle everything by default (including @ alias) except the explicit externals below
  noExternal: [/(.*)/],
  external: [
    "firebase-functions",
    "firebase-admin", 
    "express",
    "openai"
  ],
});
