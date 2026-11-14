// Máy trạng thái giao dịch (state machine), dạng reducer thuần để unit test được.
//
//   IDLE ──START──► AWAITING_SIGNATURE ──SIGNED(hash)──► PENDING ──CONFIRMED──► SUCCESS
//                          │                                │
//                          └────────FAILED(message)─────────┴──────────────────► ERROR
//   SUCCESS / ERROR ──START──► AWAITING_SIGNATURE (gửi giao dịch mới);  bất kỳ ──RESET──► IDLE
//
// Sự kiện không hợp lệ ở trạng thái hiện tại bị bỏ qua (trả về nguyên trạng thái), ví dụ CONFIRMED khi chưa có hash.
import type { Hex } from "viem";

export type TxState =
  | { status: "IDLE" }
  | { status: "AWAITING_SIGNATURE" }
  | { status: "PENDING"; hash: Hex }
  | { status: "SUCCESS"; hash: Hex }
  | { status: "ERROR"; message: string; hash?: Hex };

export type TxEvent =
  | { type: "START" }
  | { type: "SIGNED"; hash: Hex }
  | { type: "CONFIRMED" }
  | { type: "FAILED"; message: string }
  | { type: "RESET" };

export const TX_IDLE: TxState = { status: "IDLE" };

export function txReducer(state: TxState, event: TxEvent): TxState {
  switch (event.type) {
    case "START":
      return state.status === "IDLE" || state.status === "SUCCESS" || state.status === "ERROR"
        ? { status: "AWAITING_SIGNATURE" }
        : state;
    case "SIGNED":
      return state.status === "AWAITING_SIGNATURE"
        ? { status: "PENDING", hash: event.hash }
        : state;
    case "CONFIRMED":
      return state.status === "PENDING" ? { status: "SUCCESS", hash: state.hash } : state;
    case "FAILED":
      if (state.status === "AWAITING_SIGNATURE") return { status: "ERROR", message: event.message };
      if (state.status === "PENDING")
        return { status: "ERROR", message: event.message, hash: state.hash };
      return state;
    case "RESET":
      return TX_IDLE;
  }
}

export function isBusy(state: TxState): boolean {
  return state.status === "AWAITING_SIGNATURE" || state.status === "PENDING";
}
