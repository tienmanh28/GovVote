// An toàn hiển thị (Bước 7): title/description chứa HTML phải hiện nguyên văn, không thực thi.
import { expect, test } from "@playwright/test";
import { ACCOUNTS, connect, installFakeWallet, readProposal } from "./helpers.ts";

test("title <img src=x onerror=alert(1)> hiển thị nguyên văn, không chạy script", async ({
  page,
}) => {
  const title = "<img src=x onerror=alert(1)>";
  const description = "<script>alert(2)</script><b>không in đậm</b>";
  const dialogs: string[] = [];
  page.on("dialog", async (d) => {
    dialogs.push(d.message());
    await d.dismiss();
  });

  await installFakeWallet(page, { account: ACCOUNTS.alice });
  await connect(page, "#/create");
  await page.getByLabel(/Tiêu đề/).fill(title);
  await page.getByLabel(/Mô tả/).fill(description);
  // "<img"(4) + " "(1) + "src=x"(5) + " "(1) + "onerror=alert(1)"(16) + ">"(1) = 28 byte ASCII.
  await expect(page.getByTestId("title-bytes")).toHaveText("28/100 byte");
  await page.getByRole("button", { name: "Gửi proposal" }).click();
  await expect(page.getByTestId("tx-status")).toHaveAttribute("data-status", "SUCCESS");
  const href = await page.getByTestId("created-link").getAttribute("href");
  const id = BigInt(href!.split("/").pop()!);
  expect((await readProposal(id)).title).toBe(title);

  // Trang chi tiết: đúng chuỗi, không có phần tử <img>/<script>/<b> nào được tạo.
  await page.goto(`/#/proposal/${id}`);
  await expect(page.getByTestId("proposal-title")).toHaveText(title);
  await expect(page.getByTestId("proposal-description")).toHaveText(description);
  await expect(page.locator("[data-testid=proposal-title] img")).toHaveCount(0);
  await expect(
    page.locator("[data-testid=proposal-description] script, [data-testid=proposal-description] b"),
  ).toHaveCount(0);

  // Trang danh sách cũng hiện nguyên văn.
  await page.goto("/#/");
  // Ở 1280px danh sách là bảng; thẻ dành cho điện thoại (md:hidden) vẫn có trong DOM nhưng bị ẩn → chỉ lấy phần tử đang hiện.
  // Kiểm đúng dòng của proposal vừa tạo (chạy lại test sẽ tạo thêm proposal cùng title).
  const row = page.locator(`a[href="#/proposal/${id}"]`).filter({ visible: true });
  await expect(row).toHaveText(title);
  await expect(page.locator('img[src="x"]')).toHaveCount(0);

  await page.waitForTimeout(1_000);
  expect(dialogs).toEqual([]);
});
