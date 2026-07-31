import type { Brief as BriefType } from "../../api/types";

/**
 * The standard shape of every insight page: three headline figures, one hero
 * number with a short read, a breakdown where each row explains itself, and
 * numbered actions tagged with what they cost. Charts follow underneath as
 * supporting evidence.
 */

const BADGE_TONE: Record<string, string> = {
  free: "bg-status-goodBg text-status-goodText",
  low: "bg-accentSoft text-series-1",
  value: "bg-status-warningBg text-status-warningText",
  watch: "bg-status-seriousBg text-status-seriousText",
};

export function MetricRow({ metrics }: { metrics: BriefType["metrics"] }) {
  if (!metrics.length) return null;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {metrics.map((m) => (
        <div key={m.label} className="rounded-xl border border-edge/10 bg-raised px-5 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            {m.label}
          </div>
          <div className="mt-1.5 text-[28px] font-bold leading-none tabular-nums text-ink-primary">
            {m.value}
          </div>
          <div className="mt-1.5 text-xs text-ink-secondary">{m.sublabel}</div>
        </div>
      ))}
    </div>
  );
}

export function Hero({ hero }: { hero: BriefType["hero"] }) {
  return (
    <section className="rounded-xl border border-edge/10 bg-raised p-6">
      <div className="grid gap-6 md:grid-cols-[minmax(180px,240px)_1fr] md:items-center">
        <div className="border-l-4 border-l-series-1 pl-5">
          <div className="text-[40px] font-bold leading-none tabular-nums text-ink-primary">
            {hero.value}
          </div>
          <div className="mt-2 text-[13px] leading-snug text-ink-secondary">{hero.caption}</div>
        </div>
        <p className="text-[15px] leading-relaxed text-ink-primary">{hero.body}</p>
      </div>
    </section>
  );
}

export function BreakdownTable({ breakdown }: { breakdown: BriefType["breakdown"] }) {
  if (!breakdown.rows.length) return null;
  const [c0, c1, c2, c3] = breakdown.columns;

  return (
    <section className="rounded-xl border border-edge/10 bg-surface p-5">
      <h2 className="mb-3.5 text-base font-semibold">{breakdown.title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {[c0, c1, c2, c3].map((c, i) => (
                <th
                  key={c ?? i}
                  className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-muted ${
                    i >= 2 ? "text-right" : "text-left"
                  }`}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {breakdown.rows.map((r) => (
              <tr key={r.category}>
                <td className="border-t border-line-grid px-3 py-2.5 font-semibold text-ink-primary">
                  {r.category}
                </td>
                <td className="border-t border-line-grid px-3 py-2.5 text-ink-secondary">
                  {r.description}
                </td>
                <td className="whitespace-nowrap border-t border-line-grid px-3 py-2.5 text-right font-semibold tabular-nums text-ink-primary">
                  {r.value}
                </td>
                <td className="whitespace-nowrap border-t border-line-grid px-3 py-2.5 text-right tabular-nums text-ink-secondary">
                  {r.share}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ActionList({ actions }: { actions: BriefType["actions"] }) {
  if (!actions.items.length) return null;

  return (
    <section className="rounded-xl border border-edge/10 bg-surface p-5">
      <h2 className="mb-4 text-base font-semibold">{actions.title}</h2>
      <ol className="flex flex-col gap-4">
        {actions.items.map((a, i) => (
          <li key={a.title} className="flex gap-4">
            <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-series-1 text-[13px] font-bold text-white">
              {i + 1}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-[14px] font-semibold text-ink-primary">{a.title}</span>
                <span
                  className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    BADGE_TONE[a.tone] ?? "bg-page text-ink-secondary"
                  }`}
                >
                  {a.badge}
                </span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">{a.body}</p>
            </div>
          </li>
        ))}
      </ol>
      {actions.footnote && (
        <p className="mt-4 border-t border-line-grid pt-3 text-[12px] leading-relaxed text-ink-muted">
          {actions.footnote}
        </p>
      )}
    </section>
  );
}

/** Renders a complete brief — the four blocks in their standard order. */
export function Brief({ brief }: { brief: BriefType }) {
  return (
    <>
      <MetricRow metrics={brief.metrics} />
      <Hero hero={brief.hero} />
      <BreakdownTable breakdown={brief.breakdown} />
      <ActionList actions={brief.actions} />
    </>
  );
}

/** Heading block used at the top of every page. */
export function PageTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-series-1">{eyebrow}</div>
      <h1 className="mt-1.5 text-[26px] font-bold leading-tight">{title}</h1>
    </div>
  );
}

/** Wrapper for the charts that sit below the brief. */
export function SupportingCharts({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-5">
      <h2 className="border-t border-line-grid pt-5 text-base font-semibold text-ink-primary">
        Supporting detail
      </h2>
      {children}
    </section>
  );
}
