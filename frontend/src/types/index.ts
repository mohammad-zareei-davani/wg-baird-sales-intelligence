/** Response shapes for every endpoint. Must match the DRF payloads exactly. */

export interface DataQualityCounts {
  rows: number;
  product_labels_raw_excluding_null: number;
  product_labels_raw_including_null: number;
  product_labels_normalised: number;
  product_groups: number;
  binding_null_encoded_outsourced: number;
  euro_rows_converted: number;
  stg_rows: number;
  credits_flagged: number;
  closed_jobs: number;
  open_jobs: number;
  date_anomalies: number;
  missing_sales_out: number;
  duplicates_collapsed: number;
}

export interface IngestRunSummary {
  id: number | null;
  created_at: string | null;
  source_filename: string | null;
  rows_read: number | null;
  rows_inserted: number | null;
  rows_updated: number | null;
}

export interface Summary {
  total_va_gbp: number;
  total_revenue_gbp: number;
  job_count: number;
  customer_count: number;
  date_range: {
    min_sales_in: string | null;
    max_sales_in: string | null;
  };
  last_ingest: IngestRunSummary;
  data_quality: Partial<DataQualityCounts>;
  exclusions: { credits: number; open_jobs: number };
  fx_eur_to_gbp: number;
}

export interface CustomerValueRow {
  customer_id: string;
  customer_name: string | null;
  total_va_gbp: number;
  total_revenue_gbp: number;
  job_count: number;
  va_per_job: number;
  mean_va_per_24: number | null;
  median_va_pct: number | null;
  first_order: string;
  last_order: string;
  industry: string | null;
  region: string | null;
  primary_rep: string | null;
  cost_to_serve_index: number | null;
}

export interface ConcentrationPoint {
  rank: number;
  customer_id: string;
  customer_name: string | null;
  value: number;
  cumulative_share: number;
}

export interface VolumeValuePoint {
  customer_id: string;
  customer_name: string | null;
  job_count: number;
  total_va_gbp: number;
  total_revenue_gbp: number;
  va_per_job: number;
  cost_to_serve_index: number | null;
}

export interface ValueExclusions {
  excluded_credits: number;
  excluded_open_jobs: number;
  rows_included: number;
  rows_total: number;
}

export interface CustomersResponse {
  customers: CustomerValueRow[];
  concentration: { va: ConcentrationPoint[]; revenue: ConcentrationPoint[] };
  volume_vs_value: VolumeValuePoint[];
  exclusions: ValueExclusions;
  portfolio_median_va_per_job: number;
  cost_to_serve_min_jobs: number;
}

export interface DormancyCustomer {
  customer_id: string;
  customer_name: string | null;
  order_events: number;
  gap_count: number;
  median_gap_days: number | null;
  std_gap_days: number | null;
  cv: number | null;
  threshold_days: number | null;
  percentile: number;
  last_order: string;
  days_since_last_order: number;
  days_overdue: number | null;
  cycles_missed: number | null;
  tier: "RECOVERY" | "MONITOR" | "NORMAL";
  at_risk: boolean;
  cadence_regular: boolean;
  lifetime_va_gbp: number;
  annualised_va_gbp: number;
}

export interface Cid045Progression {
  customer_id: string;
  customer_name: string;
  as_of_2025_12_23: { cycles_missed: number; tier: string; note: string };
  as_of_2026_05_21: { cycles_missed: number; tier: string; note: string };
}

export interface AtRiskResponse {
  as_of: string;
  order_event_count: number;
  gap_count: number;
  median_gap_days: number | null;
  median_cv: number | null;
  customers: DormancyCustomer[];
  at_risk: DormancyCustomer[];
  recovery: DormancyCustomer[];
  monitor: DormancyCustomer[];
  recovery_count: number;
  monitor_count: number;
  dormant?: DormancyCustomer[];
  watch?: DormancyCustomer[];
  dormant_count?: number;
  watch_count?: number;
  annualised_exposure_gbp: number;
  lifetime_va_of_flagged_gbp: number;
  seasonal_note: string;
  cid_045_progression: Cid045Progression;
  eligible_gap8_count: number;
  cadence_regular_gap8_count: number;
}

export interface ProductMixRow {
  product_type_norm: string | null;
  product_group: string | null;
  job_count: number;
  va_gbp: number;
  revenue_gbp: number;
}

export interface OrderHistoryRow {
  title: string;
  sales_in: string;
  product_type_norm: string | null;
  product_group: string | null;
  quantity: number | null;
  sell_price_gbp: number | null;
  va_amount_gbp: number | null;
  va_pct: number | null;
  work_type: string | null;
  rep: string | null;
}

export interface CustomerDetail {
  customer_id: string;
  customer_name: string | null;
  summary: CustomerValueRow | null;
  gap_statistics: DormancyCustomer | null;
  product_mix: ProductMixRow[];
  order_history: OrderHistoryRow[];
}

export interface MonthlyPoint {
  year: number;
  month: number;
  year_month: string;
  va_gbp: number;
  revenue_gbp: number;
  job_count: number;
}

export interface BreakdownPoint {
  dimension: string;
  value: string | null;
  year_month: string;
  va_gbp: number;
  revenue_gbp: number;
}

export interface YoyPoint {
  year: number;
  va_gbp: number;
  revenue_gbp: number;
  day_of_year_cap: number;
  va_yoy_change: number | null;
}

export interface SeasonalityResponse {
  monthly: MonthlyPoint[];
  by_industry: BreakdownPoint[];
  by_product_type: BreakdownPoint[];
  by_product_group: BreakdownPoint[];
  like_for_like_yoy: YoyPoint[];
  exclusions: { excluded_credits: number; excluded_open_jobs: number };
}

export interface VarianceRow {
  key: string | null;
  negative_override_gbp: number;
  discounted_job_count: number;
  positive_override_gbp: number;
  marked_up_job_count: number;
  net_override_gbp: number;
  revenue_gbp: number;
  net_pct_of_revenue: number | null;
  avg_discount_per_discounted_job_gbp: number | null;
  customer_id?: string;
  customer_name?: string | null;
}

export interface OverrideVsVaBin {
  override_bin: string;
  count: number;
  mean_va_pct: number | null;
  median_va_pct: number | null;
  negative_override_gbp: number;
}

export interface PricingVarianceResponse {
  limitation: string;
  primary_rank: string;
  by_rep: VarianceRow[];
  by_work_type: VarianceRow[];
  by_product_group: VarianceRow[];
  by_product_type: VarianceRow[];
  by_customer: VarianceRow[];
  net_negative_reps: VarianceRow[];
  override_vs_va_pct: OverrideVsVaBin[];
}

export type PredictMode = "enquiry" | "estimate";

export interface ShapContribution {
  feature: string;
  label: string;
  shap_value: number;
}

export interface PredictResponse {
  mode: PredictMode;
  when: string;
  predicted_va_gbp: number;
  shap_contributions: ShapContribution[];
}

export interface JobSpec {
  quantity: number;
  plates: number;
  booking_month: number;
  booking_iso_week: number;
  customer_id: string;
  industry: string;
  region: string;
  work_type: string;
  product_type_norm: string;
  product_group: string;
  binding_type_filled: string;
  currency: string;
  impressions?: number;
  press_hrs?: number;
}

export interface ModelMetric {
  name: string;
  mode: PredictMode | null;
  when: string;
  target: string;
  features: string[];
  r2: number;
  mae: number;
  baseline_r2: number;
  baseline_mae: number;
  baseline: string;
  interpretation?: string;
}

export interface ModelMetricsResponse {
  cutoff: string;
  train_rows: number;
  test_rows: number;
  categorical_features: string[];
  unseen_categorical_policy: string;
  model_a_estimate: ModelMetric;
  model_a_enquiry: ModelMetric;
  model_b: ModelMetric;
}

export interface IngestResponse {
  id: number;
  created_at: string;
  source_filename: string;
  rows_read: number;
  rows_inserted: number;
  rows_updated: number;
  quality_counts: Partial<DataQualityCounts>;
  job_count: number;
}

export interface ExampleJobSpec {
  customer_id: string;
  customer_name: string | null;
  industry: string | null;
  region: string | null;
  work_type: string;
  product_type_norm: string;
  product_group: string | null;
  binding_type_filled: string;
  currency: string;
  quantity: number;
  plates: number;
  impressions: number;
  press_hrs: number;
  booking_month: number;
  booking_iso_week: number;
  title?: string | null;
}

export interface OptionsResponse {
  work_types: string[];
  binding_types: string[];
  currencies: string[];
  regions: string[];
  industries: string[];
  product_groups: string[];
  product_types: { product_type_norm: string; product_group: string | null }[];
  customers: {
    customer_id: string;
    customer_name: string | null;
    industry: string | null;
    region: string | null;
  }[];
  default_job: ExampleJobSpec | null;
}

export interface CustomerMapResponse {
  pairs: { customer_id: string; customer_name: string | null }[];
  count: number;
  note: string;
}
