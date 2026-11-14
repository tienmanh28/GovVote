// Cấu hình Vite (công cụ build và dev server) + Vitest (chạy unit test).
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  test: {
    // Unit test chỉ dùng hàm thuần (pure function), không cần DOM.
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
