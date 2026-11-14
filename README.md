# GovVote

[Tiếng Việt](README.vi.md)

GovVote is an on-chain DAO voting dApp for EVM chains. Voting is token-weighted, and voting power is read from a block-number snapshot (OpenZeppelin `ERC20Votes`). There is no owner, no proposal execution, and every configuration parameter is `immutable` after deploy.

## Status

- Runs and is tested on a **local Anvil chain only** (chain ID 31337).
- **Not deployed** to any testnet or mainnet.
- **No independent security audit.** It is a learning project; the GOV token has no monetary value.

## Screenshots

Proposal list on a phone (375×812), a tablet (768×1024) and a desktop (1280×800):

<p>
  <img src="docs/phase3-screenshots/list-375x812.png" alt="Proposal list, 375x812" width="200">
  <img src="docs/phase3-screenshots/list-768x1024.png" alt="Proposal list, 768x1024" width="280">
  <img src="docs/phase3-screenshots/list-1280x800.png" alt="Proposal list, 1280x800" width="420">
</p>

## Architecture

```mermaid
flowchart LR
  subgraph chain["EVM chain (Anvil, 31337)"]
    GT["GovToken<br/>ERC20 + ERC20Votes<br/>fixed supply, no owner"]
    GV["GovVote<br/>propose / castVote / state"]
    GV -- "getPastVotes / getPastTotalSupply" --> GT
  end
  User(("Voter")) -- "delegate" --> GT
  User -- "propose / castVote" --> GV
  FE["frontend<br/>React + wagmi + viem"] -- "reads + wallet txs" --> chain
  CLI["scripts/verify<br/>(read-only)"] -- "VoteCast logs vs storage" --> chain
```

The frontend reads contract state and sends the user's transactions through an injected wallet. The verify CLI only reads: it rebuilds each tally from `VoteCast` events and compares it with contract storage at the same block.

Proposal state is computed from `block.number` on every call. It is never stored:

```mermaid
stateDiagram-v2
  [*] --> Pending: propose()
  Pending --> Active: block.number > snapshotBlock
  Active --> Succeeded: block.number > deadlineBlock, For + Against >= quorum, For > Against
  Active --> Defeated: block.number > deadlineBlock, otherwise
  Succeeded --> [*]
  Defeated --> [*]
```

## How it works

1. **Delegate.** Holding GOV is not enough: a holder must `delegate` (to self or someone else) to get voting power.
2. **Propose.** Anyone whose voting power at `block.number - 1` is at least `proposalThreshold` can create a proposal (title 1–100 bytes, description up to 1,000 bytes).
3. **Snapshot.** `snapshotBlock = creation block + votingDelayBlocks`. Voting weight is `getPastVotes(voter, snapshotBlock)`. Tokens or delegations that arrive after the snapshot do not count.
4. **Vote.** Accepted while `snapshotBlock < block.number <= deadlineBlock`, where `deadlineBlock = snapshotBlock + votingPeriodBlocks`. One vote per address (For or Against; there is no Abstain).
5. **Result.** Quorum is `ceil(totalSupplyAtSnapshot × quorumBps / 10000)`, rounded up, and is measured on For + Against. A proposal succeeds only if quorum is met **and** For > Against. A tie is Defeated.

## Tech stack

| Area | Tools (versions pinned in the repo) |
|---|---|
| Contracts | Solidity 0.8.28 (EVM `cancun`, optimizer 200 runs), Foundry, OpenZeppelin Contracts v5.6.1, forge-std v1.17.0 |
| Frontend | React 19.3.1, wagmi 2.19.5, viem 2.57.13, TanStack Query 5.105.0, Vite 8.3.5, Tailwind CSS 4.3.3, TypeScript 7.0.2 |
| Verify CLI | Node.js ≥ 24, viem 2.57.11, tsx 4.23.15, TypeScript 7.0.2 |
| Tests | forge test, Vitest 5.0.5, Node test runner (CLI), Playwright 1.64.1 |

npm versions are pinned exactly in `package.json` (no `^` or `~`).

## Quick start (local Anvil)

Requirements: Foundry, Node.js 24+, git with submodules (`git submodule update --init --recursive`).

**1. Build and test the contracts**

```bash
forge build
forge test -vv
forge snapshot --check --fuzz-seed 0x1   # gas report; same seed and Foundry version as CI
```

**2. Start Anvil** (in its own terminal; its startup output prints test keys, so it is discarded)

```bash
anvil --port 8545 > /dev/null 2>&1
```

**3. Deploy and seed.** Transactions are signed with `--unlocked --sender`: Anvil's account 0 is already unlocked, so no private key appears in any command or file.

```bash
TOKEN_RECIPIENT=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
PROPOSAL_THRESHOLD_GOV=1000 QUORUM_BPS=1000 VOTING_DELAY_BLOCKS=15 VOTING_PERIOD_BLOCKS=7200 \
  forge script script/Deploy.s.sol:Deploy --rpc-url http://127.0.0.1:8545 \
  --broadcast --unlocked --sender 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

GOV_TOKEN=<GovToken address from the deploy log> \
DEMO_ALICE=0x70997970C51812dc3A010C7d01b50e0d17dc79C8 \
DEMO_BOB=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC \
DEMO_CHARLIE=0x90F79bf6EB2c4f870365E785982E1f101E93b906 \
DEMO_DAVID=0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65 \
  forge script script/SeedDemo.s.sol:SeedDemo --rpc-url http://127.0.0.1:8545 \
  --broadcast --unlocked --sender 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
```

The full demo lifecycle (delegate, propose, mine blocks, vote) is in [docs/phase1-demo-report.md](docs/phase1-demo-report.md), sections 5 and 6b. A future testnet deploy will sign with a Foundry keystore (`cast wallet import ... --interactive`); a raw private key is never passed on the command line.

**4. Run the frontend**

```bash
cd frontend
npm ci --ignore-scripts
cp .env.example .env.local   # then fill VITE_GOV_VOTE and VITE_GOV_TOKEN from the deploy log
npm run sync-abi             # regenerates src/abi/*.ts from forge build output
npm run dev
```

**5. Verify the tallies independently** (read-only, no wallet needed)

```bash
cd scripts/verify
npm ci --ignore-scripts
GOV_VOTE=<GovVote address> npm run verify
```

Exit code 0 means VERIFIED, 1 means MISMATCH, 2 means a configuration or RPC error. `GOV_RPC_URL` overrides the default `http://127.0.0.1:8545`. Without `GOV_PROPOSAL_ID` the CLI runs the legacy tally mode; setting `GOV_PROPOSAL_ID` (with `GOV_TOKEN`) runs the strict per-proposal check.

## Testing

| Layer | What it covers | Result |
|---|---|---|
| Foundry unit | GovToken and GovVote rules, revert paths, boundary blocks | part of 53 |
| Foundry fuzz | 1,000 runs per test (weight equals past votes, threshold boundary, ...) | part of 53 |
| Foundry invariant | 256 runs, depth 50: tallies, one vote per voter, tally frozen after deadline | part of 53 |
| **`forge test` total** | 4 suites: 4 + 39 unit, 3 fuzz, 7 invariant | **53 passed** |
| Mutation (CLI) | Removing the log de-duplication step in `aggregateVotes` is caught by the CLI tests | detected |
| Vitest (frontend) | error mapping, byte counter, tx state machine, verification core, RPC/session logic | **137 passed** (9 files) |
| Node test runner (CLI) | `scripts/verify` cases: duplicates, missing logs, block windows | **17 passed** |
| Playwright (browser) | validation 34, reliability 12, final UI 3, original E2E 12 | **61 passed** |

Known coverage limit: the invariant suite does not reach every outcome often. Over 40 seeds, only 25% of runs reached at least one Succeeded proposal and 32.5% at least one Defeated proposal with votes. Those outcome branches are covered by deterministic unit tests instead. Details: [docs/phase2a-invariant-report.md](docs/phase2a-invariant-report.md).

## Security and known limitations

From [docs/threat-model.md](docs/threat-model.md) and the project progress notes:

- **The snapshot does not stop buying or borrowing GOV before the snapshot.** Tokens held and delegated by the end of `snapshotBlock` count in full.
- **Sybil and concentration.** This is token-weighted voting, not one-person-one-vote. `hasVoted` blocks per address, not per person.
- **The verify CLI trusts its RPC.** It detects inconsistencies between logs and storage, but an RPC that is wrong in a consistent way can still mislead it.
- **Not tested with a real wallet.** Browser tests use an injected fake wallet; real MetaMask flows are unverified.
- **npm audit:** the frontend reports 27 advisories (16 high, 11 moderate, 0 critical) that come through wagmi's connector dependency tree (`@wagmi/connectors`). The app only instantiates the `injected()` connector. Upgrading needs wagmi v3, which is not decided yet. The verify CLI reports 0.
- No owner, no roles, no setters, no mint after deploy. Changing a rule means deploying a new contract.

## Repository layout

| Path | Contents |
|---|---|
| `src/` | `GovToken.sol`, `GovVote.sol` |
| `test/` | unit, fuzz and invariant tests, `mocks/` |
| `script/` | `Deploy.s.sol`, `SeedDemo.s.sol` |
| `frontend/` | React app; unit tests in `tests/`, E2E in `e2e/`, extra browser checks in `validation/` |
| `shared/verification/` | verification logic shared by the frontend and the CLI |
| `scripts/verify/` | read-only CLI that checks `VoteCast` events against storage |
| `docs/` | spec, reports, threat model, ADRs, screenshots |
| `lib/` | forge-std and openzeppelin-contracts (git submodules) |

Documents (mostly in Vietnamese):

- Specification: [docs/GovVote_Thiet_ke_v1.1.pdf](docs/GovVote_Thiet_ke_v1.1.pdf)
- Threat model: [docs/threat-model.md](docs/threat-model.md)
- Architecture decisions: [docs/adr.md](docs/adr.md)
- Phase reports: [Phase 1 demo](docs/phase1-demo-report.md), [Phase 2A invariants](docs/phase2a-invariant-report.md), [Phase 2B verify](docs/phase2b-verify-report.md), [Phase 3 frontend](docs/phase3-frontend-report.md)
- Progress log: [docs/PROGRESS.md](docs/PROGRESS.md)

## Roadmap (not done yet)

- Sepolia deploy with source verification on Etherscan
- Continuous integration (CI)
- Public hosting of the frontend

## Author and license

Author: Lê Tiến Mạnh. Released under the [MIT License](LICENSE).
