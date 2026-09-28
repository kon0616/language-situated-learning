import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { createDeepSeekMiddleware } from "./src/server/deepseek.ts";
import { resolve } from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const api = createDeepSeekMiddleware({ apiKey: env.DEEPSEEK_API_KEY, model: env.DEEPSEEK_MODEL,
    configFile: resolve(process.cwd(), ".language-web/api.json") });
  return { server: { fs: { deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "**/.language-web/**"] },
    watch: { ignored: ["**/.language-web/**"] } }, plugins: [react(), tailwindcss(), {
    name: "language-web-local-api",
    configureServer(server) { server.middlewares.use("/api", api); },
    configurePreviewServer(server) { server.middlewares.use("/api", api); },
  }] };
});
