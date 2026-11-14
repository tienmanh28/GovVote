// Chỉ cấu hình endpoint giả cho tests, không điền endpoint production thay Owner.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawn } from "node:child_process";
const out = mkdtempSync(join(tmpdir(), "govvote-fallback-build-"));
execFileSync(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "build", "--outDir", out, "--emptyOutDir"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      VITE_RPC_URL: "http://primary.invalid:8545",
      VITE_RPC_FALLBACK_URLS: "http://fallback.invalid:8545",
    },
  },
);
const child = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    "4174",
    "--strictPort",
    "--outDir",
    out,
  ],
  { stdio: "inherit" },
);
process.on("SIGTERM", () => {
  child.kill("SIGTERM");
  process.exit();
});
child.on("exit", (code) => process.exit(code ?? 0));
