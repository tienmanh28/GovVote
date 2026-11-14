// Tách ba khái niệm hay bị nhầm (đặc tả mục 2.1, 5.1): số dư, voting power hiện tại, người được ủy quyền.
import { zeroAddress, type Address } from "viem";
import { formatGov, shortAddress } from "./format.ts";

export type Delegation = "none" | "self" | "other";

export type VotingPowerSummary = {
  /** balanceOf: số GOV ví đang giữ. Có GOV chưa chắc có quyền vote. */
  balance: bigint;
  /** getVotes: voting power hiện tại = tổng GOV của mọi ví đã delegate CHO ví này. */
  votes: bigint;
  /** delegates: ví này đang ủy quyền phiếu của mình cho ai (null nếu chưa từng delegate). */
  delegatee: Address | null;
  delegation: Delegation;
  /** Phần voting power đến từ ví khác delegate cho ví này. */
  receivedFromOthers: bigint;
  /** Giải thích bằng tiếng Việt, hiển thị trực tiếp trên dashboard. */
  notes: string[];
};

export function summarizeVotingPower(account: Address, balance: bigint, votes: bigint, delegatee: Address): VotingPowerSummary {
  const delegation: Delegation =
    delegatee.toLowerCase() === zeroAddress ? "none" : delegatee.toLowerCase() === account.toLowerCase() ? "self" : "other";
  // Khi tự delegate, số dư của chính ví nằm trong votes; phần còn lại là của người khác giao cho.
  const own = delegation === "self" ? balance : 0n;
  const receivedFromOthers = votes > own ? votes - own : 0n;

  const notes: string[] = [];
  if (delegation === "none") {
    notes.push(
      `Ví giữ ${formatGov(balance)} nhưng CHƯA delegate, nên số GOV này chưa tạo voting power. Hãy delegate cho chính mình (hoặc cho người khác) để phiếu được tính từ các proposal có snapshot sau thời điểm đó.`,
    );
  } else if (delegation === "self") {
    notes.push(`Ví đã tự delegate: ${formatGov(balance)} số dư của ví được tính vào voting power của chính ví.`);
  } else {
    notes.push(
      `Ví đã ủy quyền cho ${shortAddress(delegatee)}: số dư ${formatGov(balance)} vẫn thuộc về ví, nhưng quyền biểu quyết của số dư đó nằm ở người được ủy quyền.`,
    );
  }
  if (receivedFromOthers > 0n) {
    notes.push(`Ví đang nhận ${formatGov(receivedFromOthers)} voting power do ví khác delegate cho.`);
  }
  notes.push(
    "Voting power dùng để bỏ phiếu cho một proposal là giá trị tại block snapshot của proposal đó, không phải giá trị hiện tại.",
  );
  return { balance, votes, delegatee: delegation === "none" ? null : delegatee, delegation, receivedFromOthers, notes };
}
