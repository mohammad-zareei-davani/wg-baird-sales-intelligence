import type { ChurnResponse, CustomerValueResponse, ReorderResponse, Summary } from "./types";

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
  customerValue: (topN = 15) => getJson<CustomerValueResponse>(`/api/insights/customer-value?top_n=${topN}`),
  reorder: () => getJson<ReorderResponse>("/api/insights/reorder"),
  churn: () => getJson<ChurnResponse>("/api/insights/churn"),
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
