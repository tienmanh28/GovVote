import { expect, test } from "vitest";
import { createSessionScope, sessionKey, type WalletIdentity } from "../src/lib/session.ts";
const a = { address: "0xaaa", chainId: 31337, isConnected: true };
for (const [name, next] of [
  ["account", { ...a, address: "0xbbb" }],
  ["disconnect", { ...a, address: undefined, isConnected: false }],
  ["chain", { ...a, chainId: 1 }],
] as const) {
  test(`${name}: phiên cũ không được tiếp tục`, () => {
    let current: WalletIdentity = a;
    const scope = createSessionScope(() => current);
    const old = scope.capture(); old(); current = next;
    expect(old).toThrow(/thay đổi/);
    expect(sessionKey(a)).not.toBe(sessionKey(current));
  });
}
test("A → B → A vẫn hủy request cũ", () => {
  const scope = createSessionScope(() => a);
  const old = scope.capture(); scope.invalidate();
  expect(old).toThrow(); expect(scope.capture()).not.toThrow();
});
test("request cũ hoàn tất sau phiên mới không được gửi hoặc nhận thành công", async () => {
  let current: WalletIdentity = a;
  const scope = createSessionScope(() => current);
  const old = scope.capture();
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => { finish = resolve; });
  let writes = 0;
  const work = pending.then(() => { old(); writes++; });
  current = { ...a, address: "0xbbb" }; scope.invalidate();
  const next = scope.capture(); next(); finish();
  await expect(work).rejects.toThrow(/thay đổi/); expect(writes).toBe(0);
});
