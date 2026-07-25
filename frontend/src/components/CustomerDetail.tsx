import { useCallback, useEffect, useMemo, useRef } from "react";
import { getCustomerDetail } from "../api/client";
import { useApiData } from "../api/useApiData";
import { formatDate, formatGbp, formatInt, formatNumber, formatPct } from "../format";
import { palette } from "../theme";
import { Td, Th } from "./Table";
import { RegistrationMark } from "./RegistrationMark";
import { ErrorState, LoadingState } from "./States";

interface CustomerDetailProps {
  customerId: string;
  dataVersion: number;
  onClose: () => void;
}

export function CustomerDetail({ customerId, dataVersion, onClose }: CustomerDetailProps) {
  const fetcher = useCallback(() => getCustomerDetail(customerId), [customerId]);
  const { data, error } = useApiData(fetcher, [customerId, dataVersion]);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent): void {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /** Charted mix uses product_group; product_type_norm stays in the drill-down. */
  const groupMix = useMemo(() => {
    if (!data) return [];
    const totals = new Map<string, { va: number; jobs: number }>();
    for (const row of data.product_mix) {
      const key = row.product_group ?? "Unclassified";
      const current = totals.get(key) ?? { va: 0, jobs: 0 };
      totals.set(key, { va: current.va + row.va_gbp, jobs: current.jobs + row.job_count });
    }
    const list = [...totals.entries()].map(([group, value]) => ({ group, ...value }));
    list.sort((a, b) => b.va - a.va);
    return list;
  }, [data]);

  const maxGroupVa = groupMix[0]?.va ?? 0;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/20" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Customer detail ${customerId}`}
        className="fade-in h-full w-full max-w-3xl overflow-y-auto border-l border-ink bg-paper px-8 py-6"
      >
        <div className="mb-6 flex items-start justify-between gap-6 border-b border-ink pb-4">
          <div>
            <h2 className="flex items-center gap-2 font-head text-[13px] font-semibold uppercase tracking-[0.14em]">
              <RegistrationMark />
              Customer detail
            </h2>
            <p className="num mt-2 text-left text-2xl text-ink">{customerId}</p>
            <p className="text-sm text-mid">{data?.customer_name ?? ""}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="border border-ink px-3 py-1.5 font-head text-[10px] font-semibold uppercase tracking-[0.14em] hover:bg-ink hover:text-paper"
          >
            Close
          </button>
        </div>

        {error ? <ErrorState message={error} /> : null}
        {!data && !error ? <LoadingState label="Loading account" /> : null}

        {data ? (
          <div className="space-y-8">
            {data.summary ? (
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
                <Small label="Total VA" value={formatGbp(data.summary.total_va_gbp)} />
                <Small label="Revenue" value={formatGbp(data.summary.total_revenue_gbp)} />
                <Small label="Jobs" value={formatInt(data.summary.job_count)} />
                <Small label="VA / job" value={formatGbp(data.summary.va_per_job)} />
                <Small label="Median VA%" value={formatPct(data.summary.median_va_pct)} />
                <Small label="First order" value={formatDate(data.summary.first_order)} />
                <Small label="Last order" value={formatDate(data.summary.last_order)} />
                <Small label="Primary rep" value={data.summary.primary_rep ?? "—"} />
                <Small
                  label="Cost-to-serve"
                  value={
                    data.summary.cost_to_serve_index === null
                      ? "—"
                      : formatNumber(data.summary.cost_to_serve_index, 2)
                  }
                />
              </div>
            ) : null}

            {data.gap_statistics ? (
              <div className="border-t border-rule pt-4">
                <h3 className="font-head text-[11px] font-semibold uppercase tracking-[0.14em] text-mid">
                  Ordering cadence
                </h3>
                <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
                  <Small
                    label="Median gap"
                    value={`${formatNumber(data.gap_statistics.median_gap_days, 0)} d`}
                  />
                  <Small label="CV" value={formatNumber(data.gap_statistics.cv, 2)} />
                  <Small
                    label="Own threshold"
                    value={`${formatNumber(data.gap_statistics.threshold_days, 1)} d`}
                  />
                  <Small
                    label="Days since last"
                    value={formatInt(data.gap_statistics.days_since_last_order)}
                    tone={data.gap_statistics.at_risk ? "risk" : "normal"}
                  />
                </div>
              </div>
            ) : null}

            <div className="border-t border-rule pt-4">
              <h3 className="font-head text-[11px] font-semibold uppercase tracking-[0.14em] text-mid">
                Product mix by group
              </h3>
              <ul className="mt-3 space-y-2">
                {groupMix.map((entry) => (
                  <li key={entry.group} className="grid grid-cols-[9rem_1fr_5.5rem] items-center gap-3">
                    <span className="text-[13px] text-ink">{entry.group}</span>
                    <span className="block h-2 bg-rule">
                      <span
                        className="block h-2"
                        style={{
                          width: maxGroupVa > 0 ? `${(entry.va / maxGroupVa) * 100}%` : "0%",
                          backgroundColor: palette.cyan,
                        }}
                      />
                    </span>
                    <span className="num text-[13px]">{formatGbp(entry.va)}</span>
                  </li>
                ))}
              </ul>

              <details className="mt-4">
                <summary className="cursor-pointer font-head text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan">
                  Drill down to granular product type
                </summary>
                <table className="mt-3 w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-ink">
                      <Th>Product type (granular)</Th>
                      <Th>Group</Th>
                      <Th numeric>Jobs</Th>
                      <Th numeric>VA</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.product_mix.map((row) => (
                      <tr
                        key={`${row.product_type_norm ?? "null"}-${row.product_group ?? "null"}`}
                        className="border-b border-rule"
                      >
                        <Td>{row.product_type_norm ?? "—"}</Td>
                        <Td>
                          <span className="text-mid">{row.product_group ?? "—"}</span>
                        </Td>
                        <Td numeric>{formatInt(row.job_count)}</Td>
                        <Td numeric>{formatGbp(row.va_gbp)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </div>

            <div className="border-t border-rule pt-4">
              <h3 className="font-head text-[11px] font-semibold uppercase tracking-[0.14em] text-mid">
                Recent order history
              </h3>
              <table className="mt-3 w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-ink">
                    <Th numeric>Booked</Th>
                    <Th>Title</Th>
                    <Th>Product type</Th>
                    <Th numeric>Qty</Th>
                    <Th numeric>Sell price</Th>
                    <Th numeric>VA</Th>
                    <Th numeric>VA%</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.order_history.slice(0, 40).map((row, index) => (
                    <tr key={`${row.title}-${row.sales_in}-${index}`} className="border-b border-rule">
                      <Td numeric>{formatDate(row.sales_in)}</Td>
                      <Td>{row.title}</Td>
                      <Td>
                        <span className="text-mid">{row.product_type_norm ?? "—"}</span>
                      </Td>
                      <Td numeric>{formatInt(row.quantity)}</Td>
                      <Td numeric>{formatGbp(row.sell_price_gbp)}</Td>
                      <Td numeric>{formatGbp(row.va_amount_gbp)}</Td>
                      <Td numeric>{formatPct(row.va_pct)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Small({
  label,
  value,
  tone = "normal",
}: {
  label: string;
  value: string;
  tone?: "normal" | "risk";
}) {
  return (
    <div>
      <p className="font-head text-[9px] font-semibold uppercase tracking-[0.16em] text-mid">
        {label}
      </p>
      <p className={`num mt-1 text-left text-[15px] ${tone === "risk" ? "text-magenta" : "text-ink"}`}>
        {value}
      </p>
    </div>
  );
}
