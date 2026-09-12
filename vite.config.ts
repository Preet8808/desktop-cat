import { defineConfig } from "vite";

// Tauri expects a fixed port and relative asset paths.
export default defineConfig({
  base: "./",
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/target/**"],
    },
  },
  build: {
    outDir: "dist",
    target: "esnext",
    minify: "esbuild",
  },
});
