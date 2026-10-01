import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/unanswered/",
  plugins: [react()],
  build: {
    // Older iOS Safari must run the mobile report link.
    target: ["es2020", "safari15"],
  },
  preview: {
    // Temporary: the phone test reaches `vite preview` through a cloudflared quick tunnel.
    allowedHosts: [".trycloudflare.com"],
  },
});