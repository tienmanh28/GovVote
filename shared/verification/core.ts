// Core thuần: chỉ nhận evidence, không RPC, React, Node hoặc viem.
export type VerificationStatus = "VERIFIED" | "MISMATCH" | "INCOMPLETE" | "RPC_ERROR" | "IDLE" | "RUNNING" | "INVALID_INPUT";
export type VerificationFailureReason = "INVALID_INPUT" | "WRONG_CHAIN" | "NO_CODE" | "MISSING_DATA" | "MALFORMED_EVENT" | "RESOURCE_LIMIT" | "CANCELLED" | "ANCHOR_CHANGED" | "NOT_CONFIRMED" | "SNAPSHOT_NOT_FINALIZED" | "PROPOSAL_MISMATCH" | "DUPLICATE_LOG_CONFLICT" | "DUPLICATE_VOTER" | "TALLY_MISMATCH" | "QUORUM_MISMATCH" | "STATE_MISMATCH" | "RPC_FAILURE" | "RPC_TIMEOUT" | "EVENT_SCOPE";
export type VerificationBudget = { maxRequests: number; maxLogs: number; maxDurationMs: number; rangeSize: bigint; retries: number; requestTimeoutMs: number };
export type VerificationInput = { chainId: bigint; govVote: string; govToken?: string; proposalId: bigint; confirmations: bigint; rpcSource: string; budget?: Partial<VerificationBudget> };
export type VerificationContext = { chainId: bigint; latest: bigint; head: bigint; hash: string; checkedAt: string; anchorStable: boolean; token: string; delay: bigint; period: bigint; provenance: "LOCAL_DEPLOYMENT_EVIDENCE" };
export type ProposalStorage = { proposer: string; title: string; description: string; createdBlock: bigint; snapshotBlock: bigint; deadlineBlock: bigint; forVotes: bigint; againstVotes: bigint };
export type LogPosition = { address: string; blockNumber: bigint; blockHash: string; transactionHash: string; transactionIndex: bigint; logIndex: bigint };
export type ProposalEvidence = LogPosition & { id: bigint; proposer: string; title: string; snapshotBlock: bigint; deadlineBlock: bigint };
export type VoteEvidence = LogPosition & { id: bigint; voter: string; support: boolean; weight: bigint };
export type QuorumEvidence = { pastTotalSupply: bigint; quorumBps: bigint; contractQuorum: bigint };
export type Evidence = { proposal?: ProposalStorage; created?: ProposalEvidence; votes?: VoteEvidence[]; quorum?: QuorumEvidence; contractState?: bigint; ranges: { from: bigint; to: bigint }[] };
export type VerificationResult = {
 status: VerificationStatus; reason?: VerificationFailureReason; message: string;
 input: VerificationInput; context?: VerificationContext; evidence?: Evidence;
 calculated?: { forVotes: bigint; againstVotes: bigint; participation: bigint; quorum: bigint; expectedState: bigint; uniqueLogs: number };
 requests: number; processedLogs: number;
};
export const addressValid = (s: unknown): s is string => typeof s === "string" && /^0x[0-9a-fA-F]{40}$/.test(s) && !/^0x0{40}$/i.test(s);
export const hashValid = (s: unknown): s is string => typeof s === "string" && /^0x[0-9a-fA-F]{64}$/.test(s);
const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const uint = (n: unknown): n is bigint => typeof n === "bigint" && n >= 0n && n < 2n ** 256n;
export function inputValid(i: VerificationInput): boolean {
 return i.chainId === 31337n && addressValid(i.govVote) && (i.govToken === undefined || addressValid(i.govToken)) && uint(i.proposalId) && i.proposalId > 0n && uint(i.confirmations) && i.confirmations >= 1n;
}
export function expectedState(head: bigint, p: ProposalStorage, participation: bigint, quorum: bigint): bigint {
 if (head <= p.snapshotBlock) return 0n;
 if (head <= p.deadlineBlock) return 1n;
 return participation >= quorum && p.forVotes > p.againstVotes ? 2n : 3n;
}
export function calculateQuorum(supply: bigint, bps: bigint): bigint { return (supply * bps + 9999n) / 10000n; }
function positionValid(l: LogPosition): boolean {
 return addressValid(l.address) && hashValid(l.blockHash) && hashValid(l.transactionHash) && uint(l.blockNumber) && uint(l.transactionIndex) && uint(l.logIndex);
}
// Dùng giá trị, không JSON.stringify (bigint). Bản sao chỉ được dedupe khi mọi trường đều khớp.
function sameVote(a: VoteEvidence, b: VoteEvidence): boolean {
 return eq(a.address,b.address) && a.blockNumber===b.blockNumber && eq(a.blockHash,b.blockHash) && eq(a.transactionHash,b.transactionHash) && a.transactionIndex===b.transactionIndex && a.logIndex===b.logIndex && a.id===b.id && eq(a.voter,b.voter) && a.support===b.support && a.weight===b.weight;
}
export function verifyEvidence(input: VerificationInput, context: VerificationContext, evidence: Evidence): VerificationResult {
 const result: VerificationResult = { input, context, evidence, status: "INCOMPLETE", message: "Chưa đủ bằng chứng.", requests: 0, processedLogs: evidence.votes?.length ?? 0 };
 const fail = (status: VerificationStatus, reason: VerificationFailureReason, message: string) => ({ ...result, status, reason, message });
 if (!inputValid(input)) return fail("INVALID_INPUT","INVALID_INPUT","Đầu vào verification không hợp lệ.");
 if (context.chainId !== input.chainId) return fail("INVALID_INPUT","WRONG_CHAIN","RPC trả sai chain ID.");
 if (!context.anchorStable || !hashValid(context.hash)) return fail("INCOMPLETE","ANCHOR_CHANGED","Block tham chiếu không ổn định.");
 if (!uint(context.head) || context.head < 1n || context.head !== context.latest - input.confirmations) return fail("INCOMPLETE","NOT_CONFIRMED","Chưa đủ block xác nhận.");
 const p=evidence.proposal, created=evidence.created;
 if (!p || !created || !evidence.votes) return fail("INCOMPLETE","MISSING_DATA","Thiếu proposal, ProposalCreated hoặc dữ liệu phiếu.");
 if (!addressValid(context.token) || (input.govToken && !eq(context.token,input.govToken)) || !uint(context.delay) || !uint(context.period) || context.period===0n) return fail("MISMATCH","PROPOSAL_MISMATCH","Token hoặc cấu hình voting không khớp.");
 if (!addressValid(p.proposer) || typeof p.title!=="string" || typeof p.description!=="string" || ![p.createdBlock,p.snapshotBlock,p.deadlineBlock,p.forVotes,p.againstVotes].every(uint)) return fail("INCOMPLETE","MISSING_DATA","Storage proposal không hợp lệ.");
 const titleBytes=new TextEncoder().encode(p.title).length;
 if (p.createdBlock===0n || titleBytes<1 || titleBytes>100 || new TextEncoder().encode(p.description).length>1000 || p.snapshotBlock!==p.createdBlock+context.delay || p.deadlineBlock!==p.snapshotBlock+context.period) return fail("MISMATCH","PROPOSAL_MISMATCH","Metadata hoặc mốc block proposal không khớp cấu hình.");
 if (p.createdBlock > context.head) return fail("INCOMPLETE","NOT_CONFIRMED","Proposal chưa nằm trong vùng block đã xác nhận.");
 if (!positionValid(created) || !addressValid(created.proposer) || typeof created.title!=="string" || ![created.id,created.snapshotBlock,created.deadlineBlock].every(uint)) return fail("INCOMPLETE","MALFORMED_EVENT","ProposalCreated thiếu metadata hợp lệ.");
 if (!eq(created.address,input.govVote) || created.id!==input.proposalId || !eq(created.proposer,p.proposer) || created.title!==p.title || created.snapshotBlock!==p.snapshotBlock || created.deadlineBlock!==p.deadlineBlock || created.blockNumber!==p.createdBlock || (created.blockNumber===context.head && !eq(created.blockHash,context.hash))) return fail("MISMATCH","PROPOSAL_MISMATCH","ProposalCreated không khớp proposal trong storage.");
 let cursor=p.createdBlock;
 for (const r of evidence.ranges) {
  if (r.from!==cursor || r.to<r.from || r.to>context.head) return fail("INCOMPLETE","MISSING_DATA","Khoảng logs chưa được đọc đầy đủ.");
  cursor=r.to+1n;
 }
 if (cursor!==context.head+1n) return fail("INCOMPLETE","MISSING_DATA","Chưa đọc hết logs tới block tham chiếu.");
 const votes=[...evidence.votes];
 if (votes.some((v)=>!positionValid(v) || !addressValid(v.voter) || !uint(v.id) || !uint(v.weight) || typeof v.support!=="boolean")) return fail("INCOMPLETE","MALFORMED_EVENT","VoteCast không hợp lệ hoặc thiếu vị trí.");
 votes.sort((a,b)=>a.blockNumber!==b.blockNumber ? (a.blockNumber<b.blockNumber?-1:1) : a.transactionIndex!==b.transactionIndex ? (a.transactionIndex<b.transactionIndex?-1:1) : a.logIndex===b.logIndex?0:a.logIndex<b.logIndex?-1:1);
 const logs=new Map<string,VoteEvidence>(), voters=new Set<string>();
 const positions=new Map<string,string>(), transactions=new Map<string,string>();
 let forVotes=0n, againstVotes=0n;
 for (const v of votes) {
  if (!eq(v.address,input.govVote) || v.id!==input.proposalId || v.blockNumber<=p.snapshotBlock || v.blockNumber>p.deadlineBlock || v.blockNumber>context.head || v.weight===0n || (v.blockNumber===context.head && !eq(v.blockHash,context.hash))) return fail("MISMATCH","EVENT_SCOPE","VoteCast sai contract/proposal hoặc ngoài thời gian nhận phiếu.");
  const key=`${v.transactionHash.toLowerCase()}:${v.logIndex}`; const old=logs.get(key);
  if (old) { if (!sameVote(old,v)) return fail("MISMATCH","DUPLICATE_LOG_CONFLICT","Cùng định danh log nhưng nội dung khác nhau."); continue; }
  const logPosition=`${v.blockNumber}:${v.logIndex}`, txPosition=`${v.blockNumber}:${v.transactionIndex}`;
  if ((positions.has(logPosition)&&positions.get(logPosition)!==v.transactionHash.toLowerCase()) || (transactions.has(txPosition)&&transactions.get(txPosition)!==v.transactionHash.toLowerCase())) return fail("MISMATCH","EVENT_SCOPE","Metadata log/transaction mâu thuẫn trong cùng block.");
  positions.set(logPosition,v.transactionHash.toLowerCase()); transactions.set(txPosition,v.transactionHash.toLowerCase());
  logs.set(key,v);
  const voter=v.voter.toLowerCase(); if (voters.has(voter)) return fail("MISMATCH","DUPLICATE_VOTER","Một voter có nhiều VoteCast khác nhau."); voters.add(voter);
  if (v.support) forVotes+=v.weight; else againstVotes+=v.weight;
 }
 if (context.head<=p.snapshotBlock) return fail("INCOMPLETE","SNAPSHOT_NOT_FINALIZED","Snapshot chưa chốt; chưa thể kiểm quorum đầy đủ.");
 const q=evidence.quorum, state=evidence.contractState;
 if (!q || state===undefined || !uint(state) || state>3n || !uint(q.pastTotalSupply) || !uint(q.quorumBps) || q.quorumBps<1n || q.quorumBps>10000n || !uint(q.contractQuorum)) return fail("INCOMPLETE","MISSING_DATA","Thiếu dữ liệu quorum lịch sử hoặc state hợp lệ.");
 const participation=forVotes+againstVotes, quorum=calculateQuorum(q.pastTotalSupply,q.quorumBps);
 // Expected majority dùng tally tính từ event, không dùng tally storage làm nguồn độc lập.
 const expected=expectedState(context.head,{...p,forVotes,againstVotes},participation,quorum);
 result.calculated={forVotes,againstVotes,participation,quorum,expectedState:expected,uniqueLogs:logs.size};
 if (forVotes!==p.forVotes || againstVotes!==p.againstVotes || participation>q.pastTotalSupply) return fail("MISMATCH","TALLY_MISMATCH","Tally từ event không khớp storage hoặc vượt tổng cung snapshot.");
 if (quorum!==q.contractQuorum) return fail("MISMATCH","QUORUM_MISMATCH","Quorum tính lại không khớp contract.");
 if (expected!==state) return fail("MISMATCH","STATE_MISMATCH","State tính lại không khớp contract.");
 return { ...result, status:"VERIFIED", message:"VERIFIED — ON-CHAIN CONSISTENCY tại block tham chiếu; không phải chứng nhận audit." };
}
