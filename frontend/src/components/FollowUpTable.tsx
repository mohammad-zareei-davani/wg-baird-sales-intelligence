import type { ChurnCustomer } from "../api/types";
import { formatCurrency } from "../format";
import { StatusBadge } from "./StatusBadge";

const th = "whitespace-nowrap border-b border-edge px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-label text-ink-muted";
const td = "whitespace-nowrap border-t border-edge px-4 py-2.5 text-ink-primary";

export function FollowUpTable({ rows }: { rows: ChurnCustomer[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className={th}>Customer</th>
            <th className={th}>Industry</th>
            <th className={th}>Rep</th>
            <th className={th}>Days since order</th>
            <th className={th}>Lifetime VA</th>
            <th className={th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.customer_id}>
              <td className={td}>{r.customer_name}</td>
              <td className={td}>{r.industry}</td>
              <td className={td}>{r.rep}</td>
              <td className={td}>{r.days_since_last_order}</td>
              <td className={td}>{formatCurrency(r.lifetime_va_amount)}</td>
              <td className={td}>
                <StatusBadge status={r.status} />
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="border-t border-edge px-4 py-6 text-center text-ink-muted">
                No at-risk or dormant customers. Every account ordered within its normal cadence.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
