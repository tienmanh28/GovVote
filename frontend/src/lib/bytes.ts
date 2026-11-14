// Đếm byte UTF-8 giống hệt cách GovVote đếm: `bytes(title).length` trong Solidity.
// KHÔNG đếm ký tự: "ệ" là 1 ký tự nhưng 3 byte, emoji "👍" là 4 byte.
// KHÔNG chuẩn hóa Unicode (NFC/NFD): chuỗi gửi lên contract chính là chuỗi đã đếm, nên số byte luôn khớp.

const encoder = new TextEncoder();

export function utf8ByteLength(text: string): number {
  return encoder.encode(text).length;
}

export type ProposalInputCheck = {
  titleBytes: number;
  descriptionBytes: number;
  titleError: string | null;
  descriptionError: string | null;
  ok: boolean;
};

/**
 * Kiểm tra form tạo proposal theo đúng quy tắc của contract (đặc tả mục 2.2):
 * title 1..maxTitle byte, description 0..maxDescription byte. Giới hạn đọc từ contract
 * (MAX_TITLE_BYTES, MAX_DESCRIPTION_BYTES), không hardcode trong UI.
 */
export function checkProposalInput(
  title: string,
  description: string,
  maxTitle: number,
  maxDescription: number,
): ProposalInputCheck {
  const titleBytes = utf8ByteLength(title);
  const descriptionBytes = utf8ByteLength(description);
  const titleError =
    titleBytes === 0
      ? "Tiêu đề không được để trống."
      : titleBytes > maxTitle
        ? `Tiêu đề dài ${titleBytes} byte, tối đa ${maxTitle} byte UTF-8.`
        : null;
  const descriptionError =
    descriptionBytes > maxDescription ? `Mô tả dài ${descriptionBytes} byte, tối đa ${maxDescription} byte UTF-8.` : null;
  return { titleBytes, descriptionBytes, titleError, descriptionError, ok: !titleError && !descriptionError };
}
