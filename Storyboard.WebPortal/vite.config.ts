import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative asset paths keep the bundle mount-agnostic (for example /client).
  base: "./",
  plugins: [react()],
  // Expose existing config contracts as static files under /orchestration/*
  publicDir: "config",
  build: {
    minify: true,
    sourcemap: true,
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.indexOf("node_modules") < 0) {
            return undefined;
          }

          const normalizedId = id.replace(/\\/g, "/");
          const pixiPackageMarker = "/node_modules/@pixi/";
          const pixiPackageStart = normalizedId.indexOf(pixiPackageMarker);
          if (pixiPackageStart >= 0) {
            const packagePath = normalizedId.slice(pixiPackageStart + pixiPackageMarker.length);
            const packageName = packagePath.split("/")[0] || "core";
            return `vendor-pixi-${packageName}`;
          }

          if (id.indexOf("node_modules/pixi.js") >= 0) {
            return "vendor-pixi-entry";
          }

          if (id.indexOf("node_modules/react") >= 0 || id.indexOf("node_modules/react-dom") >= 0) {
            return "vendor-react";
          }

          return "vendor";
        }
      }
    }
  },
  test: {
    execArgv: ["--no-webstorage"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["node_modules/**", "visual-tests/**", "src/gameRenderer/testing/**"]
  }
});
