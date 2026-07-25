import { formatGbp, formatInt, formatMonthYear } from "../format";
import type { Summary } from "../types";

interface KpiStripProps {
  summary: Summary;
}

/**
 * Job count and date range lead deliberately: the upload demo hinges on the
 * visible transition from history-only to the full dataset.
 */
export function KpiStrip({ summary }: KpiStripProps) {
  const coverage = `${formatMonthYear(summary.date_range.min_sales_in)} — ${formatMonthYear(
    summary.date_range.max_sales_in,
  )}`;

  return (
    <div className="fade-in flex flex-wrap items-start gap-x-12 gap-y-6 border-y border-ink py-6">
      <Kpi label="Jobs loaded" value={formatInt(summary.job_count)} lead />
      <Kpi label="Period covered" value={coverage} lead />
      <Kpi label="Value added (VA)" value={formatGbp(summary.total_va_gbp)} />
      <Kpi label="Revenue" value={formatGbp(summary.total_revenue_gbp)} />
      <Kpi label="Customers" value={formatInt(summary.customer_count)} />
      <Kpi
        label="Excluded from value"
        value={`${formatInt(summary.exclusions.credits)} credits · ${formatInt(
          summary.exclusions.open_jobs,
        )} open`}
        small
      />
    </div>
  );
}

function Kpi({
  label,
  value,
  lead = false,
  small = false,
}: {
  label: string;
  value: string;
  lead?: boolean;
  small?: boolean;
}) {
  const size = lead ? "text-[26px]" : small ? "text-sm" : "text-lg";
  return (
    <div>
      <p className="font-head text-[10px] font-semibold uppercase tracking-[0.16em] text-mid">
        {label}
      </p>
      <p
        className={`num mt-2 whitespace-nowrap text-left ${size} ${
          lead ? "font-medium text-ink" : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
