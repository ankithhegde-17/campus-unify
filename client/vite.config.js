import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  // Inline config stops Vite from picking up a stray postcss.config.js in a parent folder.
  css: { postcss: {} },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:5050", changeOrigin: true } },
  },
});
