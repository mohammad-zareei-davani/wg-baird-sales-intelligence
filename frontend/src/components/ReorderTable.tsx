import type { ReorderCustomer } from "../api/types";
import { formatCurrency } from "../format";
import { StatusBadge } from "./StatusBadge";

const th = "px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-muted";
const td = "whitespace-nowrap border-t border-line-grid px-2.5 py-2 text-ink-primary";

export function ReorderTable({ rows }: { rows: ReorderCustomer[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className={th}>Customer</th>
            <th className={th}>Orders</th>
            <th className={th}>Cadence</th>
            <th className={th}>Last order</th>
            <th className={th}>Predicted next</th>
            <th className={th}>Predicted value</th>
            <th className={th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.customer_id}>
              <td className={td}>{r.customer_name}</td>
              <td className={td}>{r.order_count}</td>
              <td className={td}>{r.avg_interval_days != null ? `${r.avg_interval_days}d (${r.regularity})` : "—"}</td>
              <td className={td}>{r.last_order_date}</td>
              <td className={td}>
                {r.predicted_next_order_date ?? "—"}
                {r.days_until_predicted != null && (
                  <span className="text-xs text-ink-muted">
                    {" "}
                    ({r.days_until_predicted >= 0 ? `in ${r.days_until_predicted}d` : `${-r.days_until_predicted}d ago`})
                  </span>
                )}
              </td>
              <td className={td}>{r.predicted_next_order_value != null ? formatCurrency(r.predicted_next_order_value) : "—"}</td>
              <td className={td}>
                <StatusBadge status={r.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
