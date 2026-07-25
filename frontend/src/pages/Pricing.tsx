import { useCallback, useMemo, useState, type ReactNode } from "react";
import { getExampleJob, getModelMetrics, getOptions, getPricingVariance, postPredict } from "../api/client";
import { useApiData } from "../api/useApiData";
import { VarianceBars } from "../components/charts/VarianceBars";
import { Panel } from "../components/Panel";
import { PredictionBand } from "../components/PredictionBand";
import { ErrorState, LoadingState } from "../components/States";
import { Td, Th } from "../components/Table";
import { formatGbp, formatInt, formatSignedPct } from "../format";
import type {
  ExampleJobSpec,
  JobSpec,
  ModelMetric,
  OptionsResponse,
  PredictResponse,
  VarianceRow,
} from "../types";

interface PricingProps {
  dataVersion: number;
}

type VarianceDimension = "by_rep" | "by_work_type" | "by_product_group" | "by_customer";

const DIMENSION_LABELS: Record<VarianceDimension, string> = {
  by_rep: "Sales rep",
  by_work_type: "Work type",
  by_product_group: "Product group",
  by_customer: "Customer",
};

export function Pricing({ dataVersion }: PricingProps) {
  const optionsFetcher = useCallback(() => getOptions(), []);
  const metricsFetcher = useCallback(() => getModelMetrics(), []);
  const varianceFetcher = useCallback(() => getPricingVariance(), []);
  const options = useApiData(optionsFetcher, [dataVersion]);
  const metrics = useApiData(metricsFetcher, [dataVersion]);
  const variance = useApiData(varianceFetcher, [dataVersion]);

  const [dimension, setDimension] = useState<VarianceDimension>("by_rep");

  if (options.error) return <ErrorState message={options.error} />;
  if (!options.data) return <LoadingState label="Loading pricing workspace" />;

  const varianceRows: VarianceRow[] = variance.data
    ? [...variance.data[dimension]].sort(
        (a, b) => (a.net_pct_of_revenue ?? 0) - (b.net_pct_of_revenue ?? 0),
      )
    : [];

  return (
    <div className="space-y-12">
      <Panel
        title="Expected value estimator"
        note="One job specification, both models. Enquiry mode answers the question at first contact; estimate mode refines it once the estimating system has produced impressions and press hours."
      >
        <PredictWorkspace
          options={options.data}
          enquiryMetric={metrics.data?.model_a_enquiry ?? null}
          estimateMetric={metrics.data?.model_a_estimate ?? null}
        />
      </Panel>

      <Panel
        title="Pricing variance"
        note={variance.data?.limitation ?? "Loading limitation statement…"}
        actions={
          <div className="flex flex-wrap gap-2" role="group" aria-label="Variance dimension">
            {(Object.keys(DIMENSION_LABELS) as VarianceDimension[]).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={dimension === key}
                onClick={() => setDimension(key)}
                className={`border px-3 py-1.5 font-head text-[10px] font-semibold uppercase tracking-[0.12em] ${
                  dimension === key
                    ? "border-ink bg-ink text-paper"
                    : "border-rule text-mid hover:border-ink hover:text-ink"
                }`}
              >
                {DIMENSION_LABELS[key]}
              </button>
            ))}
          </div>
        }
      >
        {variance.error ? (
          <ErrorState message={variance.error} />
        ) : variance.data ? (
          <>
            <p className="mb-4 text-xs text-mid">
              Ranked by {variance.data.primary_rank}. Absolute discount totals track book size, not
              behaviour, so they are shown but not ranked on.
            </p>
            <VarianceBars
              rows={varianceRows.slice(0, 12)}
              dimensionLabel={DIMENSION_LABELS[dimension]}
            />
            <table className="mt-6 w-full border-collapse text-sm">
              <caption className="sr-only">
                Manual override variance by {DIMENSION_LABELS[dimension]}
              </caption>
              <thead>
                <tr className="border-b border-ink">
                  <Th>{DIMENSION_LABELS[dimension]}</Th>
                  <Th numeric>Net % of own revenue</Th>
                  <Th numeric>Net override</Th>
                  <Th numeric>Discounts</Th>
                  <Th numeric>Discounted jobs</Th>
                  <Th numeric>Avg discount / job</Th>
                  <Th numeric>Mark-ups</Th>
                  <Th numeric>Marked-up jobs</Th>
                  <Th numeric>Own revenue</Th>
                </tr>
              </thead>
              <tbody>
                {varianceRows.map((row) => (
                  <tr key={row.key ?? "unknown"} className="border-b border-rule">
                    <Td>
                      <span className="num text-left">{row.key ?? "—"}</span>
                      {row.customer_name ? (
                        <span className="ml-2 text-mid">{row.customer_name}</span>
                      ) : null}
                    </Td>
                    <Td numeric>
                      <span
                        className={
                          (row.net_pct_of_revenue ?? 0) < 0
                            ? "font-medium text-magenta"
                            : "text-ink"
                        }
                      >
                        {formatSignedPct(row.net_pct_of_revenue)}
                      </span>
                    </Td>
                    <Td numeric>{formatGbp(row.net_override_gbp)}</Td>
                    <Td numeric>{formatGbp(row.negative_override_gbp)}</Td>
                    <Td numeric>{formatInt(row.discounted_job_count)}</Td>
                    <Td numeric>{formatGbp(row.avg_discount_per_discounted_job_gbp)}</Td>
                    <Td numeric>{formatGbp(row.positive_override_gbp)}</Td>
                    <Td numeric>{formatInt(row.marked_up_job_count)}</Td>
                    <Td numeric>{formatGbp(row.revenue_gbp)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <LoadingState label="Loading variance" />
        )}
      </Panel>

      <Panel
        title="Model transparency"
        note="Both scores are reported as measured on the held-out 2026 test window. The weak result is a finding, not a defect to be tuned away."
      >
        {metrics.error ? (
          <ErrorState message={metrics.error} />
        ) : metrics.data ? (
          <>
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Model scores against baselines</caption>
              <thead>
                <tr className="border-b border-ink">
                  <Th>Model</Th>
                  <Th>Mode</Th>
                  <Th>Target</Th>
                  <Th>When it applies</Th>
                  <Th numeric>R²</Th>
                  <Th numeric>MAE</Th>
                  <Th numeric>Baseline R²</Th>
                  <Th numeric>Baseline MAE</Th>
                </tr>
              </thead>
              <tbody>
                {[
                  metrics.data.model_a_enquiry,
                  metrics.data.model_a_estimate,
                  metrics.data.model_b,
                ].map((model) => (
                  <tr key={model.name} className="border-b border-rule align-top">
                    <Td>
                      <span className="font-medium">{model.name}</span>
                    </Td>
                    <Td>
                      <span className="num text-left text-mid">
                        {model.mode ?? "diagnostic"}
                      </span>
                    </Td>
                    <Td>
                      <span className="num text-left">{model.target}</span>
                    </Td>
                    <Td>
                      <span className="text-mid">{model.when}</span>
                    </Td>
                    <Td numeric>{model.r2.toFixed(3)}</Td>
                    <Td numeric>
                      {model.target === "va_pct" ? model.mae.toFixed(3) : formatGbp(model.mae)}
                    </Td>
                    <Td numeric>{model.baseline_r2.toFixed(3)}</Td>
                    <Td numeric>
                      {model.target === "va_pct"
                        ? model.baseline_mae.toFixed(3)
                        : formatGbp(model.baseline_mae)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-5 grid gap-6 border-t border-rule pt-4 md:grid-cols-2">
              <p className="text-sm leading-relaxed text-ink">
                <span className="font-semibold">Model B scores R² {metrics.data.model_b.r2.toFixed(2)}.</span>{" "}
                {metrics.data.model_b.interpretation ??
                  "Job specification, customer and season explain little of achieved margin."}{" "}
                That is the evidence for capturing quote and win/loss data: the information that
                sets margin is not in this dataset.
              </p>
              <p className="text-xs leading-relaxed text-mid">
                Train {formatInt(metrics.data.train_rows)} rows · test{" "}
                {formatInt(metrics.data.test_rows)} rows · split at {metrics.data.cutoff}, closed
                non-credit jobs only. Unseen categories:{" "}
                {metrics.data.unseen_categorical_policy}
              </p>
            </div>
          </>
        ) : (
          <LoadingState label="Loading metrics" />
        )}
      </Panel>
    </div>
  );
}

interface PredictWorkspaceProps {
  options: OptionsResponse;
  enquiryMetric: ModelMetric | null;
  estimateMetric: ModelMetric | null;
}

function jobFromExample(example: ExampleJobSpec): JobSpec {
  const plates =
    example.work_type === "Digital" ? 0 : Number(example.plates) || 0;
  return {
    quantity: Number(example.quantity) || 0,
    plates,
    impressions: Number(example.impressions) || 0,
    press_hrs: Number(example.press_hrs) || 0,
    booking_month: Number(example.booking_month) || 1,
    booking_iso_week: Number(example.booking_iso_week) || 1,
    customer_id: example.customer_id,
    industry: example.industry ?? "",
    region: example.region ?? "",
    work_type: example.work_type,
    product_type_norm: example.product_type_norm,
    product_group: example.product_group ?? "",
    binding_type_filled: example.binding_type_filled || "OUTSOURCED",
    currency: example.currency || "Stg",
  };
}

function fallbackSpec(options: OptionsResponse): JobSpec {
  if (options.default_job) return jobFromExample(options.default_job);
  const customer = options.customers[0];
  const product =
    options.product_types.find((p) => p.product_type_norm === "Educational Books") ??
    options.product_types[0];
  return {
    quantity: 5000,
    plates: 16,
    impressions: 25000,
    press_hrs: 4,
    booking_month: 9,
    booking_iso_week: 36,
    customer_id: customer?.customer_id ?? "",
    industry: customer?.industry ?? options.industries[0] ?? "",
    region: customer?.region ?? options.regions[0] ?? "",
    work_type: "Litho",
    product_type_norm: product?.product_type_norm ?? "",
    product_group: product?.product_group ?? "",
    binding_type_filled: "Saddle",
    currency: "Stg",
  };
}

function PredictWorkspace({ options, enquiryMetric, estimateMetric }: PredictWorkspaceProps) {
  const [spec, setSpec] = useState<JobSpec>(() => fallbackSpec(options));
  const [enquiry, setEnquiry] = useState<PredictResponse | null>(null);
  const [estimate, setEstimate] = useState<PredictResponse | null>(null);
  const [enquiryError, setEnquiryError] = useState<string | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exampleLabel, setExampleLabel] = useState<string | null>(
    options.default_job?.title ?? "Educational Books litho (default)",
  );

  const scaleMax = useMemo(() => {
    const values: number[] = [];
    if (enquiry && enquiryMetric) values.push(enquiry.predicted_va_gbp + enquiryMetric.mae);
    if (estimate && estimateMetric) values.push(estimate.predicted_va_gbp + estimateMetric.mae);
    if (values.length === 0) return 0;
    return Math.max(...values) * 1.1;
  }, [enquiry, estimate, enquiryMetric, estimateMetric]);

  function update<K extends keyof JobSpec>(key: K, value: JobSpec[K]): void {
    setSpec((current) => {
      const next = { ...current, [key]: value };
      if (key === "work_type" && value === "Digital") {
        next.plates = 0;
      }
      return next;
    });
    setFormError(null);
  }

  function validateLocal(job: JobSpec): string | null {
    if (job.work_type === "Digital" && job.plates !== 0) {
      return "Digital jobs carry zero plates throughout this dataset. Set plates to 0 or choose Litho.";
    }
    return null;
  }

  async function loadRandomExample(): Promise<void> {
    setBusy(true);
    setFormError(null);
    try {
      const example = await getExampleJob();
      setSpec(jobFromExample(example));
      setExampleLabel(example.title ?? `${example.product_type_norm} · ${example.customer_id}`);
      setEnquiry(null);
      setEstimate(null);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not load example");
    } finally {
      setBusy(false);
    }
  }

  async function run(): Promise<void> {
    const local = validateLocal(spec);
    if (local) {
      setFormError(local);
      return;
    }
    setBusy(true);
    setFormError(null);
    setEnquiryError(null);
    setEstimateError(null);
    const [enquiryResult, estimateResult] = await Promise.allSettled([
      postPredict(spec, "enquiry"),
      postPredict(spec, "estimate"),
    ]);
    if (enquiryResult.status === "fulfilled") {
      setEnquiry(enquiryResult.value);
    } else {
      setEnquiry(null);
      setEnquiryError(
        enquiryResult.reason instanceof Error ? enquiryResult.reason.message : "Prediction failed",
      );
    }
    if (estimateResult.status === "fulfilled") {
      setEstimate(estimateResult.value);
    } else {
      setEstimate(null);
      setEstimateError(
        estimateResult.reason instanceof Error
          ? estimateResult.reason.message
          : "Prediction failed",
      );
    }
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-mid">
          Prefill:{" "}
          <span className="text-ink">{exampleLabel ?? "Custom specification"}</span>
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void loadRandomExample()}
          className="border border-ink px-3 py-1.5 font-head text-[10px] font-semibold uppercase tracking-[0.14em] hover:bg-ink hover:text-paper disabled:opacity-40"
        >
          Load a real example job
        </button>
      </div>

      <form
        className="grid gap-x-6 gap-y-4 md:grid-cols-3 xl:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          void run();
        }}
      >
        <Select
          label="CustomerID"
          value={spec.customer_id}
          options={options.customers.map((c) => ({
            value: c.customer_id,
            label: `${c.customer_id} · ${c.customer_name ?? "—"}`,
          }))}
          onChange={(value) => {
            const customer = options.customers.find((c) => c.customer_id === value);
            setSpec((current) => ({
              ...current,
              customer_id: value,
              industry: customer?.industry ?? current.industry,
              region: customer?.region ?? current.region,
            }));
          }}
        />
        <Select
          label="Product type (granular)"
          value={spec.product_type_norm}
          options={options.product_types.map((p) => ({
            value: p.product_type_norm,
            label: p.product_type_norm,
          }))}
          onChange={(value) => {
            const product = options.product_types.find((p) => p.product_type_norm === value);
            setSpec((current) => ({
              ...current,
              product_type_norm: value,
              product_group: product?.product_group ?? current.product_group,
            }));
          }}
        />
        <Field label="Product group (derived)">
          <span className="num block border border-rule bg-white/50 px-2 py-1.5 text-left text-[13px] text-mid">
            {spec.product_group || "—"}
          </span>
        </Field>
        <Select
          label="Work type"
          value={spec.work_type}
          options={options.work_types.map((v) => ({ value: v, label: v }))}
          onChange={(value) => update("work_type", value)}
        />
        <Select
          label="Binding type"
          value={spec.binding_type_filled}
          options={options.binding_types.map((v) => ({ value: v, label: v }))}
          onChange={(value) => update("binding_type_filled", value)}
        />
        <Select
          label="Region"
          value={spec.region}
          options={options.regions.map((v) => ({ value: v, label: v }))}
          onChange={(value) => update("region", value)}
        />
        <Select
          label="Industry"
          value={spec.industry}
          options={options.industries.map((v) => ({ value: v, label: v }))}
          onChange={(value) => update("industry", value)}
        />
        <Select
          label="Currency"
          value={spec.currency}
          options={options.currencies.map((v) => ({ value: v, label: v }))}
          onChange={(value) => update("currency", value)}
        />
        <NumberField label="Quantity" value={spec.quantity} onChange={(v) => update("quantity", v)} />
        <NumberField
          label={spec.work_type === "Digital" ? "Plates (must be 0 for Digital)" : "Plates"}
          value={spec.plates}
          onChange={(v) => update("plates", v)}
        />
        <NumberField
          label="Booking month"
          value={spec.booking_month}
          min={1}
          max={12}
          onChange={(v) => update("booking_month", v)}
        />
        <NumberField
          label="Booking ISO week"
          value={spec.booking_iso_week}
          min={1}
          max={53}
          onChange={(v) => update("booking_iso_week", v)}
        />
        <NumberField
          label="Impressions (estimate only)"
          value={spec.impressions ?? 0}
          onChange={(v) => update("impressions", v)}
        />
        <NumberField
          label="Press hours (estimate only)"
          value={spec.press_hrs ?? 0}
          step={0.1}
          onChange={(v) => update("press_hrs", v)}
        />
        <div className="flex items-end md:col-span-2">
          <button
            type="submit"
            disabled={busy}
            className="border border-ink px-5 py-2 font-head text-[11px] font-semibold uppercase tracking-[0.14em] hover:bg-ink hover:text-paper disabled:opacity-40"
          >
            {busy ? "Running…" : "Run both modes"}
          </button>
        </div>
      </form>

      {formError ? (
        <p role="alert" className="border-l-2 border-magenta pl-3 text-sm text-ink">
          {formError}
        </p>
      ) : null}

      <p className="text-xs text-mid">
        Impressions and press hours are submitted to estimate mode only. Plates must be zero when
        work type is Digital — that rule is enforced by the API as well as this form.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <PredictionBand
          label="Indicative, at enquiry"
          caption="First contact. Quantity, plates, product, customer and season only."
          prediction={enquiry}
          metric={enquiryMetric}
          scaleMax={scaleMax}
          error={enquiryError}
          emphasis="indicative"
        />
        <PredictionBand
          label="Refined, post estimate"
          caption="After estimating. Adds impressions and press hours from the production estimate."
          prediction={estimate}
          metric={estimateMetric}
          scaleMax={scaleMax}
          error={estimateError}
          emphasis="refined"
        />
      </div>

      {enquiry && estimate ? (
        <p className="border-l-2 border-ink pl-3 text-sm text-ink">
          Difference between modes:{" "}
          <span className="num">
            {formatGbp(Math.abs(estimate.predicted_va_gbp - enquiry.predicted_va_gbp))}
          </span>
          . Across the test window the two agree closely (correlation 0.951, median difference
          £146) but diverge by more than 60% on about one job in ten, which is why enquiry mode is
          presented as a range.
        </p>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="font-head text-[10px] font-semibold uppercase tracking-[0.14em] text-mid">
        {label}
      </span>
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="font-head text-[10px] font-semibold uppercase tracking-[0.14em] text-mid">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full border border-ink bg-paper px-2 py-1.5 font-mono text-[13px] text-ink"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="font-head text-[10px] font-semibold uppercase tracking-[0.14em] text-mid">
        {label}
      </span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(event.target.valueAsNumber)}
        className="num mt-1.5 w-full border border-ink bg-paper px-2 py-1.5 text-[13px] text-ink"
      />
    </label>
  );
}
