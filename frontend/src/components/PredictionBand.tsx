import { formatGbp } from "../format";
import { palette } from "../theme";
import type { ModelMetric, PredictResponse } from "../types";
import { ShapBars } from "./charts/ShapBars";

interface PredictionBandProps {
  label: string;
  caption: string;
  prediction: PredictResponse | null;
  metric: ModelMetric | null;
  /** Shared scale across both panels so the two bands are visually comparable. */
  scaleMax: number;
  error: string | null;
  emphasis: "indicative" | "refined";
}

/**
 * Enquiry mode is shown as a range, never a single figure: the two modes
 * diverge on roughly one job in ten, so a hard number would overstate what
 * the enquiry-stage model knows. The band is the model's own test MAE.
 */
export function PredictionBand({
  label,
  caption,
  prediction,
  metric,
  scaleMax,
  error,
  emphasis,
}: PredictionBandProps) {
  const accent = emphasis === "indicative" ? palette.ochre : palette.cyan;

  if (error) {
    return (
      <div className="border border-rule p-4">
        <Head label={label} caption={caption} accent={accent} />
        <p role="alert" className="mt-4 border-l-2 border-magenta pl-3 text-sm">
          {error}
        </p>
      </div>
    );
  }

  if (!prediction || !metric) {
    return (
      <div className="border border-rule p-4">
        <Head label={label} caption={caption} accent={accent} />
        <p className="mt-4 text-xs uppercase tracking-[0.14em] text-mid">Awaiting run</p>
      </div>
    );
  }

  const band = metric.mae;
  const low = prediction.predicted_va_gbp - band;
  const high = prediction.predicted_va_gbp + band;
  const scale = scaleMax > 0 ? scaleMax : 1;
  const left = Math.max(0, (low / scale) * 100);
  const width = Math.max(1, ((high - Math.max(low, 0)) / scale) * 100);

  return (
    <div className="fade-in border border-rule p-4">
      <Head label={label} caption={caption} accent={accent} />

      <p className="num mt-4 text-left text-3xl font-medium text-ink">
        {formatGbp(low)} – {formatGbp(high)}
      </p>
      <p className="mt-1 text-xs text-mid">
        Midpoint <span className="num text-ink">{formatGbp(prediction.predicted_va_gbp)}</span> ±{" "}
        <span className="num text-ink">{formatGbp(band)}</span> (model test MAE)
      </p>

      <div className="mt-4" aria-hidden="true">
        <div className="relative h-3 w-full bg-rule">
          <div
            className="absolute h-3"
            style={{ left: `${left}%`, width: `${width}%`, backgroundColor: accent }}
          />
        </div>
        <div className="num mt-1 flex justify-between text-[10px] text-mid">
          <span>{formatGbp(0)}</span>
          <span>{formatGbp(scale)}</span>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-rule pt-3 text-xs">
        <dt className="text-mid">Model</dt>
        <dd className="num text-left text-ink">{metric.name}</dd>
        <dt className="text-mid">Test R²</dt>
        <dd className="num text-left text-ink">{metric.r2.toFixed(3)}</dd>
        <dt className="text-mid">Test MAE</dt>
        <dd className="num text-left text-ink">{formatGbp(metric.mae)}</dd>
        <dt className="text-mid">Baseline MAE</dt>
        <dd className="num text-left text-ink">{formatGbp(metric.baseline_mae)}</dd>
      </dl>

      <div className="mt-4 border-t border-rule pt-3">
        <p className="font-head text-[10px] font-semibold uppercase tracking-[0.14em] text-mid">
          Why this figure
        </p>
        <ShapBars contributions={prediction.shap_contributions} />
      </div>
    </div>
  );
}

function Head({
  label,
  caption,
  accent,
}: {
  label: string;
  caption: string;
  accent: string;
}) {
  return (
    <div>
      <p
        className="font-head text-[11px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: accent }}
      >
        {label}
      </p>
      <p className="mt-1 text-xs text-mid">{caption}</p>
    </div>
  );
}
