// Định dạng hiển thị (hàm thuần, không gọi RPC).
import { formatEther, type Address } from "viem";

/**
 * wei → chuỗi GOV có đơn vị, dấu "." phân cách hàng nghìn và "," cho phần thập phân.
 * Ví dụ: 600000000000000000000000n → "600.000 GOV". Dùng formatEther của viem nên không mất độ chính xác
 * (không đổi sang Number).
 */
export function formatGov(wei: bigint): string {
  const negative = wei < 0n;
  const [intPart = "0", fracPart] = formatEther(negative ? -wei : wei).split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}${grouped}${fracPart ? `,${fracPart}` : ""} GOV`;
}

/** 0x7099…79C8: rút gọn địa chỉ để không tràn màn hình hẹp. Địa chỉ đầy đủ vẫn hiện ở chỗ cần đối chiếu. */
export function shortAddress(address: Address | string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

/** Thứ tự phải khớp enum State trong src/GovVote.sol: Pending, Active, Succeeded, Defeated. */
export const STATE_LABELS = [
  { name: "Pending", vi: "Chờ snapshot", tone: "bg-amber-100 text-amber-900" },
  { name: "Active", vi: "Đang bỏ phiếu", tone: "bg-sky-100 text-sky-900" },
  { name: "Succeeded", vi: "Thông qua", tone: "bg-emerald-100 text-emerald-900" },
  { name: "Defeated", vi: "Không thông qua", tone: "bg-rose-100 text-rose-900" },
] as const;

export function stateLabel(state: number | bigint): string {
  const s = STATE_LABELS[Number(state)];
  return s ? `${s.vi} (${s.name})` : `Trạng thái không xác định (${String(state)})`;
}
