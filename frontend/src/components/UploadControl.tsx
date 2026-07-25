import { useRef, useState } from "react";
import { postIngest } from "../api/client";
import { formatInt } from "../format";
import type { IngestResponse } from "../types";

interface UploadControlProps {
  onIngested: () => void;
}

export function UploadControl({ onIngested }: UploadControlProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IngestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File): Promise<void> {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await postIngest(file);
      setResult(response);
      onIngested();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="border border-ink px-4 py-2 font-head text-[11px] font-semibold uppercase tracking-[0.14em] text-ink transition-colors hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Ingesting…" : "Upload workbook"}
        </button>
      </div>

      {result ? (
        <div
          role="status"
          className="fade-in border-l-2 border-cyan bg-white/60 px-3 py-2 text-right"
        >
          <p className="font-head text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan">
            Ingest complete — {result.source_filename}
          </p>
          <p className="mt-1 text-xs text-ink">
            <span className="num text-sm font-medium">{formatInt(result.rows_inserted)}</span>{" "}
            inserted ·{" "}
            <span className="num text-sm font-medium">{formatInt(result.rows_updated)}</span>{" "}
            updated ·{" "}
            <span className="num text-sm font-medium">{formatInt(result.rows_read)}</span> read
          </p>
          <p className="mt-0.5 text-xs text-mid">
            Database now holds{" "}
            <span className="num font-medium text-ink">{formatInt(result.job_count)}</span> jobs
          </p>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="border-l-2 border-magenta pl-2 text-xs text-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
