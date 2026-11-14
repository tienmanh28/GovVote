// Unit test cho các hàm thuần trong src/lib và src/config.ts.
import { describe, expect, test } from "vitest";
import { zeroAddress } from "viem";
import { parseEnv } from "../src/config.ts";
import { checkProposalInput, utf8ByteLength } from "../src/lib/bytes.ts";
import { formatGov, stateLabel } from "../src/lib/format.ts";
import { summarizeVotingPower } from "../src/lib/power.ts";
import { parseRoute } from "../src/lib/route.ts";
import { TX_IDLE, isBusy, txReducer, type TxState } from "../src/lib/txMachine.ts";
import { classifyWalletEnv } from "../src/lib/walletEnv.ts";

const GOV = 10n ** 18n;
const ALICE = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as const;
const BOB = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as const;

describe("bộ đếm byte UTF-8", () => {
  test("ASCII: 1 byte mỗi ký tự", () => {
    expect(utf8ByteLength("")).toBe(0);
    expect(utf8ByteLength("GovVote")).toBe(7);
  });
  test("chữ có dấu tiếng Việt: 2–3 byte mỗi ký tự", () => {
    expect(utf8ByteLength("ệ")).toBe(3); // U+1EC7
    expect(utf8ByteLength("đ")).toBe(2); // U+0111
    expect(utf8ByteLength("Tiếng Việt")).toBe(14); // "ế" và "ệ" 3 byte
    expect([..."Tiếng Việt"].length).toBe(10); // 10 ký tự nhưng 14 byte
  });
  test("cùng chữ nhưng dạng tổ hợp (NFD) tốn nhiều byte hơn; không chuẩn hóa để khớp contract", () => {
    const nfd = "ệ".normalize("NFD"); // e + dấu nặng + dấu mũ
    expect(utf8ByteLength(nfd)).toBe(5);
  });
  test("emoji: 4 byte, chuỗi ZWJ dài hơn nhiều", () => {
    expect(utf8ByteLength("👍")).toBe(4);
    expect(utf8ByteLength("👨‍👩‍👧")).toBe(18); // 3 emoji × 4 + 2 ZWJ × 3
  });
  test("giới hạn form theo byte, không theo ký tự", () => {
    expect(checkProposalInput("", "", 100, 1000).titleError).toMatch(/trống/);
    const title100 = "a".repeat(100);
    expect(checkProposalInput(title100, "", 100, 1000).ok).toBe(true);
    // 34 chữ "ệ" = 34 ký tự nhưng 102 byte → vượt 100.
    const viet = "ệ".repeat(34);
    const r = checkProposalInput(viet, "", 100, 1000);
    expect(r.titleBytes).toBe(102);
    expect(r.ok).toBe(false);
    expect(checkProposalInput("x", "👍".repeat(251), 100, 1000).descriptionError).toMatch(
      /1004 byte/,
    );
  });
});

describe("tách số dư và voting power", () => {
  test("có GOV nhưng chưa delegate: voting power 0", () => {
    const s = summarizeVotingPower(ALICE, 10_000n * GOV, 0n, zeroAddress);
    expect(s.delegation).toBe("none");
    expect(s.delegatee).toBeNull();
    expect(s.votes).toBe(0n);
    expect(s.notes[0]).toMatch(/CHƯA delegate/);
  });
  test("tự delegate: votes = balance, không nhận thêm từ ai", () => {
    const s = summarizeVotingPower(ALICE, 400_000n * GOV, 400_000n * GOV, ALICE);
    expect(s.delegation).toBe("self");
    expect(s.receivedFromOthers).toBe(0n);
  });
  test("so sánh địa chỉ không phân biệt hoa thường", () => {
    expect(
      summarizeVotingPower(ALICE, 1n, 1n, ALICE.toLowerCase() as `0x${string}`).delegation,
    ).toBe("self");
  });
  test("tự delegate và nhận thêm từ người khác", () => {
    const s = summarizeVotingPower(ALICE, 100n * GOV, 350n * GOV, ALICE);
    expect(s.receivedFromOthers).toBe(250n * GOV);
    expect(s.notes.some((n) => n.includes("250 GOV"))).toBe(true);
  });
  test("ủy quyền cho người khác: vẫn giữ số dư, nhưng votes chỉ là phần nhận từ người khác", () => {
    const s = summarizeVotingPower(ALICE, 200n * GOV, 50n * GOV, BOB);
    expect(s.delegation).toBe("other");
    expect(s.balance).toBe(200n * GOV);
    expect(s.receivedFromOthers).toBe(50n * GOV);
    expect(s.notes[0]).toMatch(/ủy quyền cho 0x3C44…93BC/);
  });
});

describe("định dạng", () => {
  test("formatGov luôn có đơn vị GOV", () => {
    expect(formatGov(600_000n * GOV)).toBe("600.000 GOV");
    expect(formatGov(0n)).toBe("0 GOV");
    expect(formatGov(1n)).toBe("0,000000000000000001 GOV");
    expect(formatGov(1_234_567n * GOV + GOV / 2n)).toBe("1.234.567,5 GOV");
  });
  test("stateLabel theo thứ tự enum State", () => {
    expect(stateLabel(0)).toBe("Chờ snapshot (Pending)");
    expect(stateLabel(3n)).toBe("Không thông qua (Defeated)");
  });
});

describe("máy trạng thái giao dịch", () => {
  const hash = "0xabc" as const;
  test("đường thành công", () => {
    let s: TxState = TX_IDLE;
    s = txReducer(s, { type: "START" });
    expect(s.status).toBe("AWAITING_SIGNATURE");
    expect(isBusy(s)).toBe(true);
    s = txReducer(s, { type: "SIGNED", hash });
    expect(s).toEqual({ status: "PENDING", hash });
    s = txReducer(s, { type: "CONFIRMED" });
    expect(s).toEqual({ status: "SUCCESS", hash });
    expect(isBusy(s)).toBe(false);
  });
  test("lỗi khi chờ ký (không có hash) và khi chờ receipt (giữ hash)", () => {
    expect(txReducer({ status: "AWAITING_SIGNATURE" }, { type: "FAILED", message: "x" })).toEqual({
      status: "ERROR",
      message: "x",
    });
    expect(txReducer({ status: "PENDING", hash }, { type: "FAILED", message: "y" })).toEqual({
      status: "ERROR",
      message: "y",
      hash,
    });
  });
  test("sự kiện sai thứ tự bị bỏ qua", () => {
    expect(txReducer(TX_IDLE, { type: "CONFIRMED" })).toBe(TX_IDLE);
    expect(txReducer(TX_IDLE, { type: "SIGNED", hash })).toBe(TX_IDLE);
    const pending: TxState = { status: "PENDING", hash };
    expect(txReducer(pending, { type: "START" })).toBe(pending);
  });
  test("gửi lại sau SUCCESS hoặc ERROR; RESET về IDLE", () => {
    expect(txReducer({ status: "SUCCESS", hash }, { type: "START" }).status).toBe(
      "AWAITING_SIGNATURE",
    );
    expect(txReducer({ status: "ERROR", message: "z" }, { type: "START" }).status).toBe(
      "AWAITING_SIGNATURE",
    );
    expect(txReducer({ status: "PENDING", hash }, { type: "RESET" })).toBe(TX_IDLE);
  });
});

describe("môi trường ví", () => {
  const IPHONE =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
  const IPAD_DESKTOP_UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15";
  const LINUX = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36";
  test("có window.ethereum thì sẵn sàng, kể cả trên điện thoại (trình duyệt trong app MetaMask)", () => {
    expect(classifyWalletEnv(true, IPHONE, 5)).toBe("ready");
  });
  test("điện thoại / iPad không có ví", () => {
    expect(classifyWalletEnv(false, IPHONE, 5)).toBe("mobile-no-wallet");
    expect(classifyWalletEnv(false, IPAD_DESKTOP_UA, 5)).toBe("mobile-no-wallet");
  });
  test("máy tính không có ví", () => {
    expect(classifyWalletEnv(false, LINUX, 0)).toBe("desktop-no-wallet");
    expect(classifyWalletEnv(false, IPAD_DESKTOP_UA, 0)).toBe("desktop-no-wallet");
  });
});

describe("cấu hình env", () => {
  const ok = {
    VITE_RPC_URL: "http://127.0.0.1:8545",
    VITE_CHAIN_ID: "31337",
    VITE_GOV_VOTE: "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512",
    VITE_GOV_TOKEN: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  };
  test("hợp lệ: địa chỉ được chuẩn hóa checksum", () => {
    const r = parseEnv(ok);
    expect(r.ok && r.config.govVote).toBe("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");
  });
  test("thiếu địa chỉ, sai địa chỉ, sai chain đều báo lỗi", () => {
    const r = parseEnv({
      ...ok,
      VITE_GOV_VOTE: "",
      VITE_GOV_TOKEN: "0x123",
      VITE_CHAIN_ID: "11155111",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toHaveLength(3);
  });
});

describe("route", () => {
  test("các trang", () => {
    expect(parseRoute("")).toEqual({ name: "list" });
    expect(parseRoute("#/proposal/12")).toEqual({ name: "detail", id: 12n });
    expect(parseRoute("#/create")).toEqual({ name: "create" });
    expect(parseRoute("#/wallet")).toEqual({ name: "wallet" });
    expect(parseRoute("#/proposal/abc")).toEqual({ name: "notfound" });
  });
});
