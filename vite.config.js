import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "es2019",
    rollupOptions: {
      output: {
        // Split three into its own chunk so app-code changes don't invalidate
        // the (large, rarely-changing) vendor cache entry.
        manualChunks: { three: ["three"] },
      },
    },
  },
});
