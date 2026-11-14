import { parseRoute } from "../src/lib/route.ts";
import { expect, test } from "vitest";
import { verifyEvidence, calculateQuorum, expectedState } from "../../shared/verification/core.ts";
import { fixture, addr, hash } from "../../shared/verification/fixtures.ts";
const run = (f: ReturnType<typeof fixture>) => verifyEvidence(f.input, f.context, f.evidence);
test("strict Active: event/storage match => VERIFIED tại H", () => {
  const r = run(fixture());
  expect(r.status).toBe("VERIFIED");
  expect(r.calculated?.participation).toBe(100n);
  expect(r.calculated?.expectedState).toBe(1n);
});
for (const [name, change, reason] of [
  [
    "tally",
    (f: ReturnType<typeof fixture>) => {
      f.evidence.proposal!.forVotes++;
    },
    "TALLY_MISMATCH",
  ],
  [
    "quorum",
    (f: ReturnType<typeof fixture>) => {
      f.evidence.quorum!.contractQuorum++;
    },
    "QUORUM_MISMATCH",
  ],
  [
    "state",
    (f: ReturnType<typeof fixture>) => {
      f.evidence.contractState = 2n;
    },
    "STATE_MISMATCH",
  ],
  [
    "proposal ID",
    (f: ReturnType<typeof fixture>) => {
      f.evidence.created!.id = 2n;
    },
    "PROPOSAL_MISMATCH",
  ],
  [
    "contract",
    (f: ReturnType<typeof fixture>) => {
      f.evidence.votes![0]!.address = addr(9);
    },
    "EVENT_SCOPE",
  ],
  [
    "voter trùng",
    (f: ReturnType<typeof fixture>) => {
      f.evidence.votes![1]!.voter = addr(3);
    },
    "DUPLICATE_VOTER",
  ],
  [
    "duplicate conflicting log",
    (f: ReturnType<typeof fixture>) => {
      f.evidence.votes!.push({ ...f.evidence.votes![0]!, weight: 61n });
    },
    "DUPLICATE_LOG_CONFLICT",
  ],
  [
    "metadata title",
    (f: ReturnType<typeof fixture>) => {
      f.evidence.created!.title = "Sai";
    },
    "PROPOSAL_MISMATCH",
  ],
  [
    "snapshot",
    (f: ReturnType<typeof fixture>) => {
      f.evidence.created!.snapshotBlock++;
    },
    "PROPOSAL_MISMATCH",
  ],
  [
    "vote tại snapshot",
    (f: ReturnType<typeof fixture>) => {
      f.evidence.votes![0]!.blockNumber = 25n;
    },
    "EVENT_SCOPE",
  ],
  [
    "vote sau deadline",
    (f: ReturnType<typeof fixture>) => {
      f.evidence.votes![0]!.blockNumber = 7226n;
    },
    "EVENT_SCOPE",
  ],
] as const)
  test(`strict mismatch ${name}`, () => {
    const f = fixture();
    change(f);
    expect(run(f).status).toBe("MISMATCH");
    expect(run(f).reason).toBe(reason);
  });
for (const [name, change] of [
  [
    "missing storage",
    (f: ReturnType<typeof fixture>) => {
      delete f.evidence.proposal;
    },
  ],
  [
    "missing creation",
    (f: ReturnType<typeof fixture>) => {
      delete f.evidence.created;
    },
  ],
  [
    "missing votes array",
    (f: ReturnType<typeof fixture>) => {
      delete f.evidence.votes;
    },
  ],
  [
    "range thiếu",
    (f: ReturnType<typeof fixture>) => {
      f.evidence.ranges = [];
    },
  ],
  [
    "range hở",
    (f: ReturnType<typeof fixture>) => {
      f.evidence.ranges = [{ from: 11n, to: 100n }];
    },
  ],
  [
    "missing quorum",
    (f: ReturnType<typeof fixture>) => {
      delete f.evidence.quorum;
    },
  ],
  [
    "missing state",
    (f: ReturnType<typeof fixture>) => {
      delete f.evidence.contractState;
    },
  ],
  [
    "reorg",
    (f: ReturnType<typeof fixture>) => {
      f.context.anchorStable = false;
    },
  ],
  [
    "malformed event",
    (f: ReturnType<typeof fixture>) => {
      f.evidence.votes![0]!.transactionHash = "bad";
    },
  ],
] as const)
  test(`strict incomplete ${name}`, () => {
    const f = fixture();
    change(f);
    expect(run(f).status).toBe("INCOMPLETE");
  });
test("RPC silently thiếu log => tally mismatch, không kết luận gian lận", () => {
  const f = fixture();
  f.evidence.votes!.pop();
  expect(run(f).reason).toBe("TALLY_MISMATCH");
});
test("exact duplicate counted once trước khi kiểm voter", () => {
  const f = fixture();
  f.evidence.votes!.push({ ...f.evidence.votes![0]! });
  expect(run(f).status).toBe("VERIFIED");
  expect(run(f).calculated?.uniqueLogs).toBe(2);
});
test("quorum làm tròn lên, boundary", () => {
  expect(calculateQuorum(1001n, 1000n)).toBe(101n);
  const f = fixture();
  for (const participation of [99n, 100n, 101n])
    expect(
      expectedState(
        7226n,
        { ...f.evidence.proposal!, forVotes: 60n, againstVotes: participation - 60n },
        participation,
        100n,
      ),
    ).toBe(participation < 100n ? 3n : 2n);
});
for (const head of [25n, 26n, 7225n, 7226n])
  test(`boundary H=${head}`, () => {
    const f = fixture();
    expect(expectedState(head, f.evidence.proposal!, 100n, 100n)).toBe(
      head === 25n ? 0n : head <= 7225n ? 1n : 2n,
    );
  });
for (const state of [2n, 3n])
  test(`proposal đã kết thúc state=${state}`, () => {
    const f = fixture();
    f.context.head = 7226n;
    f.context.latest = 7238n;
    f.context.hash = hash(7226);
    f.evidence.ranges[0]!.to = 7226n;
    f.evidence.contractState = state;
    if (state === 3n) {
      f.evidence.votes![0]!.weight = 40n;
      f.evidence.proposal!.forVotes = 40n;
    }
    expect(run(f).status).toBe("VERIFIED");
  });
test("Pending không VERIFIED dù 0 logs / 0 storage", () => {
  const f = fixture();
  f.context.head = 25n;
  f.context.latest = 37n;
  f.context.hash = hash(25);
  f.evidence.ranges[0]!.to = 25n;
  f.evidence.votes = [];
  f.evidence.proposal!.forVotes = 0n;
  f.evidence.proposal!.againstVotes = 0n;
  delete f.evidence.quorum;
  f.evidence.contractState = 0n;
  expect(run(f).reason).toBe("SNAPSHOT_NOT_FINALIZED");
});
test("insufficient confirmations", () => {
  const f = fixture();
  f.context.head = 0n;
  expect(run(f).reason).toBe("NOT_CONFIRMED");
});
test("large bigint không mất precision", () => {
  const f = fixture();
  const n = 10n ** 40n;
  f.evidence.quorum = { pastTotalSupply: n, quorumBps: 1000n, contractQuorum: n / 10n };
  f.evidence.votes![0]!.weight = n / 10n - 1n;
  f.evidence.votes![1]!.weight = 1n;
  f.evidence.proposal!.forVotes = n / 10n - 1n;
  f.evidence.proposal!.againstVotes = 1n;
  expect(run(f).status).toBe("VERIFIED");
  expect(run(f).calculated?.participation).toBe(n / 10n);
});
test("invalid ID và chain", () => {
  const f = fixture();
  f.input.proposalId = 0n;
  expect(run(f).status).toBe("INVALID_INPUT");
  f.input.proposalId = 1n;
  f.context.chainId = 1n;
  expect(run(f).reason).toBe("WRONG_CHAIN");
});
test("creation thiếu snapshot không được VERIFIED hoặc giả thành 0", () => {
  const f = fixture();
  f.evidence.created!.snapshotBlock = undefined as unknown as bigint;
  expect(run(f).status).toBe("INCOMPLETE");
});
for (const sameLogIndex of [true, false])
  test(`metadata transaction mâu thuẫn, same log index=${sameLogIndex}`, () => {
    const f = fixture();
    const second = f.evidence.votes![1]!;
    second.blockNumber = 26n;
    second.blockHash = hash(26);
    second.transactionIndex = sameLogIndex ? 1n : 0n;
    second.logIndex = sameLogIndex ? 0n : 1n;
    expect(run(f).status).toBe("MISMATCH");
    expect(run(f).reason).toBe("EVENT_SCOPE");
  });

test("verify route hỗ trợ uint256 ID mà không ép Number", () => {
  const id = 2n ** 256n - 1n;
  expect(parseRoute(`#/verify/${id}`)).toEqual({ name: "verify", id });
  expect(parseRoute(`#/verify/${id + 1n}`)).toEqual({ name: "notfound" });
});
