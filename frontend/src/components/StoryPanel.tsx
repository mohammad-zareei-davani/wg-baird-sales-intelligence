import type { Story } from "../api/types";

/**
 * The business-language reading of an insight. Every analysis page leads
 * with this rather than with a chart, so the commercial point lands before
 * any interpretation is required of the reader.
 */
export function StoryPanel({ story }: { story: Story }) {
  return (
    <section className="rounded-xl border border-black/10 bg-raised p-5">
      <p className="text-[17px] font-semibold leading-snug text-ink-primary">{story.headline}</p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
            What this means
          </h3>
          <p className="text-[13px] leading-relaxed text-ink-secondary">{story.what_it_means}</p>
        </div>
        <div className="rounded-lg border-l-[3px] border-l-series-1 bg-page p-3.5">
          <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
            Recommended action
          </h3>
          <p className="text-[13px] leading-relaxed text-ink-secondary">{story.recommended_action}</p>
        </div>
      </div>
    </section>
  );
}

/** Compact variant for the overview page, where several stories sit together. */
export function StoryHeadline({ headline }: { headline: string }) {
  return <p className="text-[13px] leading-relaxed text-ink-secondary">{headline}</p>;
}
