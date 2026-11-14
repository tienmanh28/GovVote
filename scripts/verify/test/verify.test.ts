// Test cho logic đối chiếu, chỉ dùng dữ liệu tổng hợp (synthetic data): không RPC, không cần Anvil.
// Chạy: npm test  (= tsx --test test/*.test.ts, dùng node:test có sẵn trong Node)
import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateVotes, compareWithChain, type Tally, type VoteLog } from "../src/verify.ts";
import { blockWindows, LOG_WINDOW } from "../src/fetch.ts";

// ------------------------------- dữ liệu mẫu -------------------------------

/** 1 GOV = 10^18 đơn vị nhỏ nhất. */
const GOV = 10n ** 18n;
const HEAD = 100n;

/** Tạo transactionHash giả, 32 byte, từ một số nhỏ. */
function txHash(n: number): `0x${string}` {
  return `0x${n.toString(16).padStart(64, "0")}`;
}

function vote(
  tx: number,
  logIndex: number,
  blockNumber: bigint,
  id: bigint,
  support: boolean,
  weight: bigint,
): VoteLog {
  return { transactionHash: txHash(tx), logIndex, blockNumber, id, support, weight };
}

/**
 * Bộ log chuẩn, mô phỏng demo Phase 1 cộng thêm một proposal thứ hai:
 *   proposal 1: Alice For 400k, Bob Against 250k, Charlie For 200k => For 600k / Against 250k
 *   proposal 2: một phiếu Against 100k, cùng tx 4 nhưng logIndex 1
 * Mỗi lần gọi trả về mảng MỚI, để ca này sửa dữ liệu không ảnh hưởng ca khác.
 */
function baseLogs(): VoteLog[] {
  return [
    vote(1, 0, 35n, 1n, true, 400_000n * GOV),
    vote(2, 0, 36n, 1n, false, 250_000n * GOV),
    vote(3, 0, 37n, 1n, true, 200_000n * GOV),
    vote(4, 1, 40n, 2n, false, 100_000n * GOV),
  ];
}

/** Storage tương ứng với baseLogs(), đọc tại HEAD. */
function baseChain(): Map<bigint, Tally> {
  return new Map<bigint, Tally>([
    [1n, { for: 600_000n * GOV, against: 250_000n * GOV }],
    [2n, { for: 0n, against: 100_000n * GOV }],
  ]);
}

/** Danh sách id của các dòng bị lệch. */
function mismatchedIds(rows: { id: bigint; match: boolean }[]): bigint[] {
  return rows.filter((r) => !r.match).map((r) => r.id);
}

// ---------------------------------- các ca ----------------------------------

test("(a) valid logs without duplicates => VERIFIED", () => {
  // Log đầy đủ, không trùng: tổng từ log phải bằng đúng storage.
  const agg = aggregateVotes(baseLogs(), HEAD);
  assert.deepEqual(agg.get(1n), { for: 600_000n * GOV, against: 250_000n * GOV });
  assert.deepEqual(agg.get(2n), { for: 0n, against: 100_000n * GOV });

  const res = compareWithChain(agg, baseChain(), 2n);
  assert.equal(res.status, "VERIFIED");
  assert.deepEqual(
    res.rows.map((r) => r.id),
    [1n, 2n],
  );
  assert.ok(res.rows.every((r) => r.match && r.inRange));
});

test("(b) exact duplicate (same txHash, logIndex, content) => VERIFIED, counted once", () => {
  // Mô phỏng hai cửa sổ getLogs chồng lấn hoặc một lần retry: phiếu của Alice xuất hiện 2 lần.
  // Nếu không khử trùng, For của proposal 1 sẽ thành 1.000k thay vì 600k.
  const logs = baseLogs();
  logs.push({ ...logs[0]! });
  // Thêm bản trùng có hash viết HOA: vẫn là cùng một log, vì khóa được chuẩn hóa chữ thường.
  logs.push({
    ...logs[0]!,
    transactionHash: logs[0]!.transactionHash.toUpperCase().replace("0X", "0x") as `0x${string}`,
  });

  const agg = aggregateVotes(logs, HEAD);
  assert.equal(agg.get(1n)?.for, 600_000n * GOV, "phiếu trùng bị cộng hai lần");
  assert.equal(compareWithChain(agg, baseChain(), 2n).status, "VERIFIED");
});

test("(c) one log with tampered weight => MISMATCH on exactly that id", () => {
  // Sửa weight phiếu của proposal 2 (thêm 1 wei): chỉ dòng id 2 được lệch, dòng id 1 vẫn khớp.
  const logs = baseLogs();
  logs[3] = { ...logs[3]!, weight: logs[3]!.weight + 1n };

  const res = compareWithChain(aggregateVotes(logs, HEAD), baseChain(), 2n);
  assert.equal(res.status, "MISMATCH");
  assert.deepEqual(mismatchedIds(res.rows), [2n]);
  const row2 = res.rows.find((r) => r.id === 2n)!;
  assert.equal(row2.logAgainst, 100_000n * GOV + 1n);
  assert.equal(row2.chainAgainst, 100_000n * GOV);
});

test("(d) one missing log => MISMATCH", () => {
  // Bỏ phiếu Against của Bob (RPC trả thiếu log): Against từ log là 0, còn storage là 250k.
  const logs = baseLogs().filter((_, i) => i !== 1);

  const res = compareWithChain(aggregateVotes(logs, HEAD), baseChain(), 2n);
  assert.equal(res.status, "MISMATCH");
  assert.deepEqual(mismatchedIds(res.rows), [1n]);
  assert.equal(res.rows.find((r) => r.id === 1n)!.logAgainst, 0n);
});

test("(e) logs with blockNumber > headBlock are ignored => VERIFIED", () => {
  // Phiếu ở block HEAD + 1 chưa có trong storage đọc tại HEAD, nên phải bị loại khỏi tổng.
  const logs = baseLogs();
  logs.push(vote(9, 0, HEAD + 1n, 1n, true, 1_000_000n * GOV));
  const agg = aggregateVotes(logs, HEAD);
  assert.equal(agg.get(1n)?.for, 600_000n * GOV);
  assert.equal(compareWithChain(agg, baseChain(), 2n).status, "VERIFIED");

  // Biên: log ở ĐÚNG block HEAD vẫn được tính (điều kiện loại là ">" chứ không phải ">=").
  const atHead = aggregateVotes([vote(10, 0, HEAD, 1n, true, 5n)], HEAD);
  assert.equal(atHead.get(1n)?.for, 5n);
});

test("(f) same txHash:logIndex key with different content => aggregateVotes throws", () => {
  // Cùng khóa nhưng weight khác: dữ liệu log mâu thuẫn. Hàm phải báo lỗi, không được tự chọn một bản.
  const logs = baseLogs();
  logs.push({ ...logs[0]!, weight: logs[0]!.weight + 1n });
  assert.throws(() => aggregateVotes(logs, HEAD), /trùng khóa/);

  // Khác support (cùng weight) cũng phải bị bắt.
  const flipped = baseLogs();
  flipped.push({ ...flipped[0]!, support: !flipped[0]!.support });
  assert.throws(() => aggregateVotes(flipped, HEAD), /trùng khóa/);
});

test("(g) votes for an id outside 1..proposalCount => MISMATCH", () => {
  // proposalCount = 2 nhưng log có phiếu cho id 3. GovVote chặn trường hợp này (ProposalNotFound),
  // nên log như vậy nghĩa là sai nguồn dữ liệu.
  const logs = baseLogs();
  logs.push(vote(5, 0, 50n, 3n, true, 1n));

  const res = compareWithChain(aggregateVotes(logs, HEAD), baseChain(), 2n);
  assert.equal(res.status, "MISMATCH");
  assert.deepEqual(mismatchedIds(res.rows), [3n]);
  const row3 = res.rows.find((r) => r.id === 3n)!;
  assert.equal(row3.inRange, false);
  assert.equal(row3.logFor, 1n);
  assert.equal(row3.chainFor, 0n);
});

test("(h) proposal with no votes on either side => VERIFIED with For = 0, Against = 0", () => {
  // proposalCount = 3: proposal 3 tồn tại nhưng chưa ai vote, không có log nào.
  const chain = baseChain();
  chain.set(3n, { for: 0n, against: 0n });
  const agg = aggregateVotes(baseLogs(), HEAD);

  const res = compareWithChain(agg, chain, 3n);
  assert.equal(res.status, "VERIFIED");
  const row3 = res.rows.find((r) => r.id === 3n)!;
  assert.deepEqual(
    [row3.logFor, row3.logAgainst, row3.chainFor, row3.chainAgainst, row3.match],
    [0n, 0n, 0n, 0n, true],
  );

  // Thiếu id 3 trong cả map onChain cũng được coi là 0 ở phía chain => vẫn VERIFIED.
  assert.equal(compareWithChain(agg, baseChain(), 3n).status, "VERIFIED");

  // Biên rỗng: chưa có proposal và chưa có log => VERIFIED, không có dòng nào.
  const empty = compareWithChain(new Map(), new Map(), 0n);
  assert.equal(empty.status, "VERIFIED");
  assert.equal(empty.rows.length, 0);
});

test("(i) blockWindows boundaries: contiguous, no gaps, no overlap", () => {
  // Đúng 10.000 block (0..9999 tính cả hai đầu) => một cửa sổ.
  assert.deepEqual(blockWindows(0n, 9_999n), [[0n, 9_999n]]);

  // 10.001 block => hai cửa sổ; cửa sổ 2 bắt đầu ở 10000 chứ không phải 9999 (không chồng lấn).
  assert.deepEqual(blockWindows(0n, 10_000n), [
    [0n, 9_999n],
    [10_000n, 10_000n],
  ]);

  // Thuộc tính cho nhiều N (gồm các điểm sát biên), và cả trường hợp from khác 0.
  const cases: Array<[bigint, bigint]> = [
    [0n, 0n],
    [0n, 1n],
    [0n, 9_998n],
    [0n, 19_999n],
    [0n, 20_000n],
    [0n, 25_000n],
    [0n, 123_456n],
    [5n, 30_004n],
    [7_222n, 7_222n],
  ];
  for (const [from, to] of cases) {
    const w = blockWindows(from, to);
    assert.ok(w.length > 0, `không có cửa sổ cho [${from}, ${to}]`);
    assert.equal(w[0]![0], from, `cửa sổ đầu không bắt đầu ở ${from}`);
    assert.equal(w[w.length - 1]![1], to, `cửa sổ cuối không kết thúc ở ${to}`);
    for (let i = 0; i < w.length; i++) {
      const [s, e] = w[i]!;
      assert.ok(s <= e, `cửa sổ rỗng [${s}, ${e}]`);
      assert.ok(e - s + 1n <= LOG_WINDOW, `cửa sổ quá ${LOG_WINDOW} block`);
      if (i > 0)
        assert.equal(s, w[i - 1]![1] + 1n, `hở hoặc chồng lấn giữa cửa sổ ${i - 1} và ${i}`);
    }
    // Tổng số block phủ đúng bằng độ dài đoạn => không hở, không chồng.
    const covered = w.reduce((sum, [s, e]) => sum + (e - s + 1n), 0n);
    assert.equal(covered, to - from + 1n);
  }

  // from > to: khoảng block không hợp lệ => ném lỗi (fail loudly), KHÔNG trả [] trong im lặng.
  // Trả [] sẽ khiến fetchVoteLogs ra 0 log, và có thể báo VERIFIED dù không kiểm tra gì.
  assert.throws(() => blockWindows(10n, 5n), /from > to: khoảng block không hợp lệ/);
  assert.throws(() => blockWindows(1n, 0n), /from > to/);

  // size < 1 là cấu hình vô nghĩa (vòng lặp sẽ không bao giờ dừng) => ném lỗi.
  assert.throws(() => blockWindows(0n, 10n, 0n), /size/);
});
