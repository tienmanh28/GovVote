// Sinh src/abi/*.ts từ artifact của `forge build` (out/), KHÔNG viết ABI bằng tay.
// Chạy: cd frontend && npm run sync-abi   (cần chạy `forge build` ở gốc repo trước).
// Mỗi file ABI ghi rõ nguồn và sha256 của chuỗi ABI, để đối chiếu khi contract đổi.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const targets = [
  { artifact: "out/GovVote.sol/GovVote.json", out: "src/abi/govVote.ts", name: "govVoteAbi" },
  { artifact: "out/GovToken.sol/GovToken.json", out: "src/abi/govToken.ts", name: "govTokenAbi" },
];

for (const t of targets) {
  const abi = JSON.parse(readFileSync(join(root, t.artifact), "utf8")).abi;
  const json = JSON.stringify(abi, null, 2);
  const sha = createHash("sha256").update(JSON.stringify(abi)).digest("hex");
  const body =
    `// TỰ SINH bởi frontend/scripts/sync-abi.mjs. KHÔNG SỬA TAY.\n` +
    `// Nguồn: ${t.artifact} (forge build, solc 0.8.28), trường "abi".\n` +
    `// sha256(JSON.stringify(abi)) = ${sha}\n` +
    `export const ${t.name} = ${json} as const;\n`;
  writeFileSync(join(here, "..", t.out), body);
  console.log(`${t.out}: ${abi.length} mục, sha256 ${sha}`);
}
