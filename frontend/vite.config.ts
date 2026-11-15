// Cấu hình Vite (công cụ build và dev server) + Vitest (chạy unit test).
import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin, ResolvedConfig } from "vite";
import { configuredRpcUrls, formatHeaders, securityHeaders } from "./src/lib/securityPolicy.ts";

// Vite preview không tự hiểu _headers của Pages: phục vụ chính artifact đã build để kiểm thực tế.
function pagesHeaders(env: Record<string, string | undefined>): Plugin {
  let config: ResolvedConfig;
  return {
    name: "govvote-pages-headers",
    configResolved(value) {
      config = value;
    },
    writeBundle() {
      writeFileSync(
        resolve(config.root, config.build.outDir, "_headers"),
        formatHeaders(securityHeaders(configuredRpcUrls(env))),
      );
    },
    configurePreviewServer(server) {
      const contents = readFileSync(resolve(config.root, config.build.outDir, "_headers"), "utf8");
      const headers = contents
        .split("\n")
        .filter((line) => line.startsWith("  "))
        .map((line) => {
          const colon = line.indexOf(":");
          return [line.slice(0, colon).trim(), line.slice(colon + 1).trim()] as const;
        });
      server.middlewares.use((_request, response, next) => {
        for (const [name, value] of headers) response.setHeader(name, value);
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), pagesHeaders(loadEnv(mode, process.cwd(), "VITE_"))],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  test: {
    // Unit test chỉ dùng hàm thuần (pure function), không cần DOM.
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
}));
