import { useLoadedDashboardData } from "../data/DashboardDataContext";
import { Panel } from "../components/Panel";
import {
  ActionList,
  Finding,
  MetricRow,
  PageTitle,
} from "../components/brief/Brief";
import { ChurnStatusChart } from "../components/charts/ChurnStatusChart";
import { FollowUpTable } from "../components/FollowUpTable";
import { STATUS } from "../theme/colors";

const STATUS_ACCENT: Record<string, string> = {
  Active: STATUS.good,
  "At risk": STATUS.warning,
  "At Risk": STATUS.warning,
  Dormant: STATUS.critical,
};

const PRIORITY_TONE: Record<string, string> = {
  None: "text-ink-muted",
  "Contact this week": "text-status-warningText",
  "Win-back campaign": "text-status-criticalText",
};

export function ChurnPage() {
  const { churn } = useLoadedDashboardData();
  const { brief } = churn;
  const { breakdown } = brief;

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-8">
      <PageTitle eyebrow="Account Retention" title={brief.title} />
      <MetricRow metrics={brief.metrics} />
      <Finding hero={brief.hero} />

      <section>
        <h2 className="mb-1 font-display text-[20px] font-semibold tracking-[-0.01em] text-ink-primary">
          {breakdown.title}
        </h2>
        <p className="mb-6 max-w-[64ch] text-[13px] leading-relaxed text-ink-secondary">
          Each account is judged against its own ordering rhythm, not a fixed calendar.
        </p>

        <div className="grid grid-cols-1 items-center gap-8 border-y border-edge py-6 lg:grid-cols-[1fr_240px] lg:gap-10">
          <div className="divide-y divide-edge">
            {breakdown.rows.map((r) => {
              const accent = STATUS_ACCENT[r.category] ?? STATUS.good;
              const priorityClass = PRIORITY_TONE[r.share] ?? "text-ink-muted";

              return (
                <div key={r.category} className="flex gap-4 py-5 first:pt-0 last:pb-0">
                  <div
                    className="mt-1 w-[3px] flex-shrink-0 self-stretch rounded-full"
                    style={{ background: accent }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <div className="text-[15px] font-semibold text-ink-primary">{r.category}</div>
                      <div className="tnum text-[28px] font-semibold leading-none tracking-[-0.03em] text-ink-primary">
                        {r.value}
                      </div>
                    </div>
                    <p className="mt-1.5 max-w-[48ch] text-[13px] leading-snug text-ink-secondary">
                      {r.description}
                    </p>
                    <div className={`mt-2 text-[11px] font-semibold uppercase tracking-wide ${priorityClass}`}>
                      {r.share === "None" ? "No action needed" : r.share}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <ChurnStatusChart counts={churn.status_counts} showLegend={false} />
        </div>
      </section>

      <Panel
        title="Follow-up list"
        subtitle="At risk means silence of 1.25–2.5× that account's usual gap between orders; dormant means beyond 2.5×. Ranked by lifetime value so the highest-value relationships come first."
      >
        <FollowUpTable rows={churn.follow_up_opportunities} />
      </Panel>

      <ActionList actions={brief.actions} />
    </div>
  );
}
