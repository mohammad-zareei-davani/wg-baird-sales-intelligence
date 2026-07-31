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
      setStatus(`Loaded ${result.row_count} rows from ${result.source}`);
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
      <label className="cursor-pointer rounded-lg bg-series-1 px-3 py-2 text-center text-[13px] font-semibold text-white">
        {busy ? "Loading…" : "Upload new data (.xlsx)"}
        <input ref={inputRef} type="file" accept=".xlsx,.xls" onChange={handleChange} disabled={busy} hidden />
      </label>
      {status && <span className="text-[11px] text-ink-muted">{status}</span>}
    </div>
  );
}
