import { useCallback } from "react";
import { getSeasonality, getSummary } from "../api/client";
import { useApiData } from "../api/useApiData";
import { MonthlyVaChart } from "../components/charts/MonthlyVaChart";
import { KpiStrip } from "../components/KpiStrip";
import { Panel } from "../components/Panel";
import { ErrorState, LoadingState } from "../components/States";
import { Td, Th } from "../components/Table";
import { formatGbp, formatInt, formatMonthYear, formatSignedPct } from "../format";
import type { Summary } from "../types";

interface OverviewProps {
  dataVersion: number;
}

export function Overview({ dataVersion }: OverviewProps) {
  const summaryFetcher = useCallback(() => getSummary(), []);
  const seasonalityFetcher = useCallback(() => getSeasonality(), []);
  const summary = useApiData(summaryFetcher, [dataVersion]);
  const seasonality = useApiData(seasonalityFetcher, [dataVersion]);

  if (summary.error) return <ErrorState message={summary.error} />;
  if (!summary.data) return <LoadingState label="Loading summary" />;

  return (
    <div className="space-y-12">
      <KpiStrip summary={summary.data} />

      <Panel
        title="Monthly value added"
        note="Value added (labour plus markups) by booking month, closed non-credit jobs only. December troughs and February–March and August–October peaks are the operating seasonality."
      >
        {seasonality.error ? (
          <ErrorState message={seasonality.error} />
        ) : seasonality.data ? (
          <>
            <MonthlyVaChart monthly={seasonality.data.monthly} />
            <p className="mt-3 text-[11px] text-mid">
              Source: /api/seasonality/ · closed non-credit jobs · GBP, Euro converted at{" "}
              {summary.data.fx_eur_to_gbp}
            </p>
          </>
        ) : (
          <LoadingState label="Loading series" />
        )}
      </Panel>

      <Panel
        title="Like-for-like year on year"
        note="2026 runs only to 21 May, so every year is truncated to the same day-of-year range before comparison. Comparing raw annual totals would understate 2026 by roughly two thirds."
      >
        {seasonality.data ? (
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Like-for-like value added and revenue by year, truncated to a common day-of-year
            </caption>
            <thead>
              <tr className="border-b border-ink text-left">
                <Th>Year</Th>
                <Th numeric>VA (GBP)</Th>
                <Th numeric>Revenue (GBP)</Th>
                <Th numeric>VA change</Th>
                <Th numeric>Day-of-year cap</Th>
              </tr>
            </thead>
            <tbody>
              {seasonality.data.like_for_like_yoy.map((row) => (
                <tr key={row.year} className="border-b border-rule">
                  <Td>{row.year}</Td>
                  <Td numeric>{formatGbp(row.va_gbp)}</Td>
                  <Td numeric>{formatGbp(row.revenue_gbp)}</Td>
                  <Td numeric>{formatSignedPct(row.va_yoy_change)}</Td>
                  <Td numeric>{row.day_of_year_cap}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <LoadingState />
        )}
      </Panel>

      <DataQualityPanel summary={summary.data} />
    </div>
  );
}

function DataQualityPanel({ summary }: { summary: Summary }) {
  const q = summary.data_quality;
  const rowsRead = q.rows ?? null;
  const rowsStored = summary.job_count;

  const rows: {
    defect: string;
    sourceRead: string;
    stored: string;
    treatment: string;
  }[] = [
    {
      defect: "Rows ingested",
      sourceRead: `${formatInt(rowsRead)} rows read from source`,
      stored: `${formatInt(rowsStored)} rows stored (after collapsing duplicates)`,
      treatment:
        "Source-read counts include byte-identical duplicates; stored counts are unique job_key rows.",
    },
    {
      defect: "Duplicate category labels",
      sourceRead: `${formatInt(q.product_labels_raw_excluding_null)} raw labels`,
      stored: `${formatInt(q.product_labels_normalised)} normalised`,
      treatment:
        "Five typo/spacing variants collapsed via config lookup. Real product distinctions preserved.",
    },
    {
      defect: "Mixed currency",
      sourceRead: `${formatInt(q.euro_rows_converted)} Euro · ${formatInt(q.stg_rows)} Stg (sum = rows read)`,
      stored: `${formatInt(rowsStored)} jobs after duplicate collapse`,
      treatment: `Converted to GBP at ${summary.fx_eur_to_gbp}; original values retained. Euro + Stg totals the source-read row count.`,
    },
    {
      defect: "Non-positive sell price",
      sourceRead: `${formatInt(q.credits_flagged)} credits flagged in source`,
      stored: `${formatInt(summary.exclusions.credits)} credits among stored jobs`,
      treatment:
        "Flagged is_credit and excluded from value totals, not deleted. Source vs stored differ when a credit row was a duplicate collapse.",
    },
    {
      defect: "Meaningful nulls in Binding Type",
      sourceRead: `${formatInt(q.binding_null_encoded_outsourced)} rows`,
      stored: "Same treatment applied at ingest",
      treatment: "Encoded OUTSOURCED — a null means finishing was outsourced, not missing data.",
    },
    {
      defect: "In-flight jobs",
      sourceRead: `${formatInt(q.open_jobs)} open · ${formatInt(q.closed_jobs)} closed (sum = rows read)`,
      stored: `${formatInt(summary.exclusions.open_jobs)} open among stored jobs`,
      treatment: "Flagged is_closed; historical value analysis uses closed jobs only.",
    },
    {
      defect: "Date anomalies",
      sourceRead: `${formatInt(q.date_anomalies)} rows · ${formatInt(q.missing_sales_out)} missing SalesOut`,
      stored: "Retained",
      treatment: "Flagged has_date_anomaly and retained for audit.",
    },
    {
      defect: "Byte-identical duplicate records",
      sourceRead: `${formatInt(q.duplicates_collapsed)} collapsed at ingest`,
      stored: `${formatInt(rowsStored)} unique job_key rows`,
      treatment:
        "Identity is a SHA-256 hash of all 36 raw columns, so only records identical in every field merge.",
    },
    {
      defect: "Partial year",
      sourceRead: summary.date_range.max_sales_in ?? "—",
      stored: `${formatMonthYear(summary.date_range.min_sales_in)} — ${formatMonthYear(
        summary.date_range.max_sales_in,
      )}`,
      treatment: "All year-on-year comparisons truncated to like-for-like periods.",
    },
  ];

  return (
    <Panel
      title="Data quality"
      note="Every count below is computed from the latest ingestion run, not written by hand. Source-read and stored counts can differ by the duplicates collapsed at ingest — that is intentional, not an arithmetic error."
    >
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Data quality defects found and how each was handled</caption>
        <thead>
          <tr className="border-b border-ink text-left">
            <Th>Defect</Th>
            <Th>Rows read from source</Th>
            <Th>Rows stored</Th>
            <Th>Treatment</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.defect} className="border-b border-rule align-top">
              <Td>{row.defect}</Td>
              <td className="num py-2.5 pr-4 text-left text-[13px] text-ink">{row.sourceRead}</td>
              <td className="num py-2.5 pr-4 text-left text-[13px] text-ink">{row.stored}</td>
              <Td>
                <span className="text-mid">{row.treatment}</span>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[11px] text-mid">
        Last ingest: {summary.last_ingest.source_filename ?? "—"} ·{" "}
        {formatInt(summary.last_ingest.rows_inserted)} inserted ·{" "}
        {formatInt(summary.last_ingest.rows_updated)} updated · KPI strip uses stored job count (
        {formatInt(rowsStored)})
      </p>
    </Panel>
  );
}

