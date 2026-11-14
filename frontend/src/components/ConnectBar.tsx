// Thanh trạng thái ví: 4 trường hợp được hiển thị rõ ràng.
//   a. Điện thoại/máy tính bảng không có window.ethereum → hướng dẫn mở trang trong trình duyệt của app MetaMask.
//   b. Máy tính không có window.ethereum → hướng dẫn cài MetaMask.
//   c. Ví đang ở chain khác → nút chuyển mạng. wagmi gọi wallet_switchEthereumChain; nếu ví chưa biết
//      chain (lỗi 4902) thì gọi wallet_addEthereumChain với thông tin chain trong config.ts rồi chuyển.
//   d. Chưa kết nối → nút "Kết nối MetaMask"; đã kết nối → địa chỉ ví.
import { useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { useAppConfig, useWallet } from "../appContext.ts";
import { toUserMessage } from "../errors.ts";
import { shortAddress } from "../lib/format.ts";
import { classifyWalletEnv, metaMaskDeepLink } from "../lib/walletEnv.ts";
import { Button, Notice } from "./ui.tsx";

export function ConnectBar() {
  const cfg = useAppConfig();
  const { address, isConnected, chainId, wrongChain } = useWallet();
  const { connectors, connect, isPending: connecting, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching, error: switchError } = useSwitchChain();

  const env = classifyWalletEnv(
    typeof window !== "undefined" &&
      typeof (window as { ethereum?: unknown }).ethereum !== "undefined",
    navigator.userAgent,
    navigator.maxTouchPoints ?? 0,
  );

  if (env === "mobile-no-wallet") {
    const link = metaMaskDeepLink(window.location.host, window.location.pathname);
    return (
      <div data-testid="wallet-mobile-guide">
        <Notice tone="warn" title="Trình duyệt này không có ví">
          <p>
            Trên điện thoại và máy tính bảng, trình duyệt thường (Safari, Chrome) không kết nối được
            MetaMask.
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Cài và mở ứng dụng MetaMask.</li>
            <li>Vào mục Trình duyệt (Browser) bên trong ứng dụng MetaMask.</li>
            <li>Mở lại địa chỉ trang này trong trình duyệt đó.</li>
          </ol>
          <p className="mt-2">
            Hoặc mở liên kết:{" "}
            <a className="font-semibold underline break-all" href={link}>
              {link}
            </a>
          </p>
          <p className="mt-2 text-xs">
            Bạn vẫn xem được proposal mà không cần ví. Cần ví để delegate, tạo proposal và bỏ phiếu.
          </p>
        </Notice>
      </div>
    );
  }

  if (env === "desktop-no-wallet") {
    return (
      <div data-testid="wallet-desktop-guide">
        <Notice tone="warn" title="Chưa phát hiện MetaMask">
          <p>
            Cài tiện ích MetaMask cho trình duyệt tại{" "}
            <a
              className="font-semibold underline"
              href="https://metamask.io/download/"
              target="_blank"
              rel="noreferrer"
            >
              metamask.io/download
            </a>{" "}
            rồi tải lại trang. Bạn vẫn xem được proposal mà không cần ví.
          </p>
        </Notice>
      </div>
    );
  }

  if (!isConnected) {
    const connector = connectors[0];
    return (
      <div className="flex flex-wrap items-center gap-3" data-testid="wallet-disconnected">
        <Button
          disabled={!connector || connecting}
          onClick={() => connector && connect({ connector, chainId: cfg.chainId })}
        >
          {connecting ? "Đang kết nối…" : "Kết nối MetaMask"}
        </Button>
        {connectError && <Notice tone="error">{toUserMessage(connectError)}</Notice>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="rounded-lg bg-white px-3 py-2 font-mono text-sm ring-1 ring-slate-200"
          data-testid="wallet-address"
          title={address}
        >
          {address ? shortAddress(address) : ""}
        </span>
        <Button variant="secondary" onClick={() => disconnect()}>
          Ngắt kết nối
        </Button>
      </div>
      {wrongChain && (
        <div data-testid="wrong-chain">
          <Notice tone="error" title="Ví đang ở sai mạng">
            <p>
              Ví đang ở chainId {String(chainId)}, trang này cần Anvil local (chainId {cfg.chainId}
              ). Đọc dữ liệu vẫn được, nhưng không gửi giao dịch được cho tới khi chuyển mạng.
            </p>
            <Button
              className="mt-2"
              disabled={switching}
              onClick={() => switchChain({ chainId: cfg.chainId })}
            >
              {switching ? "Đang chuyển…" : "Chuyển sang mạng Anvil (31337)"}
            </Button>
            {switchError && <p className="mt-2">{toUserMessage(switchError)}</p>}
          </Notice>
        </div>
      )}
    </div>
  );
}
