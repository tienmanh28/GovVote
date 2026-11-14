// Verification không cần ví; không có thao tác ký hoặc gửi giao dịch.
import { useState } from "react";
import { useAppConfig } from "../appContext.ts";
import { Button, Card, Notice, Stat } from "../components/ui.tsx";
import { formatGov, stateLabel } from "../lib/format.ts";
import { useVoteVerification } from "../lib/useVoteVerification.ts";
import { rpcSource } from "../../../shared/verification/http.ts";
export function VerifyProposal({ id }: { id: bigint }) {
  const cfg = useAppConfig();
  const [confirmations, setConfirmations] = useState("12");
  const { result, progress, run } = useVoteVerification(id, confirmations);
  const status = result?.status ?? "IDLE",
    context = result?.context,
    evidence = result?.evidence,
    calculated = result?.calculated;
  const p = evidence?.proposal,
    q = evidence?.quorum;
  const amount = (v: bigint | undefined) => (v === undefined ? "Chưa có dữ liệu" : formatGov(v));
  return (
    <div className="space-y-4" data-testid="verification-page">
      <h1 className="text-xl font-bold">Xác minh proposal #{id.toString()}</h1>
      <a
        href={`#/proposal/${id}`}
        className="inline-flex min-h-11 items-center text-sky-800 underline"
      >
        Xem proposal
      </a>
      <Notice>
        Kiểm chứng tính nhất quán tại một block. VERIFIED không đồng nghĩa proposal được thông qua,
        contract đã audit hoặc source đã verify trên Etherscan. Chỉ dùng Anvil local; không cần kết
        nối ví.
      </Notice>
      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <Stat label="Chain ID" value={cfg.chainId.toString()} />
          <Stat
            label="GovVote"
            value={<span className="break-all font-mono">{cfg.govVote}</span>}
          />
          <Stat
            label="Nguồn RPC (ẩn credentials/path)"
            value={result?.input.rpcSource ?? rpcSource(cfg.primaryRpcUrl ?? cfg.rpcUrl)}
          />
          <Stat label="Block tham chiếu H" value={context?.head.toString() ?? "Chưa chọn"} />
          <Stat
            label="Latest lúc bắt đầu"
            value={context?.latest.toString() ?? "Chưa có dữ liệu"}
          />
          <Stat
            label="Hoàn tất verification thành công trong phiên"
            value={status === "VERIFIED" ? (context?.checkedAt ?? "Chưa có") : "Chưa có"}
          />
        </div>
        <p className="mt-3 text-sm break-all">Hash H: {context?.hash ?? "Chưa có dữ liệu"}</p>
        <p className="mt-2 text-xs">
          Deployment evidence local: kiểm bytecode, token liên kết và ProposalCreated đối chiếu
          storage. Không phải chứng nhận nguồn contract công khai. Weight từng voter chưa đối chiếu
          getPastVotes.
        </p>
      </Card>
      <Card>
        <label htmlFor="verify-confirmations" className="block">
          Số block phía sau H (confirmations)
        </label>
        <input
          id="verify-confirmations"
          className="mt-2 min-h-11 w-full rounded border border-slate-300 px-3 sm:w-40"
          inputMode="numeric"
          value={confirmations}
          onChange={(e) => setConfirmations(e.target.value)}
        />
        <p className="mt-2 text-xs">
          H = latest − confirmations; mặc định 12, tối thiểu 1. Đây là chính sách xác nhận, không
          bảo đảm finality tuyệt đối.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Button onClick={() => void run()}>{status === "RUNNING" ? "Chạy lại" : "Verify"}</Button>
          {result && !["IDLE", "RUNNING", "VERIFIED"].includes(status) && (
            <Button variant="secondary" onClick={() => void run()}>
              Retry — Thử lại
            </Button>
          )}
        </div>
        <p className="mt-3 text-sm" data-testid="verify-progress">
          Tiến độ: {progress?.requests ?? 0} requests; {progress?.ranges ?? 0} ranges;{" "}
          {progress?.logs ?? 0} logs (gồm ProposalCreated).{" "}
          {progress?.through !== undefined ? `Đã quét tới block ${progress.through}.` : ""}
        </p>
      </Card>
      <div data-testid="verify-verdict" data-status={status}>
        <Notice
          tone={
            status === "MISMATCH" || status === "RPC_ERROR" || status === "INVALID_INPUT"
              ? "error"
              : "info"
          }
          title={status}
        >
          {result?.message ?? "Bấm Verify để bắt đầu đọc bằng chứng."}
          {result?.reason && <p>Mã lý do: {result.reason}</p>}
        </Notice>
      </div>
      <Card>
        <h2 className="font-semibold">Vote evidence</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Stat label="For từ event" value={amount(calculated?.forVotes)} />
          <Stat label="Against từ event" value={amount(calculated?.againstVotes)} />
          <Stat label="For từ storage tại H" value={amount(p?.forVotes)} />
          <Stat label="Against từ storage tại H" value={amount(p?.againstVotes)} />
          <Stat label="Participation (For + Against)" value={amount(calculated?.participation)} />
          <Stat
            label="Vote logs duy nhất"
            value={calculated?.uniqueLogs.toString() ?? "Chưa đối chiếu"}
          />
        </div>
      </Card>
      <Card>
        <h2 className="font-semibold">Quorum tại snapshot</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Stat label="Snapshot block" value={p?.snapshotBlock.toString() ?? "Chưa có dữ liệu"} />
          <Stat label="Historical total supply" value={amount(q?.pastTotalSupply)} />
          <Stat label="Quorum bps" value={q?.quorumBps.toString() ?? "Chưa có dữ liệu"} />
          <Stat
            label="Quorum tính lại / contract"
            value={`${amount(calculated?.quorum)} / ${amount(q?.contractQuorum)}`}
          />
        </div>
        <p className="mt-3 text-sm">
          {calculated && q
            ? `Đối chiếu quorum: ${calculated.quorum === q.contractQuorum ? "Khớp" : "Không khớp"}. Participation/quorum: ${formatGov(calculated.participation)} / ${formatGov(calculated.quorum)}.`
            : "Chưa đủ dữ liệu để kết luận quorum; snapshot có thể chưa chốt."}
        </p>
      </Card>
      <Card>
        <h2 className="font-semibold">State verification</h2>
        <p className="mt-2">
          Expected: {calculated ? stateLabel(calculated.expectedState) : "Chưa tính đủ"}
        </p>
        <p>
          Contract tại H:{" "}
          {evidence?.contractState !== undefined ? stateLabel(evidence.contractState) : "Chưa đọc"}
        </p>
        <p>
          Đối chiếu:{" "}
          {calculated && evidence?.contractState !== undefined
            ? calculated.expectedState === evidence.contractState
              ? "Khớp"
              : "Không khớp"
            : "Chưa đủ dữ liệu"}
        </p>
        <p className="mt-2 text-sm">
          {evidence?.contractState === 0n || evidence?.contractState === 1n
            ? "Kết quả bỏ phiếu chưa cuối cùng tại H."
            : evidence?.contractState !== undefined
              ? "Proposal đã kết thúc tại H; xem state để biết thông qua hay không."
              : "Chưa xác định kết quả bỏ phiếu."}
        </p>
      </Card>
      <Card>
        <h2 className="font-semibold">Tự kiểm bằng CLI</h2>
        <p className="mt-2 text-sm">
          Từ scripts/verify, chạy với RPC local và địa chỉ deployment đã kiểm tra:
        </p>
        <pre className="mt-2 whitespace-pre-wrap break-all text-xs">{`GOV_VOTE=${cfg.govVote} GOV_TOKEN=${cfg.govToken} GOV_PROPOSAL_ID=${id} GOV_CONFIRMATIONS=${/^\d+$/.test(confirmations) ? BigInt(confirmations) : 12n} npm run verify`}</pre>
        <p className="mt-2 text-xs">
          Cả event và storage cùng tin vào một RPC; dữ liệu sai nhất quán có thể không bị phát hiện.
          Ngân sách mặc định: 200 requests, 50.000 logs, 60 giây, ranges tối đa 10.000 block, một
          request tại một thời điểm. Đạt giới hạn sẽ không VERIFIED.
        </p>
      </Card>
    </div>
  );
}
