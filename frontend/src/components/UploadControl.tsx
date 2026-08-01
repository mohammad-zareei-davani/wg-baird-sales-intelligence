import { useRef, useState } from "react";
import { useDashboard } from "../data/DashboardDataContext";

export function UploadControl({ variant = "sidebar" }: { variant?: "sidebar" | "primary" }) {
  const { upload } = useDashboard();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await upload(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const styles =
    variant === "primary"
      ? "bg-accent px-5 py-3 text-[14px] text-white hover:bg-accentStrong"
      : "bg-accent px-3 py-2 text-[12.5px] text-white hover:bg-accentStrong";

  return (
    <div className="flex flex-col gap-2">
      <label
        className={`flex cursor-pointer items-center justify-center gap-2 rounded-md text-center font-semibold transition-colors ${styles} ${
          busy ? "pointer-events-none opacity-70" : ""
        }`}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 16V4M7 9l5-5 5 5M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
        </svg>
        {busy ? "Uploading" : "Upload a new data"}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleChange}
          disabled={busy}
          hidden
        />
      </label>
      {error && (
        <span
          className={`text-[11px] leading-snug ${
            variant === "primary" ? "text-status-criticalText" : "text-status-critical"
          }`}
        >
          {error}
        </span>
      )}
    </div>
  );
}
