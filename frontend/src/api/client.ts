import type {
  ChurnResponse,
  ChurnRiskResponse,
  CustomerValueResponse,
  DeliveryResponse,
  ExecutiveSummaryResponse,
  PricingResponse,
  QuoteGuardResponse,
  RepeatBusinessResponse,
  ReorderResponse,
  SeasonalityResponse,
  Summary,
} from "./types";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${path} failed: ${res.status} ${body}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  summary: () => getJson<Summary>("/api/summary"),
  customerValue: (topN = 20) =>
    getJson<CustomerValueResponse>(`/api/insights/customer-value?top_n=${topN}`),
  reorder: () => getJson<ReorderResponse>("/api/insights/reorder"),
  churn: () => getJson<ChurnResponse>("/api/insights/churn"),
  pricing: () => getJson<PricingResponse>("/api/insights/pricing"),
  seasonality: (horizon = 6) =>
    getJson<SeasonalityResponse>(`/api/insights/seasonality?horizon=${horizon}`),
  delivery: () => getJson<DeliveryResponse>("/api/insights/delivery"),
  repeatBusiness: () => getJson<RepeatBusinessResponse>("/api/insights/repeat-business"),
  quoteGuard: () => getJson<QuoteGuardResponse>("/api/ml/quote-guard"),
  churnRisk: () => getJson<ChurnRiskResponse>("/api/ml/churn-risk"),
  executiveSummary: () => getJson<ExecutiveSummaryResponse>("/api/executive-summary"),
  uploadData: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/data/upload", { method: "POST", body: form });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`upload failed: ${res.status} ${body}`);
    }
    return res.json() as Promise<{ status: string; source: string; row_count: number }>;
  },
};
