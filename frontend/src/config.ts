// Đọc và kiểm tra biến môi trường VITE_*, tạo chain tùy chỉnh và cấu hình wagmi.
// Biến VITE_* nằm trong bundle gửi tới trình duyệt: chỉ chứa địa chỉ công khai, không bao giờ chứa key.
import { createConfig, http, injected } from "wagmi";
import { type Transport } from "viem";
import { defineChain, getAddress, isAddress, type Address } from "viem";

/** Phase 3 chỉ chạy trên Anvil local. Sepolia thuộc Phase 4. */
export const SUPPORTED_CHAIN_ID = 31_337;

export type AppConfig = {
  rpcUrl: string;
  primaryRpcUrl?: string;
  fallbackRpcUrls?: string[];
  chainId: number;
  govVote: Address;
  govToken: Address;
};

export type ParsedEnv = { ok: true; config: AppConfig } | { ok: false; errors: string[] };

/** Hàm thuần: kiểm tra env, trả về danh sách lỗi đọc được bằng tiếng Việt thay vì để trang hiện dữ liệu rỗng. */
export function parseEnv(env: Record<string, string | undefined>): ParsedEnv {
  const errors: string[] = [];
  const rpcUrl = env.VITE_RPC_URL?.trim() || "http://127.0.0.1:8545";
  const validUrl=(url:string)=>{try{const u=new URL(url);return ["http:","https:"].includes(u.protocol)&&!u.username&&!u.password&&!u.hash;}catch{return false;}};
  const fallbackRpcUrls=[...new Set((env.VITE_RPC_FALLBACK_URLS??"").split(",").map((s)=>s.trim()).filter(Boolean))].filter((url)=>url!==rpcUrl);
  if(!validUrl(rpcUrl))errors.push("VITE_RPC_URL phải là HTTP(S) URL công khai hợp lệ.");
  if(fallbackRpcUrls.length>2||fallbackRpcUrls.some((url)=>!validUrl(url)))errors.push("VITE_RPC_FALLBACK_URLS chỉ nhận tối đa hai HTTP(S) URL hợp lệ, không credentials.");
  const chainId = Number(env.VITE_CHAIN_ID ?? SUPPORTED_CHAIN_ID);
  if (chainId !== SUPPORTED_CHAIN_ID) {
    errors.push(`VITE_CHAIN_ID = ${String(env.VITE_CHAIN_ID)}: Phase 3 chỉ hỗ trợ Anvil (${SUPPORTED_CHAIN_ID}).`);
  }
  const addr = (key: "VITE_GOV_VOTE" | "VITE_GOV_TOKEN"): Address | null => {
    const v = env[key]?.trim();
    if (!v) {
      errors.push(`Thiếu ${key} trong .env.local.`);
      return null;
    }
    if (!isAddress(v, { strict: false })) {
      errors.push(`${key} = ${v} không phải địa chỉ hợp lệ.`);
      return null;
    }
    return getAddress(v);
  };
  const govVote = addr("VITE_GOV_VOTE");
  const govToken = addr("VITE_GOV_TOKEN");
  if (errors.length > 0 || !govVote || !govToken) return { ok: false, errors };
  return { ok: true, config: { rpcUrl, chainId, govVote, govToken, ...(fallbackRpcUrls.length?{fallbackRpcUrls}:{}) } };
}

export function makeChain(cfg: AppConfig) {
  return defineChain({
    id: cfg.chainId,
    name: "Anvil (GovVote local)",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [cfg.rpcUrl] } },
    testnet: true,
  });
}

export function makeWagmiConfig(cfg: AppConfig, onFailure?: () => void) {
  const chain = makeChain(cfg);
  const transport:Transport=(parameters)=>{
    const original=http(cfg.rpcUrl,{timeout:8000,retryCount:0})(parameters);
    const request:typeof original.request=async(args,options)=>{
      try{return await original.request(args,options);}catch(error){
        // Contract revert không phải lý do tự chuyển nguồn đọc.
        const e=error as {code?:number;message?:string};
        if(e.code!==3&&!/revert/i.test(e.message??""))onFailure?.();
        throw error;
      }
    };
    return {...original,request};
  };
  return createConfig({
    chains: [chain],
    // Chỉ connector injected (MetaMask trên máy tính / trình duyệt trong app MetaMask). WalletConnect thuộc v2.
    connectors: [injected()],
    // Tắt EIP-6963 discovery: chỉ dùng window.ethereum, tránh hiện nhiều ví lạ trên cùng máy.
    multiInjectedProviderDiscovery: false,
    // Mọi lệnh ĐỌC đi thẳng tới RPC cấu hình, không qua ví: khách chưa kết nối ví vẫn xem được dữ liệu.
    transports: { [chain.id]: transport },
    pollingInterval: 1_000,
  });
}

export type WagmiConfig = ReturnType<typeof makeWagmiConfig>;
