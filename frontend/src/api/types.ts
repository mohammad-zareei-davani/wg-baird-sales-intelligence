export interface Summary {
  row_count: number;
  customer_count: number;
  total_sell_price: number;
  total_va_amount: number;
  avg_va_pct: number;
  date_range: { from: string; to: string };
  source: string;
}

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

export interface CustomerValueResponse {
  top_customers: TopCustomer[];
  work_type_breakdown: WorkTypeBreakdown[];
  concentration: {
    customer_count: number;
    customers_for_80pct_value: number;
    pct_of_customers_for_80pct_value: number;
  };
}

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
}

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
}
