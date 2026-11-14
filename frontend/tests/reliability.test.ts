import { expect,test,vi } from "vitest";
import { parseEnv } from "../src/config.ts";
import { selectEndpoint,probeEndpoint } from "../src/lib/endpoint.ts";
import { freshnessSnapshot } from "../src/lib/freshness.tsx";
import { verifyWithFallback } from "../src/lib/verificationFallback.ts";
import { fixture } from "../../shared/verification/fixtures.ts";
import { runVerification } from "../../shared/verification/runner.ts";
import { rpcFixture } from "./verificationRpcFixture.ts";
import { verificationCodec } from "../src/lib/verificationAdapter.ts";
const f=fixture(),cfg={rpcUrl:"http://primary.test",chainId:31337,govVote:f.input.govVote as `0x${string}`,govToken:f.input.govToken as `0x${string}`};
test("fallback URL opt-in và validation",()=>{const env={VITE_GOV_VOTE:cfg.govVote,VITE_GOV_TOKEN:cfg.govToken};expect(parseEnv(env).ok).toBe(true);for(const urls of ["file:///x","https://user:pass@host","http://a,http://b,http://c"])expect(parseEnv({...env,VITE_RPC_FALLBACK_URLS:urls}).ok).toBe(false);});
test("primary ưu tiên; fallback chỉ sau lỗi, cả hai lỗi không lặp",async()=>{const probe=vi.fn(async(url:string)=>{if(url.includes("primary"))throw Error();});expect(await selectEndpoint(["primary","fallback"],cfg,undefined,probe)).toBe("fallback");expect(probe.mock.calls.map((a)=>a[0])).toEqual(["primary","fallback"]);await expect(selectEndpoint(["primary"],cfg,undefined,probe)).rejects.toThrow(/Không còn/);});
test("probe sai chain không đọc bytecode",async()=>{const fetcher=vi.fn(async()=>({ok:true,json:async()=>({id:1,jsonrpc:"2.0",result:"0x1"})}));vi.stubGlobal("fetch",fetcher);try{await expect(probeEndpoint(cfg.rpcUrl,cfg)).rejects.toThrow(/chain/);expect(fetcher).toHaveBeenCalledTimes(1);}finally{vi.unstubAllGlobals();}});
test("freshness chỉ tăng khi đọc đủ thành công; error/refresh không giả thời gian",()=>{const prev={scope:"A",at:100,block:10n};for(const query of [{error:Error(),dataUpdatedAt:200},{data:1,dataUpdatedAt:200,isFetching:true},{data:1,dataUpdatedAt:200,isPlaceholderData:true}])expect(freshnessSnapshot(prev,[query],"A",11n).info.at).toBe(100);expect(freshnessSnapshot(prev,[{data:1,dataUpdatedAt:200}],"A",11n).info).toEqual({at:200,block:11n,state:"ready"});});
for(const scope of ["account-B","chain-B","endpoint-B"])test(`freshness reset ${scope}`,()=>{expect(freshnessSnapshot({scope:"A",at:100},[{isFetching:true}],scope).info.at).toBeUndefined();});
test("strict fallback chạy pipeline từ đầu, không trộn logs/storage",async()=>{
 const primary=rpcFixture(),secondary=rpcFixture();let called=0;
 const verify=vi.fn(async(input:typeof f.input,url:string,options:Parameters<typeof runVerification>[3])=>runVerification(input,async(method,params,signal)=>{if(url==="primary"&&method==="eth_getLogs")throw Error();if(url==="secondary")called++;return (url==="primary"?primary:secondary).request(method,params,signal);},verificationCodec,options));
 const result=await verifyWithFallback(f.input,["primary","secondary"],{},verify);
 expect(result.status).toBe("VERIFIED");expect(verify).toHaveBeenCalledTimes(2);expect(called).toBe(18);expect(secondary.calls[0]!.method).toBe("eth_chainId");expect(result.evidence?.votes).toHaveLength(2);
});
test("strict mismatch không bị che bằng fallback",async()=>{const m=rpcFixture();m.control.missingVotes=true;const verify=vi.fn(async(input:typeof f.input)=>runVerification(input,m.request,verificationCodec));expect((await verifyWithFallback(f.input,["p","s"],{},verify)).status).toBe("MISMATCH");expect(verify).toHaveBeenCalledTimes(1);});
test("probe/selection cũ bị hủy dù hoàn tất sau request mới",async()=>{
 const abort=new AbortController();let release!:()=>void;
 const old=selectEndpoint(["p"],cfg,abort.signal,async()=>new Promise<void>(resolve=>{release=resolve;}));
 abort.abort();const assertion=expect(old).rejects.toThrow(/hủy/);release();await assertion;
 expect(await selectEndpoint(["s"],cfg,undefined,async()=>{})).toBe("s");
});
