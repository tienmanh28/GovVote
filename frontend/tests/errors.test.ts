// Unit test cho errors.ts: dịch theo TÊN LỖI đã giải mã từ ABI, không so khớp chuỗi thô.
import { describe, expect, test } from "vitest";
import {
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  UserRejectedRequestError,
  encodeErrorResult,
  type Hex,
} from "viem";
import { govTokenAbi } from "../src/abi/govToken.ts";
import { govVoteAbi } from "../src/abi/govVote.ts";
import {
  GOV_VOTE_ERROR_MESSAGES,
  GOV_VOTE_ERROR_NAMES,
  USER_REJECTED_MESSAGE,
  toUserMessage,
  translateGovError,
} from "../src/errors.ts";

const ALICE = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

/** Dựng lỗi giống hệt viem tạo ra khi simulate/write gặp revert: ExecutionError bọc RevertedError. */
function revert(
  abi: readonly unknown[],
  data: Hex,
  functionName = "castVote",
  args: readonly unknown[] = [1n, true],
) {
  const cause = new ContractFunctionRevertedError({ abi: abi as never, data, functionName });
  return new ContractFunctionExecutionError(cause, {
    abi: abi as never,
    functionName,
    args,
    contractAddress: ALICE,
  });
}

describe("danh sách lỗi", () => {
  test("đủ 10 tên lỗi của đặc tả và mỗi tên có bản dịch", () => {
    expect(GOV_VOTE_ERROR_NAMES).toHaveLength(10);
    for (const name of GOV_VOTE_ERROR_NAMES) {
      const msg = GOV_VOTE_ERROR_MESSAGES[name]([1n, 2n]);
      expect(msg.length, name).toBeGreaterThan(0);
    }
  });

  test("khớp đúng các custom error trong ABI build từ src/GovVote.sol", () => {
    const fromAbi = govVoteAbi
      .filter((x) => x.type === "error")
      .map((x) => x.name)
      .sort();
    expect(fromAbi).toEqual([...GOV_VOTE_ERROR_NAMES].sort());
  });
});

describe("toUserMessage", () => {
  test("mọi lỗi GovVote giải mã từ revert data ra tiếng Việt", () => {
    const cases: Array<[string, readonly unknown[], RegExp]> = [
      ["ProposalNotFound", [7n], /Không tìm thấy proposal #7/],
      ["EmptyTitle", [], /không được để trống/],
      ["TitleTooLong", [101n], /101 byte/],
      ["DescriptionTooLong", [1001n], /1001 byte/],
      ["BelowThreshold", [5n * 10n ** 20n, 10n ** 21n], /500 GOV.*1\.000 GOV/],
      ["NotActive", [1n, 2], /Thông qua \(Succeeded\)/],
      ["AlreadyVoted", [1n, ALICE], /đã bỏ phiếu/],
      ["NoVotingPower", [1n, ALICE], /không có voting power/],
      ["InvalidConfiguration", [], /Cấu hình GovVote không hợp lệ/],
      ["SnapshotNotFinalized", [1n, 25n], /chưa qua block snapshot 25/],
    ];
    for (const [errorName, args, expected] of cases) {
      const data = encodeErrorResult({
        abi: govVoteAbi,
        errorName: errorName as never,
        args: args as never,
      });
      expect(toUserMessage(revert(govVoteAbi, data)), errorName).toMatch(expected);
    }
  });

  test("dịch dựa vào errorName, không dựa vào thông báo thô", () => {
    // Thông báo gốc chứa chữ "AlreadyVoted" nhưng không có revert data → KHÔNG được dịch thành AlreadyVoted.
    expect(toUserMessage(new Error("execution reverted: AlreadyVoted"))).toBe(
      "execution reverted: AlreadyVoted",
    );
  });

  test("người dùng từ chối ký (4001)", () => {
    expect(
      toUserMessage(new UserRejectedRequestError(new Error("User rejected the request."))),
    ).toBe(USER_REJECTED_MESSAGE);
    expect(toUserMessage({ code: 4001, message: "User denied transaction signature." })).toBe(
      USER_REJECTED_MESSAGE,
    );
    expect(USER_REJECTED_MESSAGE).toBe("Bạn đã từ chối giao dịch trong ví");
  });

  test("lỗi contract khác (GovToken/OpenZeppelin): hiện đúng tên gốc, không bịa bản dịch", () => {
    // ERC5805FutureLookup(uint256 timepoint, uint48 clock): uint48 là kiểu number trong viem.
    const data = encodeErrorResult({
      abi: govTokenAbi,
      errorName: "ERC5805FutureLookup",
      args: [10n, 9],
    });
    expect(toUserMessage(revert(govTokenAbi, data, "getPastVotes", [ALICE, 10n]))).toBe(
      "Contract revert: ERC5805FutureLookup(10, 9)",
    );
    expect(translateGovError("ERC5805FutureLookup")).toBeUndefined();
  });

  test("lỗi không nhận ra: giữ thông báo gốc", () => {
    expect(toUserMessage(new Error("fetch failed"))).toBe("fetch failed");
    expect(toUserMessage("chuỗi lạ")).toBe("chuỗi lạ");
  });
});
