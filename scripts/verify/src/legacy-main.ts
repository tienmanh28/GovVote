// Đối chiếu tổng phiếu tính từ event VoteCast với forVotes/againstVotes trong storage của GovVote.
// CHỈ ĐỌC chain qua RPC: không ví, không private key, không gửi giao dịch.
//
// Biến môi trường:
//   GOV_RPC_URL  RPC endpoint. Mặc định http://127.0.0.1:8545 (Anvil local).
//   GOV_VOTE     Địa chỉ GovVote. BẮT BUỘC, không có mặc định.
//
// Mã thoát (exit code): 0 = VERIFIED, 1 = MISMATCH, 2 = lỗi cấu hình hoặc lỗi chạy.
import {
  createPublicClient,
  formatUnits,
  http,
  isAddress,
  type Address,
  type PublicClient,
} from "viem";
import { govVoteAbi } from "./abi.ts";
import { fetchVoteLogs } from "./fetch.ts";
import { aggregateVotes, compareWithChain, type CompareResult, type Tally } from "./verify.ts";

// Legacy giữ cách tally cũ, chỉ chia sẻ chính sách chain và khoảng lùi xác nhận.
import { readChainConfig, ChainConfigError } from "./chain.ts";
import { chainProfile, chainError, DEFAULT_CHAIN_PROFILE } from "../../../shared/chains.ts";

class ConfigError extends Error {}

function readConfig(): { rpcUrl: string; gov: Address } {
  const { rpcUrl } = readChainConfig(process.env);
  const gov = process.env.GOV_VOTE;
  if (gov === undefined || gov === "")
    throw new ConfigError("Thiếu biến môi trường GOV_VOTE (địa chỉ GovVote)");
  if (!isAddress(gov)) throw new ConfigError(`GOV_VOTE không phải địa chỉ hợp lệ: ${gov}`);
  return { rpcUrl, gov };
}

/** wei (10^-18 GOV) → chuỗi GOV có dấu chấm phân cách hàng nghìn, ví dụ 600000000000000000000000n → "600.000". */
function gov(x: bigint): string {
  const [int = "0", frac] = formatUnits(x, 18).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return frac === undefined ? grouped : `${grouped},${frac}`;
}

function printTable(result: CompareResult): void {
  const header = ["id", "log For", "log Against", "chain For", "chain Against", "khớp"];
  const body = result.rows.map((r) => [
    `${r.id}${r.inRange ? "" : " (ngoài 1..count)"}`,
    gov(r.logFor),
    gov(r.logAgainst),
    gov(r.chainFor),
    gov(r.chainAgainst),
    r.match ? "OK" : "LỆCH",
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...body.map((row) => row[i]!.length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padStart(widths[i]!)).join(" | ");
  console.log(line(header));
  console.log(widths.map((w) => "-".repeat(w)).join("-+-"));
  for (const row of body) console.log(line(row));
}

async function main(): Promise<number> {
  const { profile } = readChainConfig(process.env);
  const confirmations = profile.confirmations;
  const { rpcUrl, gov: govAddress } = readConfig();
  const client: PublicClient = createPublicClient({ transport: http(rpcUrl) });

  const chainId = await client.getChainId();
  // eth_chainId là phép RPC duy nhất trước khi xác nhận chain được phép và đúng cấu hình.
  if (!chainProfile(chainId)) throw new ChainConfigError(chainError(chainId));
  if (chainId !== profile.chainId)
    throw new ChainConfigError(`RPC trả sai chain ID; cấu hình cần ${profile.chainId}.`);

  const latest = await client.getBlockNumber();
  const head = latest - confirmations;
  if (head < 1n)
    throw new ConfigError(`Chain mới có ${latest} block, chưa đủ ${confirmations} block xác nhận`);

  // Vì sao mọi phép đọc đều ở CÙNG block `head`:
  // storage là ảnh chụp tại một block; log là lịch sử tới block đó. Nếu đọc storage ở `latest` nhưng log
  // chỉ tới `head`, phiếu trong (head, latest] có trong storage mà không có trong log, nên báo MISMATCH giả.
  // Ngược lại thì bỏ sót lệch thật. Vì vậy proposalCount, getProposal và getLogs đều chốt ở `head`.
  const code = await client.getCode({ address: govAddress, blockNumber: head });
  if (code === undefined || code === "0x")
    throw new ConfigError(`Không có bytecode tại ${govAddress} ở block ${head}`);

  const count = await client.readContract({
    address: govAddress,
    abi: govVoteAbi,
    functionName: "proposalCount",
    blockNumber: head,
  });

  const logs = await fetchVoteLogs(client, govAddress, 0n, head);

  const onChain = new Map<bigint, Tally>();
  for (let id = 1n; id <= count; id++) {
    const p = await client.readContract({
      address: govAddress,
      abi: govVoteAbi,
      functionName: "getProposal",
      args: [id],
      blockNumber: head,
    });
    onChain.set(id, { for: p.forVotes, against: p.againstVotes });
  }

  const aggregate = aggregateVotes(logs, head);
  const result = compareWithChain(aggregate, onChain, count);

  console.log(`chainId        : ${chainId}`);
  console.log(`GovVote        : ${govAddress}`);
  console.log(`latest / head  : ${latest} / ${head} (chờ ${confirmations} block xác nhận)`);
  console.log(`proposalCount  : ${count} (tại head)`);
  console.log(`VoteCast logs  : ${logs.length} (block 0..${head})`);
  console.log("");
  printTable(result);
  console.log("");
  console.log(result.status);
  return result.status === "VERIFIED" ? 0 : 1;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    // Không in error transport/raw input: chúng có thể chứa credentials của RPC URL.
    console.error(
      err instanceof ChainConfigError
        ? err.message
        : err instanceof ConfigError
          ? `Lỗi cấu hình legacy: kiểm tra GOV_VOTE và chain ${chainProfile(process.env.GOV_CHAIN_ID ?? DEFAULT_CHAIN_PROFILE.chainId)!.name}.`
          : "RPC legacy lỗi; không thể đối chiếu tally.",
    );
    process.exitCode = 2;
  },
);
