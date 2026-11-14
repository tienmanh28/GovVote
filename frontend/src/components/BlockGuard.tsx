// Lỗi polling block cũng phải được hiển thị, kể cả đã có block trong cache.
import type { ReactNode } from "react";
import { useBlockStatus } from "../lib/useCurrentBlock.ts";
import { ReadError } from "./ReadError.tsx";
import { Spinner } from "./ui.tsx";
export function BlockGuard({ children }: { children: ReactNode }) {
  const block = useBlockStatus();
  if (block.error) return <ReadError queries={[block]} />;
  if (block.data === undefined) return <Spinner />;
  return children;
}
