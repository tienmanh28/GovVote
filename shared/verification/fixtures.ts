// Evidence tổng hợp dành cho tests; không phải deployment hoặc dữ liệu chain thật.
import type { Evidence, VerificationContext, VerificationInput } from "./core.ts";
export const addr=(n:number)=>`0x${n.toString(16).padStart(40,"0")}`;
export const hash=(n:bigint|number)=>`0x${n.toString(16).padStart(64,"0")}`;
export function fixture(): {input:VerificationInput;context:VerificationContext;evidence:Evidence} {
 const input:VerificationInput={chainId:31337n,govVote:addr(1),govToken:addr(2),proposalId:1n,confirmations:12n,rpcSource:"http://local.test"};
 const context:VerificationContext={chainId:31337n,latest:112n,head:100n,hash:hash(100),checkedAt:"2026-11-14T00:00:00.000Z",anchorStable:true,token:addr(2),delay:15n,period:7200n,provenance:"LOCAL_DEPLOYMENT_EVIDENCE"};
 const proposal={proposer:addr(3),title:"Kiểm chứng",description:"Fixture",createdBlock:10n,snapshotBlock:25n,deadlineBlock:7225n,forVotes:60n,againstVotes:40n};
 const evidence:Evidence={proposal,created:{address:addr(1),blockNumber:10n,blockHash:hash(10),transactionHash:hash(1),transactionIndex:0n,logIndex:0n,id:1n,proposer:addr(3),title:proposal.title,snapshotBlock:25n,deadlineBlock:7225n},votes:[
 {address:addr(1),blockNumber:26n,blockHash:hash(26),transactionHash:hash(2),transactionIndex:0n,logIndex:0n,id:1n,voter:addr(3),support:true,weight:60n},
 {address:addr(1),blockNumber:27n,blockHash:hash(27),transactionHash:hash(3),transactionIndex:0n,logIndex:0n,id:1n,voter:addr(4),support:false,weight:40n}],quorum:{pastTotalSupply:1000n,quorumBps:1000n,contractQuorum:100n},contractState:1n,ranges:[{from:10n,to:100n}]};
 return {input,context,evidence};
}
