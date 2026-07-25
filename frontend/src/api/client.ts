import type {
  AtRiskResponse,
  CustomerDetail,
  CustomerMapResponse,
  CustomersResponse,
  ExampleJobSpec,
  IngestResponse,
  JobSpec,
  ModelMetricsResponse,
  OptionsResponse,
  PredictMode,
  PredictResponse,
  PricingVarianceResponse,
  SeasonalityResponse,
  Summary,
} from "../types";

const BASE = "/api";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, init);
  const text = await response.text();
  let payload: unknown = null;
  if (text.length > 0) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = null;
    }
  }
  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && "detail" in payload
        ? String((payload as { detail: unknown }).detail)
        : `Request failed with status ${response.status}`;
    throw new ApiError(response.status, detail);
  }
  return payload as T;
}

export function getHealth(): Promise<{ status: string }> {
  return request<{ status: string }>("/health/");
}

export function getSummary(): Promise<Summary> {
  return request<Summary>("/summary/");
}

export function getCustomers(): Promise<CustomersResponse> {
  return request<CustomersResponse>("/customers/");
}

export function getCustomerDetail(customerId: string): Promise<CustomerDetail> {
  return request<CustomerDetail>(`/customers/${encodeURIComponent(customerId)}/`);
}

export function getAtRisk(): Promise<AtRiskResponse> {
  return request<AtRiskResponse>("/at-risk/");
}

export function getSeasonality(filters?: {
  industry?: string;
  productType?: string;
  productGroup?: string;
}): Promise<SeasonalityResponse> {
  const params = new URLSearchParams();
  if (filters?.industry) params.set("industry", filters.industry);
  if (filters?.productType) params.set("product_type", filters.productType);
  if (filters?.productGroup) params.set("product_group", filters.productGroup);
  const query = params.toString();
  return request<SeasonalityResponse>(`/seasonality/${query ? `?${query}` : ""}`);
}

export function getPricingVariance(): Promise<PricingVarianceResponse> {
  return request<PricingVarianceResponse>("/pricing-variance/");
}

export function postPredict(spec: JobSpec, mode: PredictMode): Promise<PredictResponse> {
  const body: Record<string, unknown> = { ...spec, mode };
  if (mode === "enquiry") {
    delete body.impressions;
    delete body.press_hrs;
  }
  return request<PredictResponse>("/predict/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function getModelMetrics(): Promise<ModelMetricsResponse> {
  return request<ModelMetricsResponse>("/model-metrics/");
}

export function postIngest(file: File): Promise<IngestResponse> {
  const form = new FormData();
  form.append("file", file);
  return request<IngestResponse>("/ingest/", { method: "POST", body: form });
}

export function getOptions(): Promise<OptionsResponse> {
  return request<OptionsResponse>("/options/");
}

export function getExampleJob(): Promise<ExampleJobSpec> {
  return request<ExampleJobSpec>("/example-job/");
}

export function getCustomerMap(): Promise<CustomerMapResponse> {
  return request<CustomerMapResponse>("/customer-map/");
}
