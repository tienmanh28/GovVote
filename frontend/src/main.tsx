// Điểm khởi động: kiểm tra env trước, rồi mới tạo cấu hình wagmi và render ứng dụng.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ReliableApp } from "./components/ReliableApp.tsx";
import { parseEnv } from "./config.ts";
import "./index.css";

const root = createRoot(document.getElementById("root")!);
const parsed = parseEnv(import.meta.env as Record<string, string | undefined>);

if (!parsed.ok) {
  root.render(
    <StrictMode>
      <main className="mx-auto max-w-2xl p-4" data-testid="config-error">
        <h1 className="text-xl font-bold">Lỗi cấu hình</h1>
        <ul className="mt-3 list-disc pl-5 text-sm">
          {parsed.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm">
          Sao chép frontend/.env.example thành .env.local, điền địa chỉ rồi build lại.
        </p>
      </main>
    </StrictMode>,
  );
} else {
  root.render(
    <StrictMode>
      <ReliableApp config={parsed.config} />
    </StrictMode>,
  );
}
