// Logic đối chiếu THUẦN (pure function: chỉ phụ thuộc đầu vào, không gọi RPC, không đọc biến môi trường).
// Nhờ vậy test được bằng dữ liệu tổng hợp mà không cần chain.

/** Một event VoteCast đã giải mã, kèm vị trí của nó trên chain. */
export type VoteLog = {
  /** Hash giao dịch phát ra event. */
  transactionHash: `0x${string}`;
  /** Vị trí của log trong block (logIndex). Cặp (transactionHash, logIndex) định danh duy nhất một log. */
  logIndex: number;
  /** Block chứa giao dịch. */
  blockNumber: bigint;
  /** Proposal id (topic indexed). */
  id: bigint;
  /** true = For, false = Against. */
  support: boolean;
  /** Trọng số phiếu = getPastVotes(voter, snapshotBlock) tại lúc vote. */
  weight: bigint;
};

/** Tổng phiếu của một proposal. */
export type Tally = { for: bigint; against: bigint };

/** Một dòng kết quả so sánh cho một proposal id. */
export type CompareRow = {
  id: bigint;
  /** id có nằm trong 1..proposalCount không. */
  inRange: boolean;
  logFor: bigint;
  logAgainst: bigint;
  chainFor: bigint;
  chainAgainst: bigint;
  match: boolean;
};

export type CompareResult = {
  status: "VERIFIED" | "MISMATCH";
  rows: CompareRow[];
};

const ZERO: Tally = { for: 0n, against: 0n };

/** Khóa định danh một log. Chuẩn hóa chữ thường để "0xAB.." và "0xab.." là cùng một log. */
function logKey(log: VoteLog): string {
  return `${log.transactionHash.toLowerCase()}:${log.logIndex}`;
}

/**
 * Cộng phiếu từ danh sách log VoteCast.
 *
 * 1. Bỏ log có blockNumber > headBlock: storage được đọc tại headBlock, nên log của block sau đó
 *    chưa có trong storage. Giữ lại là so lệch block (xem main.ts).
 * 2. Khử trùng (dedupe) theo "transactionHash:logIndex". Vì sao cần: log được lấy qua nhiều lần
 *    getLogs theo cửa sổ block. Nếu cửa sổ bị chồng lấn (overlap) do lỗi biên, do retry sau lỗi mạng,
 *    hoặc do RPC/provider trả trùng, cùng một phiếu sẽ xuất hiện 2 lần và bị cộng 2 lần, tally sẽ
 *    sai dù chain đúng.
 *    Nếu hai log cùng khóa mà NỘI DUNG khác nhau (id/support/weight/block), đó là dữ liệu mâu thuẫn
 *    từ nguồn log. Hàm ném lỗi thay vì lặng lẽ chọn một bản, để không che giấu dữ liệu hỏng.
 * 3. Cộng weight theo id, tách For và Against.
 *
 * @returns Map id → { for, against }. Chỉ chứa id có ít nhất một log.
 */
export function aggregateVotes(logs: readonly VoteLog[], headBlock: bigint): Map<bigint, Tally> {
  const seen = new Map<string, VoteLog>();
  const result = new Map<bigint, Tally>();

  for (const log of logs) {
    if (log.blockNumber > headBlock) continue;

    const key = logKey(log);
    const prev = seen.get(key);
    if (prev !== undefined) {
      const same =
        prev.id === log.id &&
        prev.support === log.support &&
        prev.weight === log.weight &&
        prev.blockNumber === log.blockNumber;
      if (!same) throw new Error(`Log trùng khóa ${key} nhưng nội dung khác nhau`);
      continue; // bản trùng y hệt: bỏ qua
    }
    seen.set(key, log);

    const t = result.get(log.id) ?? { for: 0n, against: 0n };
    if (log.support) t.for += log.weight;
    else t.against += log.weight;
    result.set(log.id, t);
  }
  return result;
}

/**
 * So tally tính từ log với forVotes/againstVotes đọc từ storage.
 *
 * Tập id cần xét = hợp (union) của 1..proposalCount và các id có trong aggregate:
 *   - id trong 1..proposalCount mà không có log: phía log coi là 0 (proposal chưa ai vote).
 *   - id trong 1..proposalCount mà thiếu trong onChain: phía chain coi là 0. Nếu log có phiếu thì sẽ lệch.
 *   - id NGOÀI 1..proposalCount mà có log: luôn MISMATCH. GovVote chặn vote cho proposal không tồn tại
 *     (ProposalNotFound), nên log như vậy nghĩa là sai contract, sai block, hoặc dữ liệu log bị giả.
 *
 * Hai nguồn phải được đọc tại CÙNG một block (main.ts lo việc đó); hàm này chỉ so số.
 *
 * @param aggregate kết quả aggregateVotes
 * @param onChain   Map id → { for: forVotes, against: againstVotes } đọc tại head
 * @param proposalCount proposalCount đọc tại head
 */
export function compareWithChain(
  aggregate: ReadonlyMap<bigint, Tally>,
  onChain: ReadonlyMap<bigint, Tally>,
  proposalCount: bigint,
): CompareResult {
  const ids = new Set<bigint>();
  for (let id = 1n; id <= proposalCount; id++) ids.add(id);
  for (const id of aggregate.keys()) ids.add(id);
  const sorted = [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const rows: CompareRow[] = sorted.map((id) => {
    const inRange = id >= 1n && id <= proposalCount;
    const log = aggregate.get(id) ?? ZERO;
    const chain = onChain.get(id) ?? ZERO;
    const match = inRange && log.for === chain.for && log.against === chain.against;
    return {
      id,
      inRange,
      logFor: log.for,
      logAgainst: log.against,
      chainFor: chain.for,
      chainAgainst: chain.against,
      match,
    };
  });

  return { status: rows.every((r) => r.match) ? "VERIFIED" : "MISMATCH", rows };
}
