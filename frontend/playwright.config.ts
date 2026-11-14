// Cấu hình Playwright cho kiểm thử trên trình duyệt thật (Chromium), dùng chain Anvil thật.
// Chạy: npm run test:e2e   (build production rồi phục vụ bằng `vite preview`).
// Các test dùng chung một chain nên chạy tuần tự (workers: 1), theo thứ tự tên file 01 → 04.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx vite preview --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
