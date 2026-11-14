// RPC fixture dùng ABI thật để encode kết quả. Không forwarding tới blockchain.
import {
  decodeFunctionData,
  encodeFunctionResult,
  encodeEventTopics,
  encodeAbiParameters,
  type Hex,
} from "viem";
import { govVoteAbi } from "../src/abi/govVote.ts";
import { govTokenAbi } from "../src/abi/govToken.ts";
import { fixture, hash } from "../../shared/verification/fixtures.ts";
import type { ProposalEvidence, VoteEvidence } from "../../shared/verification/core.ts";
import type { RpcRequest } from "../../shared/verification/runner.ts";
export function rawEvent(kind: "ProposalCreated" | "VoteCast", e: ProposalEvidence | VoteEvidence) {
  const topics =
    kind === "ProposalCreated"
      ? encodeEventTopics({
          abi: govVoteAbi,
          eventName: "ProposalCreated",
          args: { id: e.id, proposer: (e as ProposalEvidence).proposer as Hex },
        })
      : encodeEventTopics({
          abi: govVoteAbi,
          eventName: "VoteCast",
          args: { id: e.id, voter: (e as VoteEvidence).voter as Hex },
        });
  const data =
    kind === "ProposalCreated"
      ? encodeAbiParameters(
          [{ type: "uint256" }, { type: "uint256" }, { type: "string" }],
          [
            (e as ProposalEvidence).snapshotBlock,
            (e as ProposalEvidence).deadlineBlock,
            (e as ProposalEvidence).title,
          ],
        )
      : encodeAbiParameters(
          [{ type: "bool" }, { type: "uint256" }],
          [(e as VoteEvidence).support, (e as VoteEvidence).weight],
        );
  return {
    address: e.address,
    blockNumber: `0x${e.blockNumber.toString(16)}`,
    blockHash: e.blockHash,
    transactionHash: e.transactionHash,
    transactionIndex: `0x${e.transactionIndex.toString(16)}`,
    logIndex: `0x${e.logIndex.toString(16)}`,
    removed: false,
    topics,
    data,
  };
}
export function rpcFixture(options: { allowUnpinnedReads?: boolean } = {}) {
  const f = fixture();
  const calls: { method: string; params: unknown[] }[] = [];
  // Cho phép đổi confirmations: chỉ nhận hash đã thực sự trả qua block RPC.
  const observedHashes = new Set<string>();
  const control = {
    fail: false,
    reorg: false,
    malformed: false,
    missingCreation: false,
    noCode: false,
    missingResult: false,
    headReads: 0,
    missingVotes: false,
  };
  const request: RpcRequest = async (method, params) => {
    calls.push({ method, params });
    if (control.fail) throw new Error("RPC failure");
    if (method === "eth_chainId") return "0x7a69";
    if (method === "eth_getBlockByNumber") {
      const number = params[0] === "latest" ? f.context.latest : BigInt(String(params[0]));
      if (number === f.context.head) control.headReads++;
      const blockHash =
        control.reorg && control.headReads > 1 && number === f.context.head
          ? hash(99999)
          : hash(number);
      observedHashes.add(blockHash);
      return { number: `0x${number.toString(16)}`, hash: blockHash };
    }
    // Fixture kiểm đúng selector; không cho test vô tình dùng lại số block.
    if (
      (method === "eth_getCode" || method === "eth_call") &&
      // UI thường vẫn đọc theo số block; chỉ fixture reliability kết hợp UI/strict mới opt-in.
      !(options.allowUnpinnedReads && typeof params[1] === "string")
    ) {
      const selector = params[1] as { blockHash?: string; requireCanonical?: boolean };
      if (selector?.requireCanonical !== true || !observedHashes.has(selector.blockHash ?? ""))
        throw new Error("Fixture yêu cầu EIP-1898 với hash đã quan sát");
    }
    if (method === "eth_getCode") return control.noCode ? "0x" : "0x6000";
    if (method === "eth_call") {
      const call = params[0] as { to: string; data: Hex };
      const abi =
        call.to.toLowerCase() === f.input.govVote.toLowerCase() ? govVoteAbi : govTokenAbi;
      const decoded = decodeFunctionData({ abi, data: call.data });
      const name = decoded.functionName;
      const result =
        name === "proposalCount"
          ? 2n
          : name === "token"
            ? f.context.token
            : name === "votingDelayBlocks"
              ? f.context.delay
              : name === "votingPeriodBlocks"
                ? f.context.period
                : name === "getProposal"
                  ? f.evidence.proposal
                  : name === "state"
                    ? Number(f.evidence.contractState)
                    : name === "quorumBps"
                      ? f.evidence.quorum!.quorumBps
                      : name === "quorumVotes"
                        ? f.evidence.quorum!.contractQuorum
                        : name === "getPastTotalSupply"
                          ? f.evidence.quorum!.pastTotalSupply
                          : undefined;
      if (control.missingResult) return "0x";
      return encodeFunctionResult({ abi, functionName: name as never, result: result as never });
    }
    if (method === "eth_getLogs") {
      const filter = params[0] as { topics: string[]; fromBlock: string; toBlock: string };
      if (
        filter.topics[0] === encodeEventTopics({ abi: govVoteAbi, eventName: "ProposalCreated" })[0]
      )
        return control.missingCreation ? [] : [rawEvent("ProposalCreated", f.evidence.created!)];
      const result = control.missingVotes
        ? []
        : f.evidence
            .votes!.filter(
              (v) =>
                v.blockNumber >= BigInt(filter.fromBlock) &&
                v.blockNumber <= BigInt(filter.toBlock),
            )
            .map((v) => rawEvent("VoteCast", v));
      if (control.malformed && result[0]) result[0].data = "0x1234";
      return result;
    }
    throw new Error(`Unexpected RPC ${method}`);
  };
  return { f, control, calls, request };
}
