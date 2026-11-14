// Phân trang ID trước khi gọi RPC: không đổi bigint tổng proposal thành Number.
export const PAGE_SIZE = 10;
export type StatusFilter = "all" | "pending" | "active" | "closed";
export function proposalWindow(count: bigint, requestedPage: bigint) {
  const pages = count === 0n ? 1n : (count + BigInt(PAGE_SIZE) - 1n) / BigInt(PAGE_SIZE);
  const page = requestedPage < 0n ? 0n : requestedPage >= pages ? pages - 1n : requestedPage;
  const top = count - page * BigInt(PAGE_SIZE);
  const length = Number(top < BigInt(PAGE_SIZE) ? top : BigInt(PAGE_SIZE));
  return { page, pages, ids: Array.from({ length }, (_, i) => top - BigInt(i)) };
}
export function matchesStatus(state: number, filter: StatusFilter): boolean {
  return filter === "all" || (filter === "pending" && state === 0) || (filter === "active" && state === 1) || (filter === "closed" && (state === 2 || state === 3));
}
// Mẫu số do quorumVotes(id) trả về, đã lấy tổng cung lịch sử và làm tròn trong contract.
// Phần trăm làm tròn xuống, không báo đạt khi participation còn thiếu 1 wei.
export function quorumProgress(forVotes: bigint, againstVotes: bigint, quorum: bigint) {
  if (quorum <= 0n) throw new Error("Quorum không hợp lệ.");
  const participation = forVotes + againstVotes;
  const bps = participation * 10_000n / quorum;
  return { participation, met: participation >= quorum, percent: `${bps / 100n},${(bps % 100n).toString().padStart(2, "0")}%`, bar: Number(bps > 10_000n ? 10_000n : bps) / 100 };
}
