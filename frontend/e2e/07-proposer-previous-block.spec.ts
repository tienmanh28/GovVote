// Tái hiện bằng Anvil thật, giữ checkpoint delegate ngay ở latest; không sửa test cũ.
import { test, expect } from "@playwright/test";
import { encodeFunctionData, type Address, type Hex } from "viem";
import {
  ACCOUNTS,
  GOV_TOKEN,
  GOV_VOTE,
  installFakeWallet,
  publicClient,
  rpc,
  mine,
} from "./helpers.ts";
import { govTokenAbi } from "../src/abi/govToken.ts";
import { govVoteAbi } from "../src/abi/govVote.ts";

test("gate chờ quyền tại block trước sau khi vừa delegate ở latest", async ({ page }) => {
  const snapshot = await rpc<string>("evm_snapshot");
  try {
    const accounts = await rpc<Address[]>("eth_accounts");
    const proposer = accounts[6]!;
    const threshold = await publicClient.readContract({
      address: GOV_VOTE,
      abi: govVoteAbi,
      functionName: "proposalThreshold",
    });
    const transfer = await rpc<Hex>("eth_sendTransaction", [
      {
        from: ACCOUNTS.alice,
        to: GOV_TOKEN,
        data: encodeFunctionData({
          abi: govTokenAbi,
          functionName: "transfer",
          args: [proposer, threshold],
        }),
      },
    ]);
    await publicClient.waitForTransactionReceipt({ hash: transfer });
    const delegate = await rpc<Hex>("eth_sendTransaction", [
      {
        from: proposer,
        to: GOV_TOKEN,
        data: encodeFunctionData({ abi: govTokenAbi, functionName: "delegate", args: [proposer] }),
      },
    ]);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: delegate });
    const block = receipt.blockNumber;
    const current = await publicClient.readContract({
      address: GOV_TOKEN,
      abi: govTokenAbi,
      functionName: "getVotes",
      args: [proposer],
      blockNumber: block,
    });
    const previous = await publicClient.readContract({
      address: GOV_TOKEN,
      abi: govTokenAbi,
      functionName: "getPastVotes",
      args: [proposer, block - 1n],
      blockNumber: block,
    });
    expect(current).toBe(threshold);
    expect(previous).toBe(0n);
    // Chứng minh contract thực từ chối tại cùng block; không suy từ fixture hoặc tên hàm UI.
    await expect(
      publicClient.simulateContract({
        address: GOV_VOTE,
        abi: govVoteAbi,
        functionName: "propose",
        args: ["Boundary proposal", ""],
        account: proposer,
        blockNumber: block,
      }),
    ).rejects.toThrow(/BelowThreshold/);
    console.log(
      `REPRO: block=${block}, getVotes=${current}, getPastVotes(B-1)=${previous}; simulate propose => BelowThreshold`,
    );
    await installFakeWallet(page, { account: proposer });
    await page.goto("/#/create");
    await page.getByRole("button", { name: "Kết nối MetaMask" }).click();
    await expect(page.getByTestId("wallet-address")).toBeVisible();
    await page.locator("#title").fill("Boundary proposal");
    const submit = page.getByRole("button", { name: "Gửi proposal", exact: true });
    // Đợi đủ query và giới hạn form, tránh nhầm trạng thái loading với gate từ chối quyền.
    await expect(page.getByTestId("current-votes")).toHaveText(/^[\d.,]+ GOV$/);
    await expect(
      page.getByText("Ngưỡng tạo proposal", { exact: true }).locator(".."),
    ).toContainText("1.000");
    await expect(page.locator('label[for="title"]')).toContainText("100");
    await expect(page.locator('label[for="description"]')).toContainText("1000");
    // Code cũ cho phép gửi dù simulation đã chứng minh BelowThreshold: assertion này phải đỏ trước sửa.
    await expect(submit).toBeDisabled();
    for (const [width, height] of [
      [375, 812],
      [768, 1024],
      [1280, 800],
    ]) {
      await page.setViewportSize({ width: width!, height: height! });
      await expect(submit).toBeDisabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await mine(1);
    await expect(submit).toBeEnabled();
    await publicClient.simulateContract({
      address: GOV_VOTE,
      abi: govVoteAbi,
      functionName: "propose",
      args: ["Boundary proposal", ""],
      account: proposer,
      blockNumber: block + 1n,
    });
  } finally {
    // Khôi phục chain để ca tái hiện không làm đổi trạng thái của bộ E2E cũ.
    await rpc("evm_revert", [snapshot]);
  }
});
