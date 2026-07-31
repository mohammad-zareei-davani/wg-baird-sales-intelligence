import { useRef, useState } from "react";
import { api } from "../api/client";

export function UploadControl({ onUploaded }: { onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setStatus(null);
    try {
      const result = await api.uploadData(file);
      setStatus(`Loaded ${result.row_count.toLocaleString("en-GB")} jobs from ${result.source}`);
      onUploaded();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        className={`flex cursor-pointer items-center justify-center gap-2 rounded-md bg-accent px-3 py-2 text-center text-[12.5px] font-semibold text-white shadow-card transition-colors hover:bg-accentStrong ${
          busy ? "pointer-events-none opacity-70" : ""
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 16V4M7 9l5-5 5 5M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
        </svg>
        {busy ? "Loading…" : "Upload new data"}
        <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={handleChange} disabled={busy} hidden />
      </label>
      {status && <span className="text-[11px] leading-snug text-ink-muted">{status}</span>}
    </div>
  );
}
