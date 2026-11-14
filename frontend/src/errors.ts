// Đổi lỗi kỹ thuật thành thông báo tiếng Việt.
//
// Nguyên tắc:
// 1. Dựa vào TÊN LỖI đã giải mã (errorName) từ revert data theo ABI, KHÔNG so khớp chuỗi thông báo thô.
//    viem giải mã revert data thành ContractFunctionRevertedError { data: { errorName, args } }.
// 2. Người dùng từ chối ký (EIP-1193 code 4001) → câu cố định.
// 3. Lỗi không nhận ra → hiện nguyên thông báo gốc, không bịa nội dung.
import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from "viem";
import { formatGov, stateLabel } from "./lib/format.ts";

/** Đủ 10 custom error của GovVote (đặc tả mục 3.3). Test đối chiếu danh sách này với ABI build ra. */
export const GOV_VOTE_ERROR_NAMES = [
  "ProposalNotFound",
  "EmptyTitle",
  "TitleTooLong",
  "DescriptionTooLong",
  "BelowThreshold",
  "NotActive",
  "AlreadyVoted",
  "NoVotingPower",
  "InvalidConfiguration",
  "SnapshotNotFinalized",
] as const;

export type GovVoteErrorName = (typeof GOV_VOTE_ERROR_NAMES)[number];

const asBigInt = (v: unknown): bigint => (typeof v === "bigint" ? v : BigInt(String(v ?? 0)));
const asText = (v: unknown): string => String(v ?? "");

/** Bản dịch theo tên lỗi; tham số lấy đúng thứ tự khai báo trong GovVote.sol. */
export const GOV_VOTE_ERROR_MESSAGES: Record<
  GovVoteErrorName,
  (args: readonly unknown[]) => string
> = {
  ProposalNotFound: ([id]) => `Không tìm thấy proposal #${asText(id)}.`,
  EmptyTitle: () => "Tiêu đề không được để trống.",
  TitleTooLong: ([len]) => `Tiêu đề dài ${asText(len)} byte, vượt giới hạn 100 byte UTF-8.`,
  DescriptionTooLong: ([len]) => `Mô tả dài ${asText(len)} byte, vượt giới hạn 1.000 byte UTF-8.`,
  BelowThreshold: ([power, required]) =>
    `Voting power của bạn ở block trước là ${formatGov(asBigInt(power))}, chưa đạt ngưỡng tạo proposal ${formatGov(asBigInt(required))}.`,
  NotActive: ([id, state]) =>
    `Proposal #${asText(id)} không ở trạng thái Active (hiện là ${stateLabel(asBigInt(state))}), nên không nhận phiếu.`,
  AlreadyVoted: ([id, voter]) =>
    `Ví ${asText(voter)} đã bỏ phiếu cho proposal #${asText(id)}. Mỗi ví chỉ được bỏ phiếu một lần.`,
  NoVotingPower: ([id, voter]) =>
    `Ví ${asText(voter)} không có voting power tại block snapshot của proposal #${asText(id)}. Cần có GOV và delegate trước block snapshot.`,
  InvalidConfiguration: () => "Cấu hình GovVote không hợp lệ (lỗi khi deploy contract).",
  SnapshotNotFinalized: ([id, snapshot]) =>
    `Proposal #${asText(id)} chưa qua block snapshot ${asText(snapshot)}, nên chưa đọc được dữ liệu này.`,
};

export const USER_REJECTED_MESSAGE = "Bạn đã từ chối giao dịch trong ví";

function isGovVoteErrorName(name: string): name is GovVoteErrorName {
  return (GOV_VOTE_ERROR_NAMES as readonly string[]).includes(name);
}

/** Bản dịch cho một lỗi GovVote đã giải mã; undefined nếu tên không thuộc GovVote. */
export function translateGovError(
  errorName: string,
  args: readonly unknown[] = [],
): string | undefined {
  return isGovVoteErrorName(errorName) ? GOV_VOTE_ERROR_MESSAGES[errorName](args) : undefined;
}

function hasCode4001(e: unknown): boolean {
  return (
    typeof e === "object" && e !== null && "code" in e && (e as { code: unknown }).code === 4001
  );
}

/** Thông báo tiếng Việt cho mọi lỗi phát sinh khi đọc hoặc ghi contract. */
export function toUserMessage(err: unknown): string {
  // (a) Từ chối ký: viem gói thành UserRejectedRequestError; provider thô có thể ném object { code: 4001 }.
  if (err instanceof BaseError) {
    if (err.walk((e) => e instanceof UserRejectedRequestError || hasCode4001(e)))
      return USER_REJECTED_MESSAGE;
  } else if (hasCode4001(err)) {
    return USER_REJECTED_MESSAGE;
  }

  // (b) Revert có custom error đã giải mã theo ABI.
  if (err instanceof BaseError) {
    const reverted = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError && reverted.data?.errorName) {
      const { errorName, args = [] } = reverted.data;
      const vi = translateGovError(errorName, args);
      if (vi) return vi;
      // Lỗi của contract khác (ví dụ GovToken/OpenZeppelin): hiện đúng tên và tham số, không tự dịch.
      return `Contract revert: ${errorName}(${args.map((a) => String(a)).join(", ")})`;
    }
    // (c) Lỗi viem khác: shortMessage là thông báo gốc ngắn gọn.
    return err.details
      ? `${err.shortMessage || "Lỗi RPC"} — ${err.details}`
      : err.shortMessage || err.message;
  }

  // (c) Lỗi không nhận ra: thông báo gốc.
  if (err instanceof Error) return err.message;
  return String(err);
}
