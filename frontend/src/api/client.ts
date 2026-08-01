import type { ReportDetail, ReportMeta, ReportListResponse } from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const body = await res.json();
      detail = body?.detail ?? detail;
    } catch {
      detail = (await res.text()) || detail;
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listReports: () => request<ReportListResponse>("/api/reports"),

  getReport: (id: number) => request<ReportDetail>(`/api/reports/${id}`),

  uploadReport: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ report: ReportMeta }>("/api/reports", { method: "POST", body: form });
  },

  deleteReport: (id: number) =>
    request<{ deleted: number; reports: ReportMeta[] }>(`/api/reports/${id}`, {
      method: "DELETE",
    }),
};
