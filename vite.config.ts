import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/unanswered/",
  plugins: [react()],
  build: {
    // Older iOS Safari must run the mobile report link.
    target: ["es2020", "safari15"],
    // The web catalogue is its own HTML page, so /unanswered/catalog/ is a real
    // file on GitHub Pages and survives a direct visit or a refresh.
    rolldownOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        catalog: fileURLToPath(new URL("./catalog/index.html", import.meta.url)),
      },
    },
  },
  preview: {
    // Temporary: the phone test reaches `vite preview` through a cloudflared quick tunnel.
    allowedHosts: [".trycloudflare.com"],
  },
});