// Runner dùng Web APIs chuẩn; codec và JSON-RPC transport do từng adapter cung cấp.
import { chainProfile, chainError } from "../chains.ts";
import {
  addressValid,
  hashValid,
  inputValid,
  verifyEvidence,
  type Evidence,
  type LogPosition,
  type ProposalEvidence,
  type ProposalStorage,
  type VerificationBudget,
  type VerificationContext,
  type VerificationFailureReason,
  type VerificationInput,
  type VerificationResult,
  type VerificationStatus,
  type VoteEvidence,
} from "./core.ts";
export type RpcRequest = (
  method: string,
  params: unknown[],
  signal?: AbortSignal,
) => Promise<unknown>;
export type RpcCodec = {
  encode(target: "gov" | "token", name: string, args: readonly unknown[]): string;
  decode(target: "gov" | "token", name: string, data: string): unknown;
  topic(event: "ProposalCreated" | "VoteCast"): string;
  event(
    event: "ProposalCreated" | "VoteCast",
    log: Record<string, unknown>,
  ): Record<string, unknown>;
};
export type VerificationProgress = {
  requests: number;
  ranges: number;
  logs: number;
  through?: bigint;
  head?: bigint;
};
export const DEFAULT_BUDGET: VerificationBudget = {
  maxRequests: 200,
  maxLogs: 50000,
  maxDurationMs: 60000,
  rangeSize: 10000n,
  retries: 1,
  requestTimeoutMs: 8000,
};
export class VerificationProblem extends Error {
  constructor(
    public status: VerificationStatus,
    public reason: VerificationFailureReason,
    message: string,
  ) {
    super(message);
  }
}
// Tách lỗi JSON-RPC khỏi lỗi mạng để không coi việc từ chối EIP-1898 là kết quả hợp lệ.
export class RpcResponseError extends Error {
  constructor(public readonly code?: number) {
    super("RPC returned error");
  }
}
// Hash xác định đúng một state dù RPC load balancer chuyển request sang node khác.
const stateBlock = (hash: string) => ({ blockHash: hash, requireCanonical: true });
const incomplete = (reason: VerificationFailureReason, message: string): never => {
  throw new VerificationProblem("INCOMPLETE", reason, message);
};
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v))
    return incomplete("MISSING_DATA", "RPC không trả đối tượng bắt buộc.");
  return v as Record<string, unknown>;
}
function uint(v: unknown): bigint {
  if (typeof v === "bigint" && v >= 0n && v < 2n ** 256n) return v;
  if (typeof v === "number" && Number.isSafeInteger(v) && v >= 0) return BigInt(v);
  if (typeof v === "string" && /^0x[0-9a-f]+$/i.test(v)) {
    const n = BigInt(v);
    if (n < 2n ** 256n) return n;
  }
  return incomplete("MISSING_DATA", "Thiếu số nguyên hợp lệ trong dữ liệu RPC.");
}
const hex = (n: bigint) => `0x${n.toString(16)}`;
function position(raw: Record<string, unknown>): LogPosition {
  if (raw.removed === true)
    return incomplete("ANCHOR_CHANGED", "RPC trả log đã bị loại khỏi chain.");
  if (!addressValid(raw.address) || !hashValid(raw.blockHash) || !hashValid(raw.transactionHash))
    return incomplete("MALFORMED_EVENT", "Log thiếu address/hash hợp lệ.");
  return {
    address: raw.address,
    blockHash: raw.blockHash,
    transactionHash: raw.transactionHash,
    blockNumber: uint(raw.blockNumber),
    transactionIndex: uint(raw.transactionIndex),
    logIndex: uint(raw.logIndex),
  };
}
function budgetValid(b: VerificationBudget): boolean {
  return (
    [b.maxRequests, b.maxLogs, b.maxDurationMs, b.requestTimeoutMs].every(
      (n) => Number.isSafeInteger(n) && n > 0,
    ) &&
    Number.isSafeInteger(b.retries) &&
    b.retries >= 0 &&
    b.retries <= 3 &&
    typeof b.rangeSize === "bigint" &&
    b.rangeSize >= 1n &&
    b.rangeSize <= 10000n
  );
}
export async function runVerification(
  input: VerificationInput,
  request: RpcRequest,
  codec: RpcCodec,
  options: { signal?: AbortSignal; onProgress?: (p: VerificationProgress) => void } = {},
): Promise<VerificationResult> {
  const budget = { ...DEFAULT_BUDGET, ...input.budget };
  const start = Date.now();
  let requests = 0,
    processedLogs = 0;
  let context: VerificationContext | undefined;
  const evidence: Evidence = { ranges: [] };
  const finish = (
    status: VerificationStatus,
    reason: VerificationFailureReason,
    message: string,
  ): VerificationResult => ({
    input,
    context,
    evidence,
    status,
    reason,
    message,
    requests,
    processedLogs,
  });
  if (!inputValid(input) || !budgetValid(budget))
    return finish(
      "INVALID_INPUT",
      "INVALID_INPUT",
      chainProfile(input.chainId)
        ? "ID, confirmations hoặc ngân sách không hợp lệ."
        : chainError(input.chainId),
    );
  function check() {
    if (options.signal?.aborted) incomplete("CANCELLED", "Lần kiểm chứng đã bị hủy.");
    if (Date.now() - start >= budget.maxDurationMs)
      incomplete("RESOURCE_LIMIT", "Đã hết ngân sách thời gian.");
  }
  async function rpc(method: string, params: unknown[]): Promise<unknown> {
    for (let attempt = 0; ; attempt++) {
      check();
      if (requests >= budget.maxRequests)
        incomplete("RESOURCE_LIMIT", "Đã hết ngân sách RPC requests.");
      requests++;
      options.onProgress?.({
        requests,
        ranges: evidence.ranges.length,
        logs: processedLogs,
        head: context?.head,
      });
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let abort: (() => void) | undefined;
      const remaining = budget.maxDurationMs - (Date.now() - start);
      try {
        return await Promise.race([
          request(method, params, controller.signal),
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => {
                controller.abort();
                reject(
                  new VerificationProblem(
                    remaining <= budget.requestTimeoutMs ? "INCOMPLETE" : "RPC_ERROR",
                    remaining <= budget.requestTimeoutMs ? "RESOURCE_LIMIT" : "RPC_TIMEOUT",
                    remaining <= budget.requestTimeoutMs
                      ? "Đã hết ngân sách thời gian."
                      : "RPC quá thời gian phản hồi.",
                  ),
                );
              },
              Math.min(remaining, budget.requestTimeoutMs),
            );
            abort = () => {
              controller.abort();
              reject(
                new VerificationProblem("INCOMPLETE", "CANCELLED", "Lần kiểm chứng đã bị hủy."),
              );
            };
            options.signal?.addEventListener("abort", abort, { once: true });
          }),
        ]);
      } catch (err) {
        if (err instanceof VerificationProblem && err.status === "INCOMPLETE") throw err;
        if (err instanceof RpcResponseError && (method === "eth_call" || method === "eth_getCode"))
          return incomplete(
            "MISSING_DATA",
            err.code === -32601 || err.code === -32602
              ? "RPC không hỗ trợ đọc state theo blockHash (EIP-1898); không quay về số block."
              : "RPC từ chối đọc state theo blockHash (EIP-1898), hash có thể không khả dụng; không quay về số block.",
          );
        if (attempt >= budget.retries)
          throw err instanceof VerificationProblem
            ? err
            : new VerificationProblem(
                "RPC_ERROR",
                "RPC_FAILURE",
                `Không đọc được RPC (${method}); vui lòng thử lại.`,
              );
      } finally {
        if (timer !== undefined) clearTimeout(timer);
        if (abort) options.signal?.removeEventListener("abort", abort);
      }
    }
  }
  async function block(n: bigint | "latest") {
    const b = object(await rpc("eth_getBlockByNumber", [n === "latest" ? n : hex(n), false]));
    if (!hashValid(b.hash)) return incomplete("MISSING_DATA", "Không đọc được hash block.");
    const number = uint(b.number);
    if (n !== "latest" && number !== n)
      return incomplete("ANCHOR_CHANGED", "RPC trả sai block tham chiếu.");
    return { number, hash: b.hash };
  }
  async function read(
    target: "gov" | "token",
    address: string,
    name: string,
    args: readonly unknown[],
    at: string,
  ): Promise<unknown> {
    let data: string;
    try {
      data = codec.encode(target, name, args);
    } catch {
      return incomplete("MISSING_DATA", "ABI không hỗ trợ hàm bắt buộc.");
    }
    const raw = await rpc("eth_call", [{ to: address, data }, stateBlock(at)]);
    if (typeof raw !== "string") return incomplete("MISSING_DATA", "RPC thiếu kết quả eth_call.");
    try {
      return codec.decode(target, name, raw);
    } catch {
      return incomplete("MISSING_DATA", "Không giải mã được dữ liệu contract theo ABI.");
    }
  }
  async function logs(event: "ProposalCreated" | "VoteCast", from: bigint, to: bigint) {
    const raw = await rpc("eth_getLogs", [
      {
        address: input.govVote,
        topics: [codec.topic(event), `0x${input.proposalId.toString(16).padStart(64, "0")}`],
        fromBlock: hex(from),
        toBlock: hex(to),
      },
    ]);
    if (!Array.isArray(raw)) return incomplete("MISSING_DATA", "RPC không trả danh sách logs.");
    if (processedLogs + raw.length > budget.maxLogs)
      return incomplete("RESOURCE_LIMIT", "Đã vượt ngân sách số logs.");
    processedLogs += raw.length;
    return raw.map((entry: unknown) => {
      check();
      const l = object(entry);
      const pos = position(l);
      let args: Record<string, unknown>;
      try {
        args = codec.event(event, l);
      } catch {
        return incomplete(
          "MALFORMED_EVENT",
          "Event không giải mã được theo ABI; không bỏ qua log.",
        );
      }
      return { pos, args };
    });
  }
  try {
    const chainId = uint(await rpc("eth_chainId", []));
    if (chainId !== input.chainId)
      return finish(
        "INVALID_INPUT",
        "WRONG_CHAIN",
        // Dừng ngay sau eth_chainId, trước mọi phép đọc state hoặc log.
        chainProfile(chainId)
          ? `RPC trả sai chain ID; cấu hình cần ${input.chainId}.`
          : chainError(chainId),
      );
    const latest = await block("latest");
    const head = latest.number - input.confirmations;
    if (head < 1n)
      return finish("INCOMPLETE", "NOT_CONFIRMED", "Chưa đủ block xác nhận để chọn H.");
    const anchor = await block(head);
    context = {
      chainId,
      latest: latest.number,
      head,
      hash: anchor.hash,
      checkedAt: new Date().toISOString(),
      anchorStable: false,
      token: "",
      delay: 0n,
      period: 0n,
      provenance: chainProfile(input.chainId)!.provenance,
    };
    const govCode = await rpc("eth_getCode", [input.govVote, stateBlock(anchor.hash)]);
    if (typeof govCode !== "string" || !/^0x(?:[0-9a-f]{2})+$/i.test(govCode))
      return finish("INVALID_INPUT", "NO_CODE", "GovVote không có bytecode tại H.");
    const count = uint(await read("gov", input.govVote, "proposalCount", [], anchor.hash));
    if (input.proposalId > count) {
      // Chỉ dùng latest để phân biệt ID chưa đủ confirmations; vẫn ghim hash đã quan sát.
      const latestCount = uint(await read("gov", input.govVote, "proposalCount", [], latest.hash));
      return input.proposalId <= latestCount
        ? finish("INCOMPLETE", "NOT_CONFIRMED", "Proposal chưa đủ block xác nhận tại H.")
        : finish("INVALID_INPUT", "INVALID_INPUT", "Không tồn tại proposal ID này.");
    }
    const token = await read("gov", input.govVote, "token", [], anchor.hash);
    if (
      !addressValid(token) ||
      (input.govToken && token.toLowerCase() !== input.govToken.toLowerCase())
    )
      return finish("MISMATCH", "PROPOSAL_MISMATCH", "Địa chỉ token không khớp cấu hình.");
    context.token = token;
    const code = await rpc("eth_getCode", [token, stateBlock(anchor.hash)]);
    if (typeof code !== "string" || !/^0x(?:[0-9a-f]{2})+$/i.test(code))
      return finish("INVALID_INPUT", "NO_CODE", "GovToken không có bytecode tại H.");
    context.delay = uint(await read("gov", input.govVote, "votingDelayBlocks", [], anchor.hash));
    context.period = uint(await read("gov", input.govVote, "votingPeriodBlocks", [], anchor.hash));
    const p = object(
      await read("gov", input.govVote, "getProposal", [input.proposalId], anchor.hash),
    );
    if (
      !addressValid(p.proposer) ||
      typeof p.title !== "string" ||
      typeof p.description !== "string"
    )
      return incomplete("MISSING_DATA", "Storage proposal thiếu metadata.");
    const proposal: ProposalStorage = {
      proposer: p.proposer,
      title: p.title,
      description: p.description,
      createdBlock: uint(p.createdBlock),
      snapshotBlock: uint(p.snapshotBlock),
      deadlineBlock: uint(p.deadlineBlock),
      forVotes: uint(p.forVotes),
      againstVotes: uint(p.againstVotes),
    };
    evidence.proposal = proposal;
    if (proposal.createdBlock > head)
      return finish("INCOMPLETE", "NOT_CONFIRMED", "Proposal chưa được xác nhận tại H.");
    const creation = await logs("ProposalCreated", proposal.createdBlock, proposal.createdBlock);
    const created = new Map<string, ProposalEvidence>();
    for (const { pos, args } of creation) {
      if (!addressValid(args.proposer) || typeof args.title !== "string")
        return incomplete("MALFORMED_EVENT", "ProposalCreated thiếu metadata.");
      const e: ProposalEvidence = {
        ...pos,
        id: uint(args.id),
        proposer: args.proposer,
        title: args.title,
        snapshotBlock: uint(args.snapshotBlock),
        deadlineBlock: uint(args.deadlineBlock),
      };
      const key = `${pos.transactionHash.toLowerCase()}:${pos.logIndex}`;
      const previous = created.get(key);
      if (
        previous &&
        !(
          previous.address.toLowerCase() === e.address.toLowerCase() &&
          previous.blockHash.toLowerCase() === e.blockHash.toLowerCase() &&
          previous.blockNumber === e.blockNumber &&
          previous.transactionHash.toLowerCase() === e.transactionHash.toLowerCase() &&
          previous.transactionIndex === e.transactionIndex &&
          previous.logIndex === e.logIndex &&
          previous.id === e.id &&
          previous.proposer.toLowerCase() === e.proposer.toLowerCase() &&
          previous.title === e.title &&
          previous.snapshotBlock === e.snapshotBlock &&
          previous.deadlineBlock === e.deadlineBlock
        )
      )
        return finish(
          "MISMATCH",
          "DUPLICATE_LOG_CONFLICT",
          "ProposalCreated trùng khóa nhưng nội dung khác.",
        );
      created.set(key, e);
    }
    if (created.size === 0)
      return finish("INCOMPLETE", "MISSING_DATA", "Không tìm thấy ProposalCreated bắt buộc.");
    if (created.size !== 1)
      return finish(
        "MISMATCH",
        "PROPOSAL_MISMATCH",
        "Có nhiều ProposalCreated khác nhau cho cùng ID.",
      );
    evidence.created = [...created.values()][0]!;
    const creationBlock = await block(proposal.createdBlock);
    if (creationBlock.hash.toLowerCase() !== evidence.created.blockHash.toLowerCase())
      return finish("INCOMPLETE", "ANCHOR_CHANGED", "Hash block ProposalCreated không khớp.");
    evidence.votes = [];
    for (let from = proposal.createdBlock; from <= head; from += budget.rangeSize) {
      const to = from + budget.rangeSize - 1n < head ? from + budget.rangeSize - 1n : head;
      for (const { pos, args } of await logs("VoteCast", from, to)) {
        if (!addressValid(args.voter) || typeof args.support !== "boolean")
          return incomplete("MALFORMED_EVENT", "VoteCast thiếu voter hoặc support.");
        const v: VoteEvidence = {
          ...pos,
          id: uint(args.id),
          voter: args.voter,
          support: args.support,
          weight: uint(args.weight),
        };
        evidence.votes.push(v);
      }
      evidence.ranges.push({ from, to });
      options.onProgress?.({
        requests,
        ranges: evidence.ranges.length,
        logs: processedLogs,
        through: to,
        head,
      });
    }
    evidence.contractState = uint(
      await read("gov", input.govVote, "state", [input.proposalId], anchor.hash),
    );
    if (head > proposal.snapshotBlock)
      evidence.quorum = {
        pastTotalSupply: uint(
          await read("token", token, "getPastTotalSupply", [proposal.snapshotBlock], anchor.hash),
        ),
        quorumBps: uint(await read("gov", input.govVote, "quorumBps", [], anchor.hash)),
        contractQuorum: uint(
          await read("gov", input.govVote, "quorumVotes", [input.proposalId], anchor.hash),
        ),
      };
    const finalAnchor = await block(head);
    check();
    context.checkedAt = new Date().toISOString();
    context.anchorStable = finalAnchor.hash.toLowerCase() === context.hash.toLowerCase();
    const result = verifyEvidence(input, context, evidence);
    check();
    return { ...result, requests, processedLogs };
  } catch (err) {
    if (err instanceof VerificationProblem) return finish(err.status, err.reason, err.message);
    return finish(
      "INCOMPLETE",
      "MISSING_DATA",
      "Dữ liệu không hợp lệ; chưa thể hoàn tất kiểm chứng.",
    );
  }
}
// Chung chính sách exit codes cho strict CLI. API legacy vẫn giữ ngữ nghĩa riêng.
export function verificationExit(status: VerificationStatus): number {
  return status === "VERIFIED" ? 0 : status === "MISMATCH" ? 1 : status === "INCOMPLETE" ? 3 : 2;
}
