import type { ReactNode } from "react";

/**
 * Highlights commercially important tokens in briefing prose: money,
 * percentages, multipliers, compact counts, account IDs, and written-out
 * counts (Nineteen, twenty-two). Everything else stays plain so the emphasis
 * stays sparse.
 *
 * Capturing group is intentional: String.split keeps the matched tokens as
 * their own entries, so odd indices are the figures to bold.
 */
const EMPHASIS =
  /(£[\d,]+(?:\.\d+)?\s?[MmKk]?|€[\d,]+(?:\.\d+)?\s?[MmKk]?|\d[\d,]*(?:\.\d+)?%|\d+(?:\.\d+)?\s?[×x]|CUST_\d+|\b\d{1,3}(?:,\d{3})+\b|\b\d{1,3}\b|\b(?:(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:-(?:one|two|three|four|five|six|seven|eight|nine))?|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|hundred|thousand|million)\b)/gi;

export function EmphasizedText({ text }: { text: string }): ReactNode {
  return text.split(EMPHASIS).map((part, i) => {
    if (!part) return null;
    if (i % 2 === 1) {
      return (
        <strong key={i} className="tnum font-semibold text-ink-primary">
          {part}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
