import { useLoadedDashboardData } from "../data/DashboardDataContext";
import { Panel } from "../components/Panel";
import { Brief, PageTitle, SupportingCharts } from "../components/brief/Brief";
import { formatCurrency, formatNumber } from "../format";

const th = "whitespace-nowrap border-b border-edge px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-label text-ink-muted";
const td = "whitespace-nowrap border-t border-edge px-4 py-2.5 text-ink-primary";

export function QuoteGuardPage() {
  const { quoteGuard } = useLoadedDashboardData();

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-8">
      <PageTitle eyebrow="Quote Intelligence" title={quoteGuard.brief.title} />
      <Brief brief={quoteGuard.brief} />

      {quoteGuard.available && (
        <SupportingCharts>
          <Panel
            title="What the model looks at"
            subtitle="Value added, markup and the manual price adjustment are deliberately excluded, because they are consequences of the pricing decision, not inputs to it. Including them would let the model reconstruct the answer and report an accuracy it has not earned."
          >
            <div className="flex flex-wrap gap-1.5">
              {(quoteGuard.features_used ?? []).map((f) => (
                <span key={f} className="border border-edge bg-surface px-2.5 py-1 text-[11px] text-ink-secondary">
                  {f}
                </span>
              ))}
            </div>
          </Panel>

          <Panel
            title="Jobs sold well below the going rate"
            subtitle="Held-out jobs where the achieved price fell furthest short of what comparable work commanded"
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th className={th}>Job</th>
                    <th className={th}>Customer</th>
                    <th className={th}>Product</th>
                    <th className={th}>Quantity</th>
                    <th className={th}>Sold for</th>
                    <th className={th}>Comparable work</th>
                    <th className={th}>Shortfall</th>
                  </tr>
                </thead>
                <tbody>
                  {(quoteGuard.flagged_jobs ?? []).map((j, i) => (
                    <tr key={`${j.job_id}-${i}`}>
                      <td className={td}>{j.job_id}</td>
                      <td className={td}>{j.customer_name}</td>
                      <td className={td}>{j.product_type}</td>
                      <td className={td}>{formatNumber(j.quantity)}</td>
                      <td className={td}>{formatCurrency(j.actual_price)}</td>
                      <td className={td}>{formatCurrency(j.expected_price)}</td>
                      <td className={`${td} font-semibold text-status-criticalText`}>
                        {formatCurrency(j.gap)} ({j.gap_pct.toFixed(0)}%)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </SupportingCharts>
      )}
    </div>
  );
}
