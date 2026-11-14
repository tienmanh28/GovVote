// Đổi endpoint => provider/cache/transaction hooks cũ bị tháo, không trộn phiên đọc.
import { useCallback,useEffect,useMemo,useRef,useState } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient,QueryClientProvider } from "@tanstack/react-query";
import { AppConfigContext } from "../appContext.ts";
import { makeWagmiConfig,type AppConfig } from "../config.ts";
import { endpoints,selectEndpoint,createContinuityProbe } from "../lib/endpoint.ts";
import { rpcSource } from "../../../shared/verification/http.ts";
import { App } from "../App.tsx";
import { Button,Notice,Spinner } from "./ui.tsx";
function Session({cfg,onFailure,recover}:{cfg:AppConfig;onFailure:()=>void;recover:()=>void}){
 const wagmi=useMemo(()=>makeWagmiConfig(cfg,onFailure),[cfg,onFailure]);
 const queries=useMemo(()=>new QueryClient({defaultOptions:{queries:{retry:1,retryDelay:500}}}),[]);
 return <WagmiProvider config={wagmi}><QueryClientProvider client={queries}><AppConfigContext.Provider value={cfg}>
  {!!cfg.fallbackRpcUrls?.length&&<Notice>RPC đang dùng ({cfg.rpcUrl===cfg.primaryRpcUrl?"primary":"fallback"}): {rpcSource(cfg.rpcUrl)}. Nguồn verification được ghi riêng trong trang xác minh. <Button variant="secondary" onClick={recover}>Thử lại RPC chính</Button></Notice>}
  <App />
 </AppConfigContext.Provider></QueryClientProvider></WagmiProvider>;
}
export function ReliableApp({config}:{config:AppConfig}){
 const probe=useMemo(()=>createContinuityProbe(),[config]);
 const enabled=!!config.fallbackRpcUrls?.length;
 const [state,setState]=useState({url:config.rpcUrl,phase:enabled?"switching":"ready",epoch:0});
 const version=useRef(0),controller=useRef<AbortController|null>(null),pending=useRef(false);
 const choose=useCallback(async(start:number)=>{
  const n=++version.current;controller.current?.abort();const c=new AbortController();controller.current=c;pending.current=true;
  setState((s)=>({...s,phase:"switching"}));
  try{const url=await selectEndpoint(endpoints(config).slice(start),config,c.signal,probe);if(n===version.current&&!c.signal.aborted)setState({url,phase:"ready",epoch:n});}
  catch{if(n===version.current&&!c.signal.aborted)setState((s)=>({...s,phase:"error"}));}
  finally{if(n===version.current)pending.current=false;}
 },[config,probe]);
 useEffect(()=>{if(enabled)void choose(0);return()=>{version.current++;controller.current?.abort();};},[choose,enabled]);
 const epoch=state.epoch;
 const failure=useCallback(()=>{if(enabled&&!pending.current&&version.current===epoch)void choose(endpoints(config).indexOf(state.url)+1);},[enabled,epoch,config,state.url,choose]);
 const cfg=useMemo(()=>({...config,rpcUrl:state.url,primaryRpcUrl:config.rpcUrl}),[config,state.url]);
 if(state.phase==="switching")return <Spinner label="Đang kiểm tra/chuyển RPC…" />;
 if(state.phase==="error")return <Notice tone="error">Không còn endpoint RPC khả dụng. <Button onClick={()=>void choose(0)}>Thử lại RPC chính</Button></Notice>;
 return <Session key={`${state.url}:${state.epoch}`} cfg={cfg} onFailure={failure} recover={()=>void choose(0)} />;
}
