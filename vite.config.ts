import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { assistPlugin } from "./src/assist/vite-plugin";

export default defineConfig(({ mode }) => {
  // Lift non-VITE_ secrets into process.env for the assist middleware.
  const env = loadEnv(mode, process.cwd(), "");
  for (const key of [
    "XAI_API_KEY",
    "GROK_API_KEY",
    "XAI_MODEL",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REDIRECT_URI",
    "PID_PORT",
  ]) {
    if (env[key] && !process.env[key]) process.env[key] = env[key];
  }

  // 0.0.0.0 → phone on LAN can hit http://<pc-ip>:4000/
  // Board is disk-backed, so desktop + phone stay in sync via /api/board.
  const host = process.env.PID_HOST?.trim() || "0.0.0.0";
  const port = Number(process.env.PID_PORT || env.PID_PORT || 4000);
  process.env.PID_PORT = String(port);

  return {
    plugins: [react(), tailwindcss(), assistPlugin()],
    server: { host, port, strictPort: true },
    preview: { host, port, strictPort: true },
  };
});
