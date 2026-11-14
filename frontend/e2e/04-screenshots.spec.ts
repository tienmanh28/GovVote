// Responsive (Bước 8): chụp ảnh 4 trang ở 3 kích thước, kiểm không cuộn ngang và nút ≥ 44px.
// Ảnh lưu ở docs/phase3-screenshots/<trang>-<rộng>x<cao>.png (ngoài frontend/, để đưa vào báo cáo).
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { govVoteAbi } from "../src/abi/govVote.ts";
import { ACCOUNTS, GOV_VOTE, connect, installFakeWallet, publicClient } from "./helpers.ts";

const OUT = resolve(process.cwd(), "../docs/phase3-screenshots");
const SIZES = [
  { w: 375, h: 812, mobile: true },
  { w: 768, h: 1024, mobile: true },
  { w: 1280, h: 800, mobile: false },
] as const;

/** Kiểm bố cục bằng số đo thật trong trình duyệt. */
async function measure(page: Page) {
  return page.evaluate(() => {
    const small = [...document.querySelectorAll<HTMLElement>("button, nav a")]
      .filter((el) => el.offsetParent !== null)
      .map((el) => ({ text: el.innerText.trim(), h: el.getBoundingClientRect().height }))
      .filter((x) => x.h < 44);
    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      small,
    };
  });
}

/** Tìm proposal đang Active để chụp trang chi tiết có nút vote. */
async function findActiveId(): Promise<bigint | null> {
  const count = await publicClient.readContract({
    address: GOV_VOTE,
    abi: govVoteAbi,
    functionName: "proposalCount",
  });
  for (let id = count; id >= 1n; id--) {
    if (
      (await publicClient.readContract({
        address: GOV_VOTE,
        abi: govVoteAbi,
        functionName: "state",
        args: [id],
      })) === 1
    )
      return id;
  }
  return null;
}

mkdirSync(OUT, { recursive: true });

for (const size of SIZES) {
  test(`ảnh và bố cục ở ${size.w}×${size.h}`, async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: size.w, height: size.h },
      hasTouch: size.mobile,
    });
    const page = await ctx.newPage();
    // Charlie chưa vote proposal Active → trang chi tiết có nút vote đang bật.
    await installFakeWallet(page, { account: ACCOUNTS.charlie });
    await connect(page, "#/");
    const activeId = await findActiveId();

    const pages: Array<{ name: string; hash: string; ready: (p: Page) => Promise<void> }> = [
      { name: "list", hash: "#/", ready: (p) => p.getByTestId("proposal-count").waitFor() },
      { name: "detail", hash: "#/proposal/1", ready: (p) => p.getByTestId("tally-for").waitFor() },
      {
        name: "create",
        hash: "#/create",
        ready: async (p) => void (await expect(p.getByTestId("current-votes")).not.toHaveText("…")),
      },
      { name: "wallet", hash: "#/wallet", ready: (p) => p.getByTestId("balance").waitFor() },
    ];
    if (activeId) {
      pages.push({
        name: "detail-active",
        hash: `#/proposal/${activeId}`,
        ready: async (p) => void (await expect(p.getByTestId("has-voted")).toHaveText("Chưa")),
      });
    }

    for (const pg of pages) {
      await page.goto(`/${pg.hash}`);
      await pg.ready(page);
      await page.waitForTimeout(300);
      const m = await measure(page);
      const file = `${pg.name}-${size.w}x${size.h}.png`;
      await page.screenshot({ path: resolve(OUT, file), fullPage: true });
      console.log(JSON.stringify({ file, ...m }));
      expect.soft(m.scrollWidth, `${file}: cuộn ngang`).toBeLessThanOrEqual(m.innerWidth);
      expect.soft(m.small, `${file}: nút thấp hơn 44px`).toEqual([]);
    }
    await ctx.close();
  });
}

test("ảnh trạng thái ví: điện thoại không có ví, máy tính không có ví, sai chain", async ({
  browser,
}) => {
  const IPHONE_UA =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
  const shots: Array<[string, Page]> = [];

  const m = await browser.newContext({
    viewport: { width: 375, height: 812 },
    userAgent: IPHONE_UA,
    isMobile: true,
    hasTouch: true,
  });
  const mp = await m.newPage();
  await mp.goto("/#/");
  await mp.getByTestId("wallet-mobile-guide").waitFor();
  shots.push(["no-wallet-mobile-375x812.png", mp]);

  const d = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const dp = await d.newPage();
  await dp.goto("/#/");
  await dp.getByTestId("wallet-desktop-guide").waitFor();
  shots.push(["no-wallet-desktop-1280x800.png", dp]);

  const w = await browser.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true });
  const wp = await w.newPage();
  await installFakeWallet(wp, { account: ACCOUNTS.alice });
  await connect(wp, "#/");
  await wp.evaluate(() =>
    (window as unknown as { __fakeWallet: { setChain(h: string): void } }).__fakeWallet.setChain(
      "0x1",
    ),
  );
  await wp.getByTestId("wrong-chain").waitFor();
  shots.push(["wrong-chain-375x812.png", wp]);

  for (const [file, p] of shots) {
    await p.waitForTimeout(300);
    const r = await measure(p);
    await p.screenshot({ path: resolve(OUT, file), fullPage: true });
    console.log(JSON.stringify({ file, ...r }));
    expect.soft(r.scrollWidth, `${file}: cuộn ngang`).toBeLessThanOrEqual(r.innerWidth);
    expect.soft(r.small, `${file}: nút thấp hơn 44px`).toEqual([]);
  }
  await Promise.all([m.close(), d.close(), w.close()]);
});
