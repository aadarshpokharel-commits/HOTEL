import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.indexOf("/node_modules/three/") !== -1) return "three-core";
          if (
            id.indexOf("/node_modules/@react-three/") !== -1 ||
            id.indexOf("/node_modules/three-stdlib/") !== -1
          ) {
            return "three-helpers";
          }
          if (
            id.indexOf("/node_modules/framer-motion/") !== -1 ||
            id.indexOf("/node_modules/motion-dom/") !== -1 ||
            id.indexOf("/node_modules/motion-utils/") !== -1
          ) {
            return "motion";
          }
          return undefined;
        },
      },
    },
  },
});
