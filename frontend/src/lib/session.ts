// Một phiên gồm kết nối, account và chain; đổi rồi quay lại vẫn hủy công việc cũ.
export type WalletIdentity = { address?: string; chainId?: number; isConnected?: boolean };
export function sessionKey(w: WalletIdentity): string {
  return `${!!w.isConnected}:${w.address?.toLowerCase() ?? ""}:${w.chainId ?? ""}`;
}
export function createSessionScope(read: () => WalletIdentity) {
  let generation = 0;
  return {
    invalidate() {
      generation++;
    },
    capture() {
      const start = generation;
      const identity = sessionKey(read());
      return () => {
        if (start !== generation || identity !== sessionKey(read()) || !read().isConnected)
          throw new Error("Ví hoặc mạng đã thay đổi. Vui lòng kiểm tra dữ liệu và thử lại.");
      };
    },
  };
}
