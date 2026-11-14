// Bộ kiểm chứng riêng: mọi RPC đều giả, không chạy các E2E có giao dịch.
import { defineConfig } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
export default defineConfig({
 testDir: "validation", testIgnore: "p3-fix-04.spec.ts", workers: 1, fullyParallel: false,
 outputDir: mkdtempSync(join(tmpdir(), "govvote-p3fix01-")),
 timeout: 60_000, expect: { timeout: 25_000 }, reporter: "list",
 use: { baseURL: "http://127.0.0.1:4173", browserName: "chromium" },
 webServer: { command: "node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort", url: "http://127.0.0.1:4173", reuseExistingServer: false },
});
