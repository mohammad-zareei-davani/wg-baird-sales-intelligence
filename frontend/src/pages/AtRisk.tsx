import { useCallback } from "react";
import { getAtRisk } from "../api/client";
import { useApiData } from "../api/useApiData";
import { Panel } from "../components/Panel";
import { ErrorState, LoadingState } from "../components/States";
import { Td, Th } from "../components/Table";
import { formatDate, formatGbp, formatInt, formatNumber } from "../format";
import type { DormancyCustomer } from "../types";

interface AtRiskProps {
  dataVersion: number;
}

export function AtRisk({ dataVersion }: AtRiskProps) {
  const fetcher = useCallback(() => getAtRisk(), []);
  const { data, error } = useApiData(fetcher, [dataVersion]);

  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState label="Loading dormancy analysis" />;

  const recovery = data.recovery ?? data.dormant ?? [];
  const monitor = data.monitor ?? data.watch ?? [];
  const recoveryCount = data.recovery_count ?? data.dormant_count ?? recovery.length;
  const monitorCount = data.monitor_count ?? data.watch_count ?? monitor.length;
  const progression = data.cid_045_progression;

  return (
    <div className="space-y-12">
      <div className="flex flex-wrap items-start gap-x-12 gap-y-6 border-y border-ink py-6">
        <Metric label="Recovery — act now" value={formatInt(recoveryCount)} lead />
        <Metric label="Monitor — review monthly" value={formatInt(monitorCount)} lead />
        <Metric
          label="Annualised run-rate VA (recovery)"
          value={formatGbp(data.annualised_exposure_gbp)}
          lead
        />
        <Metric label="Measured as of" value={formatDate(data.as_of)} />
        <Metric
          label="Lifetime VA of flagged accounts"
          value={formatGbp(data.lifetime_va_of_flagged_gbp)}
        />
        <Metric label="Median CV" value={formatNumber(data.median_cv, 2)} />
      </div>

      <Panel
        title="Action tiers, not state labels"
        note="Accounts are ranked by cycles missed — days since last order divided by that customer's own median inter-order gap — with absolute day floors so frequent orderers are not flagged on ordinary short silences. A board can act on five and monitor fifteen; it cannot act on an undifferentiated list of twenty-seven."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <TierCard
            name="Recovery"
            action="Act now"
            rule="cycles missed > 6 and days since last order > 90"
            sortNote="Sorted by annualised run-rate VA"
            count={recoveryCount}
            tone="risk"
          />
          <TierCard
            name="Monitor"
            action="Review monthly"
            rule="cycles missed between 3 and 6, and days since last order > 30"
            sortNote="Sorted by lifetime VA descending"
            count={monitorCount}
            tone="caution"
          />
        </div>
        <p className="mt-5 text-sm leading-relaxed text-ink">
          The day floor on Monitor stops accounts such as CID_002 (3.3 cycles on only 10 days of
          silence) from entering the list. Without it, the second-largest book would demand
          attention for ordinary fortnightly cadence.
        </p>
        <p className="mt-3 border-l-2 border-ochre pl-3 text-sm text-ink">
          {data.seasonal_note} Measured as of {formatDate(data.as_of)}.
        </p>
        <p className="mt-3 text-[11px] text-mid">
          Order events collapse same-day closed non-credit jobs:{" "}
          {formatInt(data.order_event_count)} events, {formatInt(data.gap_count)} gaps. Regular
          cadence (CV &lt; 1.0): {formatInt(data.cadence_regular_gap8_count)} of{" "}
          {formatInt(data.eligible_gap8_count)} eligible accounts.
        </p>
      </Panel>

      {progression ? (
        <Panel
          title="Worked example — CID_045 / CUST_047"
          note="Direct evidence that cycles_missed detects drift before it becomes obvious."
        >
          <div className="grid gap-6 md:grid-cols-2">
            <div className="border-l-2 border-rule pl-3">
              <p className="font-head text-[10px] font-semibold uppercase tracking-[0.14em] text-mid">
                As of 23 Dec 2025
              </p>
              <p className="num mt-2 text-left text-2xl text-ink">
                {formatNumber(progression.as_of_2025_12_23.cycles_missed, 1)} cycles
              </p>
              <p className="mt-1 font-head text-[11px] font-semibold uppercase tracking-[0.12em] text-mid">
                {progression.as_of_2025_12_23.tier}
              </p>
              <p className="mt-2 text-xs text-mid">{progression.as_of_2025_12_23.note}</p>
            </div>
            <div className="border-l-2 border-magenta pl-3">
              <p className="font-head text-[10px] font-semibold uppercase tracking-[0.14em] text-mid">
                As of 21 May 2026
              </p>
              <p className="num mt-2 text-left text-2xl text-magenta">
                {formatNumber(progression.as_of_2026_05_21.cycles_missed, 1)} cycles
              </p>
              <p className="mt-1 font-head text-[11px] font-semibold uppercase tracking-[0.12em] text-magenta">
                {progression.as_of_2026_05_21.tier}
              </p>
              <p className="mt-2 text-xs text-mid">{progression.as_of_2026_05_21.note}</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-ink">
            Between the December history cutoff and the May 2026 as-of date the same account moved
            from inside the normal band to firmly in Recovery. That progression is the value
            proposition of this page: the metric surfaces drift while there is still time to act.
          </p>
        </Panel>
      ) : null}

      <Panel
        title="Recovery — act now"
        note="Sorted by annualised run-rate VA (value added over the 12 months ending at each customer's last order). Lifetime VA is shown for context, never as exposure."
      >
        {recovery.length === 0 ? (
          <p className="text-sm text-mid">No accounts currently in Recovery.</p>
        ) : (
          <FlaggedTable rows={recovery} />
        )}
      </Panel>

      <Panel
        title="Monitor — review monthly"
        note="No immediate action. Sorted by lifetime VA descending so the largest drifting accounts surface first."
      >
        {monitor.length === 0 ? (
          <p className="text-sm text-mid">No accounts currently in Monitor.</p>
        ) : (
          <FlaggedTable rows={monitor} />
        )}
      </Panel>
    </div>
  );
}

function FlaggedTable({ rows }: { rows: DormancyCustomer[] }) {
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">Flagged customers by action tier</caption>
      <thead>
        <tr className="border-b border-ink">
          <Th>Tier</Th>
          <Th>CustomerID</Th>
          <Th>Customer Name</Th>
          <Th>Cadence</Th>
          <Th numeric>Cycles missed</Th>
          <Th numeric>Days since</Th>
          <Th numeric>Median gap</Th>
          <Th numeric>Annualised VA</Th>
          <Th numeric>Lifetime VA</Th>
          <Th numeric>Last order</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.customer_id} className="border-b border-rule">
            <Td>
              <TierBadge tier={row.tier} />
            </Td>
            <Td>
              <span className="num text-left">{row.customer_id}</span>
            </Td>
            <Td>
              <span className="text-mid">{row.customer_name ?? "—"}</span>
            </Td>
            <Td>
              <CadenceBadge customer={row} />
            </Td>
            <Td numeric>
              <span className="font-medium">{formatNumber(row.cycles_missed, 1)}</span>
            </Td>
            <Td numeric>{formatInt(row.days_since_last_order)}</Td>
            <Td numeric>{formatNumber(row.median_gap_days, 1)}</Td>
            <Td numeric>{formatGbp(row.annualised_va_gbp)}</Td>
            <Td numeric>{formatGbp(row.lifetime_va_gbp)}</Td>
            <Td numeric>{formatDate(row.last_order)}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TierCard({
  name,
  action,
  rule,
  sortNote,
  count,
  tone,
}: {
  name: string;
  action: string;
  rule: string;
  sortNote: string;
  count: number;
  tone: "risk" | "caution";
}) {
  const colour = tone === "risk" ? "border-magenta" : "border-ochre";
  return (
    <div className={`border-l-2 ${colour} pl-3`}>
      <p className="font-head text-[10px] font-semibold uppercase tracking-[0.16em] text-mid">
        {name}
      </p>
      <p className="num mt-1 text-left text-2xl text-ink">{formatInt(count)}</p>
      <p className="mt-1 font-head text-[11px] font-semibold uppercase tracking-[0.12em] text-ink">
        {action}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-mid">{rule}</p>
      <p className="mt-1 text-[11px] text-mid">{sortNote}</p>
    </div>
  );
}

function TierBadge({ tier }: { tier: DormancyCustomer["tier"] }) {
  const styles =
    tier === "RECOVERY"
      ? "border-magenta text-magenta"
      : tier === "MONITOR"
        ? "border-ochre text-ochre"
        : "border-mid text-mid";
  return (
    <span
      className={`inline-block border px-2 py-0.5 font-head text-[10px] font-semibold uppercase tracking-[0.12em] ${styles}`}
    >
      {tier}
    </span>
  );
}

function CadenceBadge({ customer }: { customer: DormancyCustomer }) {
  const regular = customer.cadence_regular;
  return (
    <span
      className={`inline-block border px-2 py-0.5 font-head text-[10px] font-semibold uppercase tracking-[0.12em] ${
        regular ? "border-cyan text-cyan" : "border-mid text-mid"
      }`}
    >
      {regular ? "Regular" : "Erratic"}
    </span>
  );
}

function Metric({ label, value, lead = false }: { label: string; value: string; lead?: boolean }) {
  return (
    <div>
      <p className="font-head text-[10px] font-semibold uppercase tracking-[0.16em] text-mid">
        {label}
      </p>
      <p className={`num mt-2 whitespace-nowrap text-left ${lead ? "text-2xl" : "text-lg"} text-ink`}>
        {value}
      </p>
    </div>
  );
}
