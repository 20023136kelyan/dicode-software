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
  // Removed external: ["@/app"] so tsup will try to bundle the imported code
  noExternal: [/(.*)/], // Bundle everything except node_modules marked as external by default? 
  // Actually, tsup by default bundles relative imports.
  // The issue is likely that @/ aliases are treated as external packages if not resolved.
  // We don't want to bundle firebase-functions or firebase-admin, so let's be specific.
  external: [
    "firebase-functions",
    "firebase-admin", 
    "express",
    "openai"
  ],
});
