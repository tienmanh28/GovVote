// Phân loại môi trường ví để hiện hướng dẫn phù hợp (hàm thuần, test được).
// MetaMask trên máy tính tiêm (inject) `window.ethereum` vào mọi trang. Trên điện thoại, trình duyệt thường
// (Safari, Chrome) không có `window.ethereum`: phải mở trang trong trình duyệt tích hợp của app MetaMask.

export type WalletEnv = "ready" | "mobile-no-wallet" | "desktop-no-wallet";

export function isMobileDevice(userAgent: string, maxTouchPoints: number): boolean {
  if (/Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(userAgent)) return true;
  // iPadOS 13+ tự nhận là "Macintosh" nhưng có màn hình cảm ứng nhiều điểm.
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
}

export function classifyWalletEnv(hasEthereum: boolean, userAgent: string, maxTouchPoints: number): WalletEnv {
  if (hasEthereum) return "ready";
  return isMobileDevice(userAgent, maxTouchPoints) ? "mobile-no-wallet" : "desktop-no-wallet";
}

/** Deep link mở trang hiện tại trong trình duyệt của app MetaMask (dạng metamask.app.link/dapp/<host><path>). */
export function metaMaskDeepLink(host: string, pathname: string): string {
  return `https://metamask.app.link/dapp/${host}${pathname}`;
}
