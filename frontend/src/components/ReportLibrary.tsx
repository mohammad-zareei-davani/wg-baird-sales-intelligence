import { useState } from "react";
import { useDashboard } from "../data/DashboardDataContext";
import type { ReportMeta } from "../api/types";

function shortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });
}

const STATUS_DOT: Record<string, string> = {
  ready: "bg-status-good",
  generating: "bg-status-warning",
  failed: "bg-status-critical",
};

/**
 * The stored reports, newest first. Each one keeps its dataset and its
 * finished commentary, so returning to an older report costs a database read
 * rather than a rebuild.
 */
export function ReportLibrary() {
  const { reports, selected, select, remove } = useDashboard();
  const [confirming, setConfirming] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  if (!reports.length) return null;

  async function handleDelete(report: ReportMeta) {
    setBusy(report.id);
    try {
      await remove(report.id);
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-label text-rail-muted">
        Reports
      </div>

      {reports.map((r) => {
        const isActive = selected?.id === r.id;
        const isConfirming = confirming === r.id;

        return (
          <div key={r.id} className="group relative">
            <button
              type="button"
              onClick={() => select(r.id)}
              className={`w-full rounded-md py-2 pl-2.5 text-left transition-colors ${
                r.status !== "generating" ? "pr-8" : "pr-2.5"
              } ${isActive ? "bg-rail-soft" : "hover:bg-rail-soft/60"}`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${STATUS_DOT[r.status] ?? "bg-rail-muted"}`}
                  aria-hidden="true"
                />
                <span
                  className={`min-w-0 truncate text-[12.5px] ${
                    isActive ? "font-semibold text-white" : "text-rail-text"
                  }`}
                  title={r.name}
                >
                  {r.name.replace(/\.(xlsx|xls)$/i, "")}
                </span>
              </div>
              <div className="mt-0.5 pl-3.5 text-[10.5px] text-rail-muted">
                {r.status === "generating"
                  ? `Generating ${r.progress_pct}%`
                  : r.status === "failed"
                    ? "Failed"
                    : `${r.row_count.toLocaleString("en-GB")} jobs · ${shortDate(r.created_at)}`}
              </div>
            </button>

            {r.status !== "generating" && (
              <button
                type="button"
                onClick={() => setConfirming(isConfirming ? null : r.id)}
                aria-label={`Delete ${r.name}`}
                title="Delete this report and its dataset"
                className="absolute right-1.5 top-1.5 hidden rounded p-1 text-status-critical hover:bg-status-critical/20 group-hover:block"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" />
                </svg>
              </button>
            )}

            {isConfirming && (
              <div className="mx-2.5 mb-1 mt-1 rounded-md border border-rail-edge bg-rail-soft p-2">
                <p className="text-[11px] leading-snug text-rail-text">
                  Delete this report and its dataset? This cannot be undone.
                </p>
                <div className="mt-2 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleDelete(r)}
                    disabled={busy === r.id}
                    className="rounded bg-status-critical px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
                  >
                    {busy === r.id ? "Deleting" : "Delete"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(null)}
                    className="rounded border border-rail-edge px-2 py-1 text-[11px] font-semibold text-rail-text"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
