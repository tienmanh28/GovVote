// Phân tích hash URL thành route (hàm thuần). Ví dụ "#/proposal/2" → { name: "detail", id: 2n }.
export type Route =
  | { name: "list" }
  | { name: "detail"; id: bigint }
  | { name: "verify"; id: bigint }
  | { name: "create" }
  | { name: "wallet" }
  | { name: "notfound" };

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, "") || "/";
  if (path === "/") return { name: "list" };
  if (path === "/create") return { name: "create" };
  if (path === "/wallet") return { name: "wallet" };
  const verify = /^\/verify\/(\d{1,78})$/.exec(path);
  if (verify?.[1] && BigInt(verify[1]) < 2n ** 256n)
    return { name: "verify", id: BigInt(verify[1]) };
  const m = /^\/proposal\/(\d{1,30})$/.exec(path);
  if (m?.[1]) return { name: "detail", id: BigInt(m[1]) };
  return { name: "notfound" };
}
