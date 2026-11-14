// Khung ứng dụng: header (điều hướng, block hiện tại, ví) và routing theo hash (#/...).
// Routing theo hash để chạy được trên mọi static hosting mà không cần cấu hình server, và không thêm thư viện router.
import { useEffect, useState } from "react";
import { ConfigGuard } from "./components/ConfigGuard.tsx";
import { ConnectBar } from "./components/ConnectBar.tsx";
import { useWallet } from "./appContext.ts";
import { sessionKey } from "./lib/session.ts";
import { BlockGuard } from "./components/BlockGuard.tsx";
import { Notice } from "./components/ui.tsx";
import { parseRoute, type Route } from "./lib/route.ts";
import { useCurrentBlock } from "./lib/useCurrentBlock.ts";
import { CreateProposal } from "./pages/CreateProposal.tsx";
import { ProposalDetail } from "./pages/ProposalDetail.tsx";
import { ProposalList } from "./pages/ProposalList.tsx";
import { VerifyProposal } from "./pages/VerifyProposal.tsx";
import { WalletDashboard } from "./pages/WalletDashboard.tsx";

function useRoute(): Route {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const on = () => {
      setHash(window.location.hash);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return parseRoute(hash);
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: string }) {
  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold ${active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-200"}`}
    >
      {children}
    </a>
  );
}

function BlockInfo() {
  const block = useCurrentBlock();
  return (
    <p className="text-xs text-slate-600" data-testid="current-block">
      Block hiện tại: <span className="font-semibold">{block?.toString() ?? "…"}</span> (số block, không phải thời gian thực)
    </p>
  );
}

export function App() {
  const wallet = useWallet();
  const route = useRoute();
  const page =
    route.name === "verify" ? (
      <VerifyProposal key={route.id.toString()} id={route.id} />
    ) : route.name === "list" ? (
      <ProposalList />
    ) : route.name === "detail" ? (
      <ProposalDetail key={route.id.toString()} id={route.id} />
    ) : route.name === "create" ? (
      <CreateProposal />
    ) : route.name === "wallet" ? (
      <WalletDashboard />
    ) : (
      <Notice tone="error">Không có trang này.</Notice>
    );

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <a href="#/" className="text-lg font-bold">
              GovVote
            </a>
            <BlockInfo />
          </div>
          <nav className="flex flex-wrap gap-1" aria-label="Điều hướng chính">
            <NavLink href="#/" active={route.name === "list" || route.name === "detail"}>
              Proposal
            </NavLink>
            <NavLink href="#/create" active={route.name === "create"}>
              Tạo proposal
            </NavLink>
            <NavLink href="#/wallet" active={route.name === "wallet"}>
              Ví của tôi
            </NavLink>
          </nav>
          <ConnectBar />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        {route.name === "verify" ? page : <ConfigGuard><BlockGuard><div key={sessionKey(wallet)}>{page}</div></BlockGuard></ConfigGuard>}
      </main>
      <footer className="mx-auto max-w-5xl px-4 pb-8 text-xs text-slate-500">
        GovVote v1.1 · Anvil local (chainId 31337) · DAO Voting DApp, không tự thực thi kết quả.
      </footer>
    </div>
  );
}
