import { useCallback, useMemo, useState } from "react";
import { getCustomers } from "../api/client";
import { useApiData } from "../api/useApiData";
import { ConcentrationCurve } from "../components/charts/ConcentrationCurve";
import { VolumeValueScatter } from "../components/charts/VolumeValueScatter";
import { CustomerDetail } from "../components/CustomerDetail";
import { Panel } from "../components/Panel";
import { ErrorState, LoadingState } from "../components/States";
import { Td, Th } from "../components/Table";
import { formatDate, formatGbp, formatInt, formatNumber, formatPct } from "../format";
import type { CustomerValueRow } from "../types";

type SortKey =
  | "customer_id"
  | "total_va_gbp"
  | "total_revenue_gbp"
  | "job_count"
  | "va_per_job"
  | "median_va_pct"
  | "last_order";

interface CustomersProps {
  dataVersion: number;
}

export function Customers({ dataVersion }: CustomersProps) {
  const fetcher = useCallback(() => getCustomers(), []);
  const { data, error } = useApiData(fetcher, [dataVersion]);
  const [sortKey, setSortKey] = useState<SortKey>("total_va_gbp");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<string | null>(null);

  const rows = useMemo(() => {
    if (!data) return [];
    const copy = [...data.customers];
    copy.sort((a, b) => compare(a, b, sortKey, direction));
    return copy;
  }, [data, sortKey, direction]);

  /**
   * The instructive pair is two accounts of comparable size that reach it by
   * opposite routes, so candidates are restricted to the top 20 by revenue and
   * the extremes of VA per job are labelled.
   */
  const outliers = useMemo(() => {
    if (!data) return [];
    const material = [...data.volume_vs_value]
      .sort((a, b) => b.total_revenue_gbp - a.total_revenue_gbp)
      .slice(0, 20);
    if (material.length < 2) return material.map((point) => point.customer_id);
    const lowest = material.reduce((best, point) =>
      point.va_per_job < best.va_per_job ? point : best,
    );
    const highest = material.reduce((best, point) =>
      point.va_per_job > best.va_per_job ? point : best,
    );
    return [lowest.customer_id, highest.customer_id];
  }, [data]);

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState label="Loading customer value" />;

  const top3 = data.concentration.va[2]?.cumulative_share ?? null;
  const top12 = data.concentration.va[11]?.cumulative_share ?? null;

  function handleSort(key: string): void {
    const next = key as SortKey;
    if (next === sortKey) {
      setDirection((current) => (current === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(next);
      setDirection(next === "customer_id" ? "asc" : "desc");
    }
  }

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-2 gap-x-8 gap-y-6 border-y border-ink py-6 md:grid-cols-4">
        <Metric label="Customers" value={formatInt(data.customers.length)} />
        <Metric label="Top 3 VA share" value={formatPct(top3)} lead />
        <Metric label="Top 12 VA share" value={formatPct(top12)} lead />
        <Metric
          label="Rows excluded from value"
          value={`${formatInt(data.exclusions.excluded_credits)} credits · ${formatInt(
            data.exclusions.excluded_open_jobs,
          )} open`}
        />
      </div>

      <Panel
        title="Revenue concentration"
        note="Cumulative share of value added by customer rank. The steepness of the left-hand section is the dependency risk."
      >
        <ConcentrationCurve va={data.concentration.va} revenue={data.concentration.revenue} />
      </Panel>

      <Panel
        title="Volume versus value"
        note="Job count against total VA. The two labelled customers sit among the twenty largest by revenue yet reach that position by opposite routes — one through hundreds of small jobs, the other through a handful of large ones. They demand different service models."
      >
        <VolumeValueScatter points={data.volume_vs_value} labelled={outliers} />
        <p className="mt-2 text-[11px] text-mid">
          Labelled:{" "}
          {outliers
            .map((id) => {
              const point = data.volume_vs_value.find((p) => p.customer_id === id);
              return point
                ? `${point.customer_id} / ${point.customer_name ?? "—"} — ${formatInt(
                    point.job_count,
                  )} jobs, ${formatGbp(point.total_revenue_gbp)} revenue, ${formatGbp(
                    point.va_per_job,
                  )} VA per job`
                : id;
            })
            .join(" · ")}
        </p>
        <p className="mt-1 text-[11px] text-mid">
          Portfolio median VA per job (accounts with ≥{formatInt(data.cost_to_serve_min_jobs)}{" "}
          jobs):{" "}
          <span className="num text-ink">{formatGbp(data.portfolio_median_va_per_job)}</span>.
          Cost-to-serve index = customer VA per job ÷ that median; shown as a dash below the
          minimum job count.
        </p>
      </Panel>

      <Panel
        title="Customer value table"
        note="Grouped on CustomerID; Customer Name is a display label only. Select a row for the full account view."
      >
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Customers by value added, sortable</caption>
          <thead>
            <tr className="border-b border-ink">
              <Th sortKey="customer_id" activeSort={sortKey} direction={direction} onSort={handleSort}>
                CustomerID
              </Th>
              <Th>Customer Name</Th>
              <Th>Industry</Th>
              <Th numeric sortKey="total_va_gbp" activeSort={sortKey} direction={direction} onSort={handleSort}>
                Total VA
              </Th>
              <Th numeric sortKey="total_revenue_gbp" activeSort={sortKey} direction={direction} onSort={handleSort}>
                Revenue
              </Th>
              <Th numeric sortKey="job_count" activeSort={sortKey} direction={direction} onSort={handleSort}>
                Jobs
              </Th>
              <Th numeric sortKey="va_per_job" activeSort={sortKey} direction={direction} onSort={handleSort}>
                VA / job
              </Th>
              <Th numeric sortKey="median_va_pct" activeSort={sortKey} direction={direction} onSort={handleSort}>
                Median VA%
              </Th>
              <Th numeric>Cost-to-serve</Th>
              <Th numeric sortKey="last_order" activeSort={sortKey} direction={direction} onSort={handleSort}>
                Last order
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.customer_id}
                tabIndex={0}
                role="button"
                aria-label={`Open detail for ${row.customer_id}`}
                onClick={() => setSelected(row.customer_id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelected(row.customer_id);
                  }
                }}
                className="cursor-pointer border-b border-rule hover:bg-white/70"
              >
                <Td>
                  <span className="num text-left">{row.customer_id}</span>
                </Td>
                <Td>
                  <span className="text-mid">{row.customer_name ?? "—"}</span>
                </Td>
                <Td>
                  <span className="text-mid">{row.industry ?? "—"}</span>
                </Td>
                <Td numeric>{formatGbp(row.total_va_gbp)}</Td>
                <Td numeric>{formatGbp(row.total_revenue_gbp)}</Td>
                <Td numeric>{formatInt(row.job_count)}</Td>
                <Td numeric>{formatGbp(row.va_per_job)}</Td>
                <Td numeric>{formatPct(row.median_va_pct)}</Td>
                <Td numeric>
                  {row.cost_to_serve_index === null ? "—" : formatNumber(row.cost_to_serve_index, 2)}
                </Td>
                <Td numeric>{formatDate(row.last_order)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {selected ? (
        <CustomerDetail
          customerId={selected}
          dataVersion={dataVersion}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}

function compare(
  a: CustomerValueRow,
  b: CustomerValueRow,
  key: SortKey,
  direction: "asc" | "desc",
): number {
  const sign = direction === "desc" ? -1 : 1;
  const left = a[key];
  const right = b[key];
  if (typeof left === "number" && typeof right === "number") return sign * (left - right);
  if (left === null) return 1;
  if (right === null) return -1;
  return sign * String(left).localeCompare(String(right));
}

function Metric({ label, value, lead = false }: { label: string; value: string; lead?: boolean }) {
  return (
    <div>
      <p className="font-head text-[10px] font-semibold uppercase tracking-[0.16em] text-mid">
        {label}
      </p>
      <p className={`num mt-2 text-left ${lead ? "text-2xl" : "text-lg"} text-ink`}>{value}</p>
    </div>
  );
}
