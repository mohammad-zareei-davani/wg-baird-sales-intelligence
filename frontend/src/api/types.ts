export interface BriefMetric {
  label: string;
  value: string;
  sublabel: string;
}

export interface BriefRow {
  category: string;
  description: string;
  value: string;
  share: string;
}

export interface BriefAction {
  title: string;
  badge: string;
  tone: "free" | "low" | "value" | "watch";
  body: string;
}

export interface Brief {
  title: string;
  /** "template" or "model:<name>". Figures are computed either way. */
  generated_by?: string;
  /** Present when generated text was rejected and the template was used. */
  generation_note?: string;
  metrics: BriefMetric[];
  hero: { value: string; caption: string; body: string };
  breakdown: { title: string; columns: string[]; rows: BriefRow[] };
  actions: { title: string; items: BriefAction[]; footnote?: string };
}

export interface CurrencySplit {
  currency: string;
  job_count: number;
  sell_price_native: number;
  sell_price_base: number;
}

export interface Summary {
  row_count: number;
  customer_count: number;
  total_sell_price: number;
  total_va_amount: number;
  avg_va_pct: number;
  naive_mixed_total: number;
  currency_split: CurrencySplit[];
  date_range: { from: string; to: string };
  base_currency: string;
  base_currency_symbol: string;
  eur_to_gbp: number;
  source: string;
  narrative_generated: boolean;
  brief: Brief;
}

/* ---------- Customer value ---------- */

export interface TopCustomer {
  customer_id: string;
  customer_name: string;
  total_sell_price: number;
  total_va_amount: number;
  total_quantity: number;
  job_count: number;
  avg_va_pct: number;
  last_order: string;
  first_order: string;
  industry: string;
  region: string;
  rep: string;
  top_work_type: string;
  value_share_pct: number;
}

export interface WorkTypeBreakdown {
  work_type: string;
  total_va_amount: number;
  total_sell_price: number;
  job_count: number;
  avg_va_pct: number;
}

export interface ProductBreakdown {
  product_type: string;
  total_va_amount: number;
  total_sell_price: number;
  job_count: number;
  avg_va_pct: number;
}

export interface IndustryBreakdown {
  industry: string;
  total_va_amount: number;
  job_count: number;
  customer_count: number;
}

export interface CustomerValueResponse {
  top_customers: TopCustomer[];
  work_type_breakdown: WorkTypeBreakdown[];
  product_breakdown: ProductBreakdown[];
  industry_breakdown: IndustryBreakdown[];
  concentration: {
    customer_count: number;
    customers_for_80pct_value: number;
    pct_of_customers_for_80pct_value: number;
    top_customer_name: string | null;
    top_customer_share_pct: number;
    top_5_share_pct: number;
    /** Groups derived from the distribution rather than a fixed cut-off. */
    leading_count: number;
    leading_names: string[];
    leading_share_pct: number;
    tied_count: number;
    tied_names: string[];
    tied_spread_pct: number;
    ahead_count: number;
    ahead_share_pct: number;
    break_drop_pct: number;
    flattens_at_rank: number | null;
    next_after_leading_share_pct: number;
    next_after_leading_name: string | null;
    mean_va: number;
    first_tail_vs_mean: number | null;
  };
  brief: Brief;
}

/* ---------- Reorder ---------- */

export type ReorderStatus = "Overdue" | "Due soon" | "On track" | "Insufficient history";

export interface ReorderCustomer {
  customer_id: string;
  customer_name: string;
  order_count: number;
  avg_interval_days: number | null;
  regularity: string;
  last_order_date: string;
  predicted_next_order_date: string | null;
  days_until_predicted: number | null;
  avg_order_value: number;
  predicted_next_order_value: number | null;
  status: ReorderStatus;
}

export interface ReorderResponse {
  customers: ReorderCustomer[];
  summary: {
    predictable_customers: number;
    overdue_count: number;
    due_soon_count: number;
    expected_value_next_30_days: number;
  };
  brief: Brief;
}

/* ---------- Churn (rules) ---------- */

export type ChurnStatus = "Active" | "At Risk" | "Dormant";

export interface ChurnCustomer {
  customer_id: string;
  customer_name: string;
  industry: string;
  region: string;
  rep: string;
  order_count: number;
  last_order_date: string;
  days_since_last_order: number;
  avg_interval_days: number | null;
  basis: "relative" | "absolute";
  status: ChurnStatus;
  lifetime_va_amount: number;
  lifetime_sell_price: number;
}

export interface ChurnResponse {
  customers: ChurnCustomer[];
  follow_up_opportunities: ChurnCustomer[];
  status_counts: Record<ChurnStatus, number>;
  dormant_lifetime_value_at_stake: number;
  brief: Brief;
}

/* ---------- Pricing ---------- */

export interface DiscountByCustomer {
  customer_name: string;
  discount_total: number;
  discounted_jobs: number;
  sell_total: number;
  all_jobs: number;
  discount_as_pct_of_sales: number;
}

export interface DiscountBucket {
  name: string;
  discount_total: number;
  discounted_jobs: number;
  all_jobs: number;
  sell_total: number;
  discount_as_pct_of_sales: number;
}

export interface BelowCostCustomer {
  customer_name: string;
  job_count: number;
  va_amount: number;
  sell_price: number;
}

export interface PricingResponse {
  summary: {
    total_jobs: number;
    overridden_jobs: number;
    overridden_pct: number;
    discounted_jobs: number;
    uplifted_jobs: number;
    discount_total: number;
    uplift_total: number;
    net_adjustment: number;
    discount_as_pct_of_sales: number;
    below_cost_jobs: number;
    below_cost_va: number;
    low_margin_jobs: number;
    low_margin_pct: number;
    low_margin_sell_value: number;
    worst_below_cost_customer: string | null;
    worst_below_cost_share_pct: number;
    top_discount_customer: string | null;
    top_discount_amount: number;
  };
  discount_by_customer: DiscountByCustomer[];
  discount_by_rep: DiscountBucket[];
  discount_by_work_type: DiscountBucket[];
  below_cost_by_customer: BelowCostCustomer[];
  brief: Brief;
}

/* ---------- Seasonality ---------- */

export interface MonthlyRow {
  month_start: string;
  sell_price: number;
  va_amount: number;
  press_hours: number;
  impressions: number;
  job_count: number;
}

export interface SeasonalIndexRow {
  month_num: number;
  month_name: string;
  avg_value: number;
  seasonal_index: number;
}

export interface ForecastRow {
  month_start: string;
  forecast: number;
}

export interface SeasonalityResponse {
  monthly: MonthlyRow[];
  sales_seasonal_index: SeasonalIndexRow[];
  press_seasonal_index: SeasonalIndexRow[];
  sales_forecast: ForecastRow[];
  press_forecast: ForecastRow[];
  peak_month_mix: { industry: string; sell_price: number }[];
  summary: {
    peak_month: string;
    peak_index: number;
    trough_month: string;
    trough_index: number;
    peak_to_trough_ratio: number | null;
    sales_forecast_mape: number | null;
    press_forecast_mape: number | null;
    forecast_horizon_months: number;
    press_hours_peak_month: number;
    press_hours_recent_avg: number;
    forecast_next_month_sales: number | null;
    forecast_next_month_press: number | null;
  };
  brief: Brief;
}

/* ---------- Delivery ---------- */

export interface DeliveryByWorkType {
  work_type: string;
  job_count: number;
  median_days: number;
  mean_days: number;
  p90_days: number;
}

export interface DeliveryByProduct {
  product_type: string;
  job_count: number;
  median_days: number;
  p90_days: number;
  sell_price: number;
}

export interface DeliveryResponse {
  summary: {
    jobs_measured: number;
    coverage_pct: number;
    median_days: number;
    mean_days: number;
    p90_days: number;
    fastest_work_type: string;
    fastest_median_days: number;
    slowest_work_type: string;
    slowest_median_days: number;
    recent_vs_prior_days: number;
    direction: string;
  };
  by_work_type: DeliveryByWorkType[];
  by_product: DeliveryByProduct[];
  monthly_trend: { month_start: string; median_days: number; job_count: number }[];
  slowest_jobs: {
    job_id: string;
    customer_name: string;
    product_type: string;
    work_type: string;
    lead_time_days: number;
    days_over_product_norm: number;
    sell_price: number;
  }[];
  brief: Brief;
}

/* ---------- Repeat business ---------- */

export interface RepeatTitle {
  customer_id: string;
  customer_name: string;
  job_id: string;
  print_runs: number;
  first_run: string;
  last_run: string;
  total_sell: number;
  total_va: number;
  total_quantity: number;
  product_type: string;
  avg_cycle_days: number;
  days_since_last_run: number;
  cycles_overdue: number;
  avg_value_per_run: number;
}

export interface RepeatBusinessResponse {
  summary: {
    distinct_titles: number;
    repeat_titles: number;
    one_off_titles: number;
    repeat_title_pct: number;
    repeat_revenue: number;
    repeat_revenue_pct: number;
    avg_runs_per_repeat_title: number;
    max_runs: number;
    titles_due_reprint: number;
    reprint_pipeline_value: number;
  };
  due_for_reprint: RepeatTitle[];
  top_repeat_titles: RepeatTitle[];
  by_product: { product_type: string; titles: number; total_sell: number; runs: number }[];
  brief: Brief;
}

/* ---------- ML: Quote Guard ---------- */

export interface QuoteGuardResponse {
  available: boolean;
  reason?: string;
  metrics?: {
    r2_log: number;
    mae: number;
    median_abs_pct_error: number;
    within_10pct: number;
    within_25pct: number;
    train_rows: number;
    test_rows: number;
  };
  threshold_pct?: number;
  flagged_count?: number;
  flagged_share_pct?: number;
  value_gap?: number;
  flagged_jobs?: {
    job_id: string;
    customer_name: string;
    product_type: string;
    work_type: string;
    quantity: number;
    actual_price: number;
    expected_price: number;
    gap: number;
    gap_pct: number;
  }[];
  features_used?: string[];
  brief: Brief;
}

/* ---------- ML: Churn risk ---------- */

export interface ChurnRiskCustomer {
  customer_id: string;
  customer_name: string;
  risk_score: number;
  order_probability: number;
  risk_band: "High" | "Medium" | "Low";
  days_since_last_order: number;
  avg_interval_days: number;
  orders_last_365d: number;
  va_last_90d: number;
}

export interface ChurnRiskResponse {
  available: boolean;
  reason?: string;
  metrics?: {
    auc: number;
    baseline_auc: number;
    beats_baseline: boolean;
    accuracy: number;
    base_rate: number;
    train_rows: number;
    test_rows: number;
    customers: number;
    lookahead_days: number;
    train_period_end: string;
  };
  current_risk?: ChurnRiskCustomer[];
  band_counts?: Record<string, number>;
  features_used?: string[];
  brief: Brief;
}

/* ---------- Executive summary ---------- */

export interface ExecutiveFinding {
  area: string;
  title: string;
  value: string;
  caption: string;
  body: string;
  /** Money at stake, used to rank findings against each other. */
  at_stake: number;
  at_stake_label: string;
  /** Plain-English statement of what the at-stake figure measures. */
  basis: string;
}

export interface ExecutiveSummary {
  findings: ExecutiveFinding[];
  considered: number;
  years_of_data: number;
}

/* ---------- Reports ---------- */

export type ReportStatus = "generating" | "ready" | "failed";

/** Sidebar-level information about a stored report. */
export interface ReportMeta {
  id: number;
  name: string;
  created_at: string;
  completed_at: string | null;
  status: ReportStatus;
  progress: string | null;
  progress_pct: number;
  row_count: number;
  customer_count: number;
  period_from: string | null;
  period_to: string | null;
  error: string | null;
}

/** Everything the dashboard renders, built once and stored. */
export interface ReportPayload {
  summary: Summary;
  customerValue: CustomerValueResponse;
  repeatBusiness: RepeatBusinessResponse;
  reorder: ReorderResponse;
  churn: ChurnResponse;
  pricing: PricingResponse;
  seasonality: SeasonalityResponse;
  delivery: DeliveryResponse;
  quoteGuard: QuoteGuardResponse;
  churnRisk: ChurnRiskResponse;
  executive: ExecutiveSummary;
}

export interface ReportDetail {
  report: ReportMeta;
  /** Null until the report finishes generating. */
  payload: ReportPayload | null;
}

export interface ReportListResponse {
  reports: ReportMeta[];
}
