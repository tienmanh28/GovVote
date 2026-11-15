#!/usr/bin/env bash
# Dựng chain demo GovVote trên Anvil cục bộ, đúng trình tự lifecycle Phase 1
# (docs/phase1-demo-report.md mục 5 và 6b; chain đã dùng cho lần chạy 61/61 browser test):
#   Deploy -> Seed -> 4 ví tự delegate -> mine 2 -> Alice propose -> mine qua snapshot
#   -> Alice For, Bob Against, Charlie For -> mine qua deadline -> proposal #1 Succeeded (600.000 / 250.000 GOV).
#
# Dùng chung cho CI (.github/workflows/ci.yml) và chạy tay ở local. Yêu cầu: Anvil đã chạy, chain MỚI.
# Ký mọi giao dịch bằng --unlocked (account test công khai của Anvil), KHÔNG có private key.
#
# Biến môi trường:
#   RPC_URL  RPC của Anvil (mặc định http://127.0.0.1:8545). Script từ chối chain ID khác 31337.
#   ENV_OUT  (tùy chọn) đường dẫn file để ghi VITE_* cho frontend, ví dụ frontend/.env.local.
# Chạy từ gốc repo: bash scripts/ci/prepare-chain.sh
set -Eeuo pipefail

RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
ENV_OUT="${ENV_OUT:-}"
# Log chỉ chứa địa chỉ công khai/receipt; giữ output forge để xác định RPC nào bị kẹt.
CHAIN_DIAGNOSTICS_DIR="${CHAIN_DIAGNOSTICS_DIR:-/tmp/govvote-chain-diagnostics}"
mkdir -p "$CHAIN_DIAGNOSTICS_DIR"
current_step="initialization"
step_started=$SECONDS
step_log=""

# Account test công khai của Anvil (mnemonic mặc định). Chỉ dùng ở chain local.
DEPLOYER=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
ALICE=0x70997970C51812dc3A010C7d01b50e0d17dc79C8
BOB=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
CHARLIE=0x90F79bf6EB2c4f870365E785982E1f101E93b906
DAVID=0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65

# Cấu hình demo (giống Phase 1).
VOTING_DELAY_BLOCKS=15
VOTING_PERIOD_BLOCKS=7200

log() { printf '[prepare-chain] %s\n' "$*"; }
begin_step() {
  current_step="$1"
  step_started=$SECONDS
  step_log=""
  log "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ) BEGIN $current_step"
}
end_step() { log "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ) END $current_step elapsed=$((SECONDS - step_started))s"; }
on_error() {
  local code="$1" line="$2" command="$3"
  log "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ) FAIL step=$current_step line=$line elapsed=$((SECONDS - step_started))s command=$command" >&2
  if [ -n "$step_log" ] && [ -f "$step_log" ]; then tail -n 20 "$step_log" >&2; fi
  exit "$code"
}
# ERR được kế thừa trong helper/subshell để không mất tên lệnh nằm trong command substitution.
trap 'on_error "$?" "$LINENO" "$BASH_COMMAND"' ERR
fail() { printf '[prepare-chain] LỖI: %s\n' "$*" >&2; exit 1; }
head_block() { cast block-number --rpc-url "$RPC_URL"; }
mine() { if [ "$1" -gt 0 ]; then cast rpc anvil_mine "$1" --rpc-url "$RPC_URL" > /dev/null; fi; }
send() { cast send "$@" --unlocked --rpc-url "$RPC_URL" > /dev/null; }

# 1. Chờ Anvil trả lời RPC (tối đa 60 giây) và chỉ chấp nhận chain local 31337.
begin_step "Anvil readiness"
deadline=$((SECONDS + 60))
until cast chain-id --rpc-url "$RPC_URL" > /dev/null 2>&1; do
  if [ "$SECONDS" -ge "$deadline" ]; then fail "Anvil không trả lời tại $RPC_URL sau 60 giây"; fi
  sleep 0.5
done
chain_id="$(cast chain-id --rpc-url "$RPC_URL")"
[ "$chain_id" = "31337" ] || fail "chain ID $chain_id, chỉ chạy trên Anvil 31337"
log "Anvil sẵn sàng tại $RPC_URL (chain 31337), block $(head_block)"
end_step

# 2. Deploy GovToken + GovVote.
begin_step "forge script Deploy"
step_log="$CHAIN_DIAGNOSTICS_DIR/forge-deploy.log"
TOKEN_RECIPIENT="$DEPLOYER" PROPOSAL_THRESHOLD_GOV=1000 QUORUM_BPS=1000 \
VOTING_DELAY_BLOCKS="$VOTING_DELAY_BLOCKS" VOTING_PERIOD_BLOCKS="$VOTING_PERIOD_BLOCKS" \
  forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" \
  --broadcast --unlocked --sender "$DEPLOYER" > "$step_log" 2>&1
end_step

# Đọc địa chỉ từ broadcast log (receipt thật), không đoán theo nonce.
begin_step "read deployment and check bytecode/proposalCount"
read -r GOV_TOKEN GOV_VOTE < <(node -e '
  const j = require(process.argv[1]);
  const pick = (n) => j.transactions.find((t) => t.transactionType === "CREATE" && t.contractName === n).contractAddress;
  console.log(pick("GovToken"), pick("GovVote"));
' "$PWD/broadcast/Deploy.s.sol/31337/run-latest.json")
[ "$(cast code "$GOV_VOTE" --rpc-url "$RPC_URL")" != "0x" ] || fail "không có bytecode tại GovVote $GOV_VOTE"
[ "$(cast call "$GOV_VOTE" "proposalCount()(uint256)" --rpc-url "$RPC_URL")" = "0" ] || fail "chain không mới (proposalCount khác 0)"
log "GovToken $GOV_TOKEN"
log "GovVote  $GOV_VOTE"
end_step

# 3. Seed: Alice 400.000, Bob 250.000, Charlie 200.000, David 150.000 GOV.
begin_step "forge script SeedDemo"
step_log="$CHAIN_DIAGNOSTICS_DIR/forge-seed.log"
GOV_TOKEN="$GOV_TOKEN" DEMO_ALICE="$ALICE" DEMO_BOB="$BOB" DEMO_CHARLIE="$CHARLIE" DEMO_DAVID="$DAVID" \
  forge script script/SeedDemo.s.sol:SeedDemo -vvvv --rpc-url "$RPC_URL" \
  --broadcast --unlocked --sender "$DEPLOYER" > "$step_log" 2>&1
end_step

# 4. Bốn ví tự delegate, rồi mine 2 block để checkpoint delegate thuộc quá khứ (lifecycle bước 1-2).
for who in "$ALICE" "$BOB" "$CHARLIE" "$DAVID"; do
  begin_step "cast send delegate $who"
  send "$GOV_TOKEN" "delegate(address)" "$who" --from "$who"
  end_step
done
begin_step "mine after delegation"
mine 2
end_step

# 5. Alice tạo proposal #1. Snapshot và deadline tính từ block chứa giao dịch.
begin_step "cast send propose and read timing"
send "$GOV_VOTE" "propose(string,string)" \
  "Demo proposal #1 (CI chain)" \
  "Proposal demo tạo bởi scripts/ci/prepare-chain.sh theo lifecycle Phase 1." --from "$ALICE"
[ "$(cast call "$GOV_VOTE" "proposalCount()(uint256)" --rpc-url "$RPC_URL")" = "1" ] || fail "propose không tạo proposal #1"
created="$(head_block)"
snapshot=$((created + VOTING_DELAY_BLOCKS))
deadline_block=$((snapshot + VOTING_PERIOD_BLOCKS))
end_step

# 6. Mine tới snapshotBlock; giao dịch kế tiếp nằm ở snapshot + 1 nên proposal đã Active.
begin_step "mine to snapshot"
mine $((snapshot - $(head_block)))
end_step
begin_step "cast send Alice For"
send "$GOV_VOTE" "castVote(uint256,bool)" 1 true --from "$ALICE"
end_step
begin_step "cast send Bob Against"
send "$GOV_VOTE" "castVote(uint256,bool)" 1 false --from "$BOB"
end_step
begin_step "cast send Charlie For"
send "$GOV_VOTE" "castVote(uint256,bool)" 1 true --from "$CHARLIE"
end_step

# 7. Mine tới deadlineBlock + 1: hết thời gian vote, trạng thái được tính lại thành Succeeded.
begin_step "mine past deadline"
mine $((deadline_block + 1 - $(head_block)))
end_step

# 8. Kiểm kết quả: state 2 (Succeeded), For 600.000 GOV, Against 250.000 GOV.
begin_step "check final state/tally"
state="$(cast call "$GOV_VOTE" "state(uint256)(uint8)" 1 --rpc-url "$RPC_URL")"
tally="$(cast call "$GOV_VOTE" "getProposal(uint256)((address,string,string,uint256,uint256,uint256,uint256,uint256))" 1 \
  --rpc-url "$RPC_URL" --json)"
read -r for_votes against_votes < <(node -e '
  const v = JSON.parse(process.argv[1])[0];
  const t = Array.isArray(v) ? v : Object.values(v);
  console.log(String(t[6]).split(" ")[0], String(t[7]).split(" ")[0]);
' "$tally")
[ "$state" = "2" ] || fail "proposal #1 có state $state, mong đợi 2 (Succeeded)"
[ "$for_votes" = "600000000000000000000000" ] || fail "For = $for_votes, mong đợi 600.000 GOV"
[ "$against_votes" = "250000000000000000000000" ] || fail "Against = $against_votes, mong đợi 250.000 GOV"
log "proposal #1: Succeeded, For 600.000 GOV / Against 250.000 GOV, block hiện tại $(head_block)"
end_step

# 9. (Tùy chọn) Ghi cấu hình cho frontend.
if [ -n "$ENV_OUT" ]; then
  printf 'VITE_RPC_URL=%s\nVITE_CHAIN_ID=31337\nVITE_GOV_VOTE=%s\nVITE_GOV_TOKEN=%s\n' \
    "$RPC_URL" "$GOV_VOTE" "$GOV_TOKEN" > "$ENV_OUT"
  log "đã ghi $ENV_OUT"
fi

echo "GOV_TOKEN=$GOV_TOKEN"
echo "GOV_VOTE=$GOV_VOTE"
