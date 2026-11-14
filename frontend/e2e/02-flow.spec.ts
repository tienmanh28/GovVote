// Kịch bản E2E trên chain thật (Bước 9):
//   Alice delegate → Alice tạo proposal → (mine qua snapshot) → Alice vote For, Bob vote Against
//   → tally trên UI khớp getProposal on-chain → (mine 12 block) → scripts/verify ra VERIFIED.
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { formatGov } from "../src/lib/format.ts";
import {
  ACCOUNTS,
  GOV_TOKEN,
  GOV_VOTE,
  connect,
  installFakeWallet,
  mine,
  publicClient,
  readProposal,
} from "./helpers.ts";

const GOV = 10n ** 18n;

test("Alice delegate → tạo proposal → vote; tally khớp getProposal và scripts/verify", async ({
  page,
  browser,
}) => {
  test.setTimeout(240_000);
  await installFakeWallet(page, { account: ACCOUNTS.alice });

  // 1. Alice delegate cho chính mình.
  await connect(page, "#/wallet");
  await page.getByRole("button", { name: "Delegate cho chính mình" }).click();
  await expect(page.getByTestId("tx-status")).toHaveAttribute("data-status", "SUCCESS");
  const delegateHash = (await page.getByTestId("tx-hash").textContent()) as `0x${string}`;
  const delegateReceipt = await publicClient.getTransactionReceipt({ hash: delegateHash });
  expect(delegateReceipt.status).toBe("success");
  expect(delegateReceipt.to?.toLowerCase()).toBe(GOV_TOKEN.toLowerCase());
  await expect(page.getByTestId("delegatee")).toHaveText("Chính ví này");

  // 2. Alice tạo proposal qua form.
  const title = "E2E Phase 3: tài trợ workshop ZK cho cộng đồng";
  const description =
    "Proposal tạo từ Playwright qua ví giả chuyển tiếp tới Anvil.\nDòng thứ hai có dấu: ệ ơ ư đ.";
  await page.goto("/#/create");
  await expect(page.getByTestId("current-votes")).toHaveText(formatGov(400_000n * GOV));
  await page.getByLabel(/Tiêu đề/).fill(title);
  await page.getByLabel(/Mô tả/).fill(description);
  await expect(page.getByTestId("title-bytes")).toHaveText(
    `${new TextEncoder().encode(title).length}/100 byte`,
  );
  await page.getByRole("button", { name: "Gửi proposal" }).click();
  await expect(page.getByTestId("tx-status")).toHaveAttribute("data-status", "SUCCESS");
  const proposeHash = await page.getByTestId("tx-hash").textContent();
  const href = await page.getByTestId("created-link").getAttribute("href");
  const id = BigInt(href!.split("/").pop()!);
  const created = await readProposal(id);
  expect(created.title).toBe(title);
  expect(created.description).toBe(description);
  expect(created.proposer.toLowerCase()).toBe(ACCOUNTS.alice.toLowerCase());

  // 3. Tiến qua snapshot: cần block > snapshotBlock.
  const now = await publicClient.getBlockNumber();
  await mine(Number(created.snapshotBlock - now + 1n));

  // 4. Alice vote For.
  await page.goto(`/#/proposal/${id}`);
  await expect(page.getByTestId("my-power")).toHaveText(formatGov(400_000n * GOV));
  await page.getByRole("button", { name: "Bỏ phiếu For (Đồng ý)" }).click();
  await expect(page.getByTestId("tx-status")).toHaveAttribute("data-status", "SUCCESS");
  const aliceVoteHash = await page.getByTestId("tx-hash").textContent();
  await expect(page.getByTestId("has-voted")).toHaveText("Rồi");
  await expect(page.getByTestId("vote-blocked-reason")).toHaveText(
    "Ví này đã bỏ phiếu cho proposal này.",
  );

  // 5. Bob vote Against trong một context trình duyệt khác (ví giả của Bob).
  const bobCtx = await browser.newContext();
  const bob = await bobCtx.newPage();
  await installFakeWallet(bob, { account: ACCOUNTS.bob });
  await connect(bob, `#/proposal/${id}`);
  await bob.getByRole("button", { name: "Bỏ phiếu Against (Phản đối)" }).click();
  await expect(bob.getByTestId("tx-status")).toHaveAttribute("data-status", "SUCCESS");
  const bobVoteHash = await bob.getByTestId("tx-hash").textContent();
  await bobCtx.close();

  // 6. Tally trên UI khớp getProposal on-chain.
  const onChain = await readProposal(id);
  expect(onChain.forVotes).toBe(400_000n * GOV);
  expect(onChain.againstVotes).toBe(250_000n * GOV);
  await page.reload();
  await expect(page.getByTestId("tally-for")).toHaveText(formatGov(onChain.forVotes));
  await expect(page.getByTestId("tally-against")).toHaveText(formatGov(onChain.againstVotes));

  // 7. scripts/verify (head = latest − 12) phải thấy các phiếu mới → mine 13 block rồi chạy.
  await mine(13);
  const out = execFileSync("npm", ["run", "verify"], {
    cwd: resolve(process.cwd(), "../scripts/verify"),
    env: { ...process.env, GOV_VOTE },
    encoding: "utf8",
  });
  expect(out).toContain("VERIFIED");
  expect(out).toMatch(
    new RegExp(
      `^\\s*${id} \\|\\s+400\\.000 \\|\\s+250\\.000 \\|\\s+400\\.000 \\|\\s+250\\.000 \\|\\s+OK$`,
      "m",
    ),
  );

  console.log(
    JSON.stringify({
      id: id.toString(),
      delegateHash,
      proposeHash,
      aliceVoteHash,
      bobVoteHash,
      snapshot: created.snapshotBlock.toString(),
    }),
  );
  console.log(
    out
      .split("\n")
      .filter((l) => /latest|proposalCount|VoteCast|\| +OK|LỆCH|VERIFIED|MISMATCH/.test(l))
      .join("\n"),
  );
});
