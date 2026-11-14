// Lỗi đọc không được biến thành dữ liệu rỗng hoặc spinner vô hạn.
import { Button, Notice } from "./ui.tsx";
import { toUserMessage } from "../errors.ts";
import { BaseError, ContractFunctionRevertedError } from "viem";
export type ReadQuery = { error: unknown; refetch: () => unknown; isFetching?: boolean };
export function ReadError({ queries }: { queries: ReadQuery[] }) {
  const failed = queries.filter((q) => q.error);
  const messages = [...new Set(failed.map((q) => toUserMessage(q.error)))];
  // Revert đã giải mã là kết quả contract, không phải lỗi kết nối cần retry.
  const onlyReverts =
    failed.length > 0 &&
    failed.every(({ error }) => {
      const reverted =
        error instanceof BaseError
          ? error.walk((e) => e instanceof ContractFunctionRevertedError)
          : undefined;
      return reverted instanceof ContractFunctionRevertedError && !!reverted.data?.errorName;
    });
  if (onlyReverts)
    return (
      <Notice tone="error">
        {messages.map((message) => (
          <p key={message}>{message}</p>
        ))}
      </Notice>
    );
  return (
    <Notice tone="error" title="Không đọc được dữ liệu">
      {messages.map((message) => (
        <p key={message}>{message}</p>
      ))}
      <Button
        disabled={failed.some((q) => q.isFetching)}
        onClick={() => {
          failed.forEach((q) => {
            void q.refetch();
          });
        }}
      >
        Thử lại
      </Button>
    </Notice>
  );
}
