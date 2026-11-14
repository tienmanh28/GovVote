// Đọc event VoteCast qua RPC (eth_getLogs). Chỉ đọc, không cần ví.
import type { Address, PublicClient } from "viem";
import { voteCastEvent } from "./abi.ts";
import type { VoteLog } from "./verify.ts";

/** Số block tối đa trong một lần getLogs. Nhiều RPC giới hạn khoảng block hoặc số log mỗi lần gọi. */
export const LOG_WINDOW = 10_000n;

/**
 * Chia đoạn [fromBlock, toBlock] (gồm cả hai đầu) thành các cửa sổ KHÔNG chồng lấn,
 * mỗi cửa sổ tối đa `size` block.
 *
 * Biên: eth_getLogs coi cả fromBlock lẫn toBlock là INCLUSIVE (gồm cả hai đầu). Vì vậy:
 *   cửa sổ 1: [from,          from + 9999]   => đúng 10.000 block
 *   cửa sổ 2: [from + 10000,  from + 19999]
 *   ...
 *   cửa sổ cuối: [start, toBlock] (có thể ngắn hơn)
 * Nếu viết nhầm cửa sổ 2 bắt đầu từ from + 9999, block đó bị đọc 2 lần (chồng lấn).
 * aggregateVotes vẫn khử trùng được, nhưng hàm này cố gắng không tạo trùng ngay từ đầu.
 *
 * Input sai thì ném lỗi, không trả kết quả rỗng: script kiểm chứng phải thất bại to (fail loudly)
 * khi đầu vào sai, không được im lặng. Nếu from > to mà trả [], fetchVoteLogs sẽ trả 0 log; khi chain
 * cũng chưa có phiếu, kết quả là VERIFIED dù thực ra chẳng kiểm tra gì. Tương tự, size < 1 sẽ làm
 * vòng lặp không bao giờ dừng.
 *
 * Hàm thuần, xuất ra để test được.
 */
export function blockWindows(
  fromBlock: bigint,
  toBlock: bigint,
  size: bigint = LOG_WINDOW,
): Array<[bigint, bigint]> {
  if (size < 1n) throw new Error("size phải >= 1");
  if (fromBlock > toBlock) {
    throw new Error(`from > to: khoảng block không hợp lệ [${fromBlock}, ${toBlock}]`);
  }
  const out: Array<[bigint, bigint]> = [];
  for (let start = fromBlock; start <= toBlock; start += size) {
    const end = start + size - 1n < toBlock ? start + size - 1n : toBlock;
    out.push([start, end]);
  }
  return out;
}

/**
 * Lấy mọi event VoteCast của `gov` trong [fromBlock, toBlock], theo từng cửa sổ LOG_WINDOW block.
 *
 * - `strict: true`: viem chỉ trả log giải mã được đầy đủ args theo ABI; log không khớp ABI bị loại.
 * - Log thiếu transactionHash / logIndex / blockNumber (chỉ xảy ra với log pending, chưa vào block)
 *   làm hàm ném lỗi, vì không thể khử trùng hay đặt vào đúng block.
 *
 * @returns log đã sắp xếp theo blockNumber rồi logIndex (thứ tự xuất hiện trên chain).
 */
export async function fetchVoteLogs(
  client: PublicClient,
  gov: Address,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<VoteLog[]> {
  const logs: VoteLog[] = [];

  for (const [start, end] of blockWindows(fromBlock, toBlock)) {
    const raw = await client.getLogs({
      address: gov,
      event: voteCastEvent,
      fromBlock: start,
      toBlock: end,
      strict: true,
    });
    for (const l of raw) {
      if (l.transactionHash === null || l.logIndex === null || l.blockNumber === null) {
        throw new Error(`Log VoteCast thiếu vị trí (pending?) trong cửa sổ [${start}, ${end}]`);
      }
      logs.push({
        transactionHash: l.transactionHash,
        logIndex: l.logIndex,
        blockNumber: l.blockNumber,
        id: l.args.id,
        support: l.args.support,
        weight: l.args.weight,
      });
    }
  }

  logs.sort((a, b) =>
    a.blockNumber !== b.blockNumber
      ? a.blockNumber < b.blockNumber
        ? -1
        : 1
      : a.logIndex - b.logIndex,
  );
  return logs;
}
