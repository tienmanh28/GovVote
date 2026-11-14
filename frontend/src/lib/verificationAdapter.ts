// Adapter viem dùng ABI tự sinh từ artifacts; không dùng signer hoặc wallet transport.
import { encodeFunctionData, decodeFunctionResult, decodeEventLog, toEventSelector, type Hex, type AbiEvent } from "viem";
import { govVoteAbi } from "../abi/govVote.ts";
import { govTokenAbi } from "../abi/govToken.ts";
import type { RpcCodec } from "../../../shared/verification/runner.ts";
export const verificationCodec: RpcCodec = {
 encode(target,name,args) { return encodeFunctionData({abi:target==="gov"?govVoteAbi:govTokenAbi,functionName:name as never,args:args as never}); },
 decode(target,name,data) { return decodeFunctionResult({abi:target==="gov"?govVoteAbi:govTokenAbi,functionName:name as never,data:data as Hex}); },
 topic(event) { return toEventSelector(govVoteAbi.find((e)=>e.type==="event"&&e.name===event) as AbiEvent); },
 event(event,log) {
  if(typeof log.data!=="string" || !Array.isArray(log.topics)) throw new Error("Malformed log");
  const decoded=decodeEventLog({abi:govVoteAbi,data:log.data as Hex,topics:log.topics as [Hex,...Hex[]],strict:true});
  if(decoded.eventName!==event) throw new Error("Unexpected event");
  return decoded.args as unknown as Record<string,unknown>;
 },
};

import { createHttpRequest } from "../../../shared/verification/http.ts";
import { runVerification } from "../../../shared/verification/runner.ts";
import type { VerificationInput } from "../../../shared/verification/core.ts";
export function verifyInBrowser(input: VerificationInput, url: string, options: Parameters<typeof runVerification>[3]) {
 return runVerification(input,createHttpRequest(url),verificationCodec,options);
}
