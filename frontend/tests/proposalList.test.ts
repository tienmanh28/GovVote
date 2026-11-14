import { expect, test } from "vitest";
import { matchesStatus, proposalWindow, quorumProgress } from "../src/lib/proposalList.ts";
for (const count of [0n, 1n, 10n, 11n, 10n ** 30n])
  test(`cửa sổ ID bounded: ${count}`, () => {
    const w = proposalWindow(count, 0n);
    expect(w.ids.length).toBe(Number(count < 10n ? count : 10n));
    if (count) expect(w.ids[0]).toBe(count);
    expect(w.ids.every((id) => id > 0n)).toBe(true);
  });
test("trang cũ không bị mất, clamp biên", () => {
  expect(proposalWindow(12n, 1n).ids).toEqual([2n, 1n]);
  expect(proposalWindow(12n, 999n).page).toBe(1n);
  expect(proposalWindow(12n, -1n).page).toBe(0n);
});
for (const [state, filter] of [
  [0, "pending"],
  [1, "active"],
  [2, "closed"],
  [3, "closed"],
] as const)
  test(`state canonical ${state} → ${filter}`, () => {
    expect(matchesStatus(state, filter)).toBe(true);
    expect(matchesStatus(state, "all")).toBe(true);
    for (const other of ["pending", "active", "closed"] as const)
      if (other !== filter) expect(matchesStatus(state, other)).toBe(false);
  });
for (const [against, met, pct] of [
  [39n, false, "99,00%"],
  [40n, true, "100,00%"],
  [41n, true, "101,00%"],
] as const)
  test(`For+Against quorum: ${pct}`, () => {
    const p = quorumProgress(60n, against, 100n);
    expect(p.met).toBe(met);
    expect(p.percent).toBe(pct);
    expect(p.bar).toBeLessThanOrEqual(100);
  });
test("thiếu 1 wei không hiển thị 100%", () => {
  const p = quorumProgress(10n ** 24n - 1n, 0n, 10n ** 24n);
  expect(p.met).toBe(false);
  expect(p.percent).toBe("99,99%");
});
test("quorum không hợp lệ không bịa tiến độ", () => {
  expect(() => quorumProgress(1n, 0n, 0n)).toThrow(/không hợp lệ/);
});
