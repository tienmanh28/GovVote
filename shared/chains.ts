// Một nguồn chính sách cho CLI và UI; không chứa endpoint công khai hoặc tự gọi RPC.
export const CHAIN_PROFILES = {
  local: {
    chainId: 31337,
    name: "Anvil",
    displayName: "Anvil local",
    explorerUrl: undefined,
    confirmations: 12n,
    provenance: "LOCAL_DEPLOYMENT_EVIDENCE",
  },
  sepolia: {
    chainId: 11155111,
    name: "Sepolia",
    displayName: "Sepolia",
    explorerUrl: "https://sepolia.etherscan.io",
    // Public testnet cần khoảng lùi bảo thủ hơn local; 64 block không bảo đảm finality.
    confirmations: 64n,
    provenance: "PUBLIC_TESTNET_DEPLOYMENT_EVIDENCE",
  },
} as const;
export type ChainProfile = (typeof CHAIN_PROFILES)[keyof typeof CHAIN_PROFILES];
export type DeploymentProvenance = ChainProfile["provenance"];
export const DEFAULT_CHAIN_PROFILE = CHAIN_PROFILES.local;

// Chỉ nhận ID nguyên dương dạng số/bigint/thập phân; không ép NaN, hex hay chuỗi rỗng thành chain.
export function chainProfile(id: unknown): ChainProfile | undefined {
  const value =
    typeof id === "bigint" || (typeof id === "number" && Number.isSafeInteger(id))
      ? String(id)
      : typeof id === "string" && /^\d+$/.test(id)
        ? id
        : undefined;
  return Object.values(CHAIN_PROFILES).find((p) => String(p.chainId) === value);
}

export function chainError(id: unknown): string {
  // Không phản chiếu chuỗi đầu vào tùy ý: CLI có thể vô tình nhận URL chứa bí mật.
  const label =
    typeof id === "bigint" || typeof id === "number" || /^\d+$/.test(String(id))
      ? String(id)
      : "không hợp lệ";
  return `Chain ID ${label} bị từ chối${String(id) === "1" ? " (mainnet bị chặn)" : ""}; chỉ hỗ trợ ${Object.values(
    CHAIN_PROFILES,
  )
    .map((p) => `${p.name} (${p.chainId})`)
    .join(" và ")}.`;
}

export function requireChainProfile(id: unknown): ChainProfile {
  const profile = chainProfile(id);
  if (!profile) throw new Error(chainError(id));
  return profile;
}

// Chỉ dựng link cho hash/địa chỉ đúng định dạng và explorer trong allowlist cố định.
export function explorerLink(profile: ChainProfile, kind: "tx" | "address", value: string) {
  const valid = kind === "tx" ? /^0x[\da-f]{64}$/i : /^0x[\da-f]{40}$/i;
  return profile.explorerUrl && valid.test(value)
    ? `${profile.explorerUrl}/${kind}/${value}`
    : undefined;
}
