import { useDashboard } from "../data/DashboardDataContext";
import { UploadControl } from "./UploadControl";
import type { ReportMeta } from "../api/types";

/** Shown on a fresh install, when there is nothing to report on yet. */
export function EmptyLibrary() {
  return (
    <div className="mx-auto flex max-w-[560px] flex-col items-center py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-edge bg-raised">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="text-ink-muted" aria-hidden="true">
          <path d="M4 4h9l3 3h4v13H4z" strokeLinejoin="round" />
          <path d="M12 11v6M9 14h6" strokeLinecap="round" />
        </svg>
      </div>

      <h1 className="mt-6 font-display text-[28px] font-semibold tracking-[-0.02em] text-ink-primary">
        Upload a dataset to begin
      </h1>
      <p className="mt-3 max-w-[46ch] text-[14px] leading-relaxed text-ink-secondary">
        Add a job-list workbook and the platform will analyse it, train the pricing and
        retention models, and write the commentary. The finished report is saved, so it is
        here whenever you come back.
      </p>

      <div className="mt-7 w-full max-w-[280px]">
        <UploadControl variant="primary" />
      </div>

      <p className="mt-5 text-[12px] leading-relaxed text-ink-muted">
        Expects an <code className="font-mono">.xlsx</code> export with a sheet named
        “Master Plain (Anon)”.
      </p>
    </div>
  );
}

/** Shown while a report is being built. Deliberately shows no report content. */
export function GeneratingReport({ report }: { report: ReportMeta }) {
  const pct = Math.max(3, Math.min(100, report.progress_pct));

  return (
    <div className="mx-auto flex max-w-[560px] flex-col items-center py-24 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-label text-accentStrong">
        Building report
      </div>
      <h1 className="mt-3 font-display text-[26px] font-semibold tracking-[-0.02em] text-ink-primary">
        {report.name.replace(/\.(xlsx|xls)$/i, "")}
      </h1>

      <div className="mt-8 w-full">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-edge">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-3 flex items-baseline justify-between text-[12.5px]">
          <span className="text-ink-secondary">{report.progress ?? "Working"}</span>
          <span className="tnum text-ink-muted">{pct}%</span>
        </div>
      </div>

      <p className="mt-8 max-w-[48ch] text-[13px] leading-relaxed text-ink-secondary">
        Analysing {report.row_count.toLocaleString("en-GB")} jobs across{" "}
        {report.customer_count.toLocaleString("en-GB")} customers, then writing the
        commentary for each insight. This takes a couple of minutes and only happens once:
        the finished report is saved.
      </p>
    </div>
  );
}

/** Shown when generation failed, with the reason and a way forward. */
export function FailedReport({ report }: { report: ReportMeta }) {
  const { remove } = useDashboard();

  return (
    <div className="mx-auto flex max-w-[560px] flex-col items-center py-24 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-label text-status-criticalText">
        Report failed
      </div>
      <h1 className="mt-3 font-display text-[26px] font-semibold tracking-[-0.02em] text-ink-primary">
        {report.name.replace(/\.(xlsx|xls)$/i, "")}
      </h1>

      <p className="mt-5 w-full rounded-md border border-edge bg-status-criticalBg px-4 py-3 text-left text-[13px] leading-relaxed text-status-criticalText">
        {report.error ?? "The report could not be generated."}
      </p>

      <div className="mt-7 flex flex-col items-center gap-3">
        <UploadControl variant="primary" />
        <button
          type="button"
          onClick={() => remove(report.id)}
          className="text-[12px] font-semibold text-ink-muted hover:text-status-criticalText"
        >
          Remove this report
        </button>
      </div>
    </div>
  );
}
