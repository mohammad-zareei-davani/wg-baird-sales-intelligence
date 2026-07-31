import type { ReactNode } from "react";
import type { Brief as BriefType } from "../../api/types";

/**
 * The shared anatomy of every insight page.
 *
 * The visual hierarchy is deliberate: figures carry the most weight, the
 * finding reads as a lead paragraph, and the supporting tables and charts sit
 * quieter beneath. Structure comes from spacing, rules and type scale rather
 * than from wrapping everything in a card, which flattens hierarchy and makes
 * every block look equally important.
 */

const LABEL = "text-[11px] font-semibold uppercase tracking-label text-ink-muted";

const BADGE_TONE: Record<string, string> = {
  free: "bg-status-goodBg text-status-goodText",
  low: "bg-accentSoft text-accentStrong",
  value: "bg-status-warningBg text-status-warningText",
  watch: "bg-status-seriousBg text-status-seriousText",
};

/* ---------- page heading ---------- */

export function PageTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header className="pb-1">
      <div className="text-[11px] font-semibold uppercase tracking-label text-accentStrong">
        {eyebrow}
      </div>
      <h1 className="mt-2 text-[28px] font-semibold leading-[1.15] tracking-[-0.015em] text-ink-primary">
        {title}
      </h1>
    </header>
  );
}

/* ---------- headline figures ---------- */

export function MetricRow({ metrics }: { metrics: BriefType["metrics"] }) {
  if (!metrics.length) return null;

  return (
    <div className="grid grid-cols-1 divide-y divide-edge overflow-hidden rounded-lg border border-edge bg-surface shadow-card sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      {metrics.map((m) => (
        <div key={m.label} className="px-5 py-4">
          <div className={LABEL}>{m.label}</div>
          <div className="tnum mt-2 text-[30px] font-semibold leading-none tracking-[-0.02em] text-ink-primary">
            {m.value}
          </div>
          <div className="mt-1.5 text-[12.5px] leading-snug text-ink-secondary">{m.sublabel}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- the finding ---------- */

export function Finding({ hero }: { hero: BriefType["hero"] }) {
  return (
    <section className="rounded-lg border border-edge bg-surface shadow-card">
      <div className="border-b border-edge px-5 py-2.5">
        <span className={LABEL}>Key finding</span>
      </div>
      <div className="grid gap-5 px-5 py-5 md:grid-cols-[200px_1fr] md:gap-8">
        <div>
          <div className="tnum text-[38px] font-semibold leading-none tracking-[-0.025em] text-accentStrong">
            {hero.value}
          </div>
          <div className="mt-2 text-[12.5px] leading-snug text-ink-secondary">{hero.caption}</div>
        </div>
        <p className="max-w-[68ch] text-[14.5px] leading-[1.65] text-ink-primary">{hero.body}</p>
      </div>
    </section>
  );
}

/* ---------- breakdown ---------- */

export function BreakdownTable({ breakdown }: { breakdown: BriefType["breakdown"] }) {
  if (!breakdown.rows.length) return null;
  const [c0, c1, c2, c3] = breakdown.columns;

  return (
    <section>
      <h2 className="mb-3 text-[15px] font-semibold text-ink-primary">{breakdown.title}</h2>
      <div className="overflow-x-auto rounded-lg border border-edge bg-surface shadow-card">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-page/60">
              {[c0, c1, c2, c3].map((c, i) => (
                <th
                  key={c ?? i}
                  className={`whitespace-nowrap border-b border-edge px-4 py-2.5 text-[11px] font-semibold uppercase tracking-label text-ink-muted ${
                    i >= 2 ? "text-right" : "text-left"
                  }`}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {breakdown.rows.map((r, i) => (
              <tr key={r.category} className={i ? "border-t border-edge" : ""}>
                <td className="whitespace-nowrap px-4 py-3 font-medium text-ink-primary">
                  {r.category}
                </td>
                <td className="px-4 py-3 text-ink-secondary">{r.description}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-ink-primary">
                  {r.value}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-ink-secondary">
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

/* ---------- actions ---------- */

export function ActionList({ actions }: { actions: BriefType["actions"] }) {
  if (!actions.items.length) return null;

  return (
    <section>
      <h2 className="mb-3 text-[15px] font-semibold text-ink-primary">{actions.title}</h2>
      <ol className="overflow-hidden rounded-lg border border-edge bg-surface shadow-card">
        {actions.items.map((a, i) => (
          <li
            key={a.title}
            className={`flex gap-4 px-5 py-4 ${i ? "border-t border-edge" : ""}`}
          >
            <span className="tnum mt-[3px] w-6 flex-shrink-0 text-[13px] font-semibold text-ink-muted">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="text-[14px] font-semibold text-ink-primary">{a.title}</span>
                <span
                  className={`whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-semibold ${
                    BADGE_TONE[a.tone] ?? "bg-page text-ink-secondary"
                  }`}
                >
                  {a.badge}
                </span>
              </div>
              <p className="mt-1.5 max-w-[76ch] text-[13px] leading-[1.65] text-ink-secondary">
                {a.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
      {actions.footnote && (
        <p className="mt-2.5 text-[12px] leading-relaxed text-ink-muted">{actions.footnote}</p>
      )}
    </section>
  );
}

/* ---------- composition ---------- */

export function Brief({ brief }: { brief: BriefType }) {
  return (
    <>
      <MetricRow metrics={brief.metrics} />
      <Finding hero={brief.hero} />
      <BreakdownTable breakdown={brief.breakdown} />
      <ActionList actions={brief.actions} />
    </>
  );
}

/**
 * Charts sit below the written brief. The rule and label mark the shift from
 * argument to evidence, so a reader who only wants the conclusion can stop.
 */
export function SupportingCharts({ children }: { children: ReactNode }) {
  return (
    <section className="mt-3 flex flex-col gap-5 border-t border-edge pt-6">
      <h2 className={LABEL}>Supporting detail</h2>
      {children}
    </section>
  );
}
