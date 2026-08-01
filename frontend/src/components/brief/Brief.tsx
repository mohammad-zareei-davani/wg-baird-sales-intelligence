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
    <header className="pb-2">
      <div className={`${LABEL} text-accentStrong`}>{eyebrow}</div>
      <h1 className="mt-2.5 font-display text-[32px] font-semibold leading-[1.12] tracking-[-0.02em] text-ink-primary md:text-[36px]">
        {title}
      </h1>
    </header>
  );
}

/* ---------- headline figures ---------- */

export function MetricRow({ metrics }: { metrics: BriefType["metrics"] }) {
  if (!metrics.length) return null;

  return (
    <div className="grid grid-cols-1 gap-6 border-y border-edge py-5 sm:grid-cols-3 sm:gap-0">
      {metrics.map((m, i) => (
        <div
          key={m.label}
          className={`sm:px-6 ${i === 0 ? "sm:pl-0" : ""} ${i === metrics.length - 1 ? "sm:pr-0" : ""} ${
            i ? "sm:border-l sm:border-edge" : ""
          }`}
        >
          <div className={LABEL}>{m.label}</div>
          <div className="tnum mt-2.5 text-[34px] font-semibold leading-none tracking-[-0.03em] text-ink-primary">
            {m.value}
          </div>
          <div className="mt-2 max-w-[28ch] text-[12.5px] leading-snug text-ink-secondary">
            {m.sublabel}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- the finding ---------- */

export function Finding({ hero }: { hero: BriefType["hero"] }) {
  const caption =
    hero.caption?.trim() && hero.caption.trim() !== hero.value.trim()
      ? hero.caption
      : null;

  return (
    <section className="grid gap-6 md:grid-cols-[220px_1fr] md:gap-10">
      <div>
        <div className={LABEL}>Key finding</div>
        <div className="tnum mt-3 text-[44px] font-semibold leading-none tracking-[-0.03em] text-accentStrong">
          {hero.value}
        </div>
        {caption && (
          <div className="mt-2.5 text-[12.5px] leading-snug text-ink-secondary">{caption}</div>
        )}
      </div>
      <p className="max-w-[68ch] border-t border-edge pt-4 text-[15px] leading-[1.7] text-ink-primary md:border-t-0 md:border-l md:pt-0 md:pl-10">
        {hero.body}
      </p>
    </section>
  );
}

/* ---------- breakdown ---------- */

export function BreakdownTable({ breakdown }: { breakdown: BriefType["breakdown"] }) {
  if (!breakdown.rows.length) return null;
  const [c0, c1, c2, c3] = breakdown.columns;

  return (
    <section>
      <h2 className="mb-4 font-display text-[20px] font-semibold tracking-[-0.01em] text-ink-primary">
        {breakdown.title}
      </h2>
      <div className="overflow-x-auto border border-edge bg-raised">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-surface">
              {[c0, c1, c2, c3].map((c, i) => (
                <th
                  key={c ?? i}
                  className={`whitespace-nowrap border-b border-edge px-4 py-3 text-[11px] font-semibold uppercase tracking-label text-ink-muted ${
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
                <td className="whitespace-nowrap px-4 py-3.5 font-medium text-ink-primary">
                  {r.category}
                </td>
                <td className="px-4 py-3.5 text-ink-secondary">{r.description}</td>
                <td className="tnum whitespace-nowrap px-4 py-3.5 text-right font-semibold text-ink-primary">
                  {r.value}
                </td>
                <td className="tnum whitespace-nowrap px-4 py-3.5 text-right text-ink-secondary">
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
      <h2 className="mb-4 font-display text-[20px] font-semibold tracking-[-0.01em] text-ink-primary">
        {actions.title}
      </h2>
      <ol className="divide-y divide-edge border-t border-edge">
        {actions.items.map((a, i) => (
          <li key={a.title} className="flex gap-4 py-4">
            <span className="tnum mt-0.5 w-7 flex-shrink-0 text-[13px] font-semibold text-accent">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="text-[14.5px] font-semibold text-ink-primary">{a.title}</span>
                <span
                  className={`whitespace-nowrap px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${
                    BADGE_TONE[a.tone] ?? "bg-surface text-ink-secondary"
                  }`}
                >
                  {a.badge}
                </span>
              </div>
              <p className="mt-1.5 max-w-[76ch] text-[13.5px] leading-[1.65] text-ink-secondary">
                {a.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
      {actions.footnote && (
        <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">{actions.footnote}</p>
      )}
    </section>
  );
}

/* ---------- composition ---------- */

export function Brief({ brief }: { brief: BriefType }) {
  return (
    <div className="flex flex-col gap-8">
      <MetricRow metrics={brief.metrics} />
      <Finding hero={brief.hero} />
      <BreakdownTable breakdown={brief.breakdown} />
      <ActionList actions={brief.actions} />
    </div>
  );
}

/**
 * Charts sit below the written brief. Spacing and a top rule mark the shift
 * from argument to evidence.
 */
export function SupportingCharts({ children }: { children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5 border-t border-edge pt-8">
      {children}
    </section>
  );
}
