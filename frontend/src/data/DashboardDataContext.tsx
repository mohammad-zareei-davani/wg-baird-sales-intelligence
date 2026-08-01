import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import type { ReactNode } from "react";
import { api } from "../api/client";
import type { ReportMeta, ReportPayload } from "../api/types";

/** How often to re-check a report that is still being generated. */
const POLL_MS = 2500;

interface DashboardContextValue {
  /** Every stored report, newest first. */
  reports: ReportMeta[];
  /** The report currently being viewed, if any. */
  selected: ReportMeta | null;
  /** Content of the selected report. Null while it is still generating. */
  payload: ReportPayload | null;
  loadingLibrary: boolean;
  loadingReport: boolean;
  error: string | null;
  select: (id: number) => void;
  upload: (file: File) => Promise<void>;
  remove: (id: number) => Promise<void>;
  refreshLibrary: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<ReportMeta | null>(null);
  const [payload, setPayload] = useState<ReportPayload | null>(null);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollTimer = useRef<number | null>(null);

  const clearPoll = useCallback(() => {
    if (pollTimer.current !== null) {
      window.clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const refreshLibrary = useCallback(async () => {
    try {
      const { reports: list } = await api.listReports();
      setReports(list);
      return list;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the report library");
      return [] as ReportMeta[];
    } finally {
      setLoadingLibrary(false);
    }
  }, []);

  // Load the library once, and open the most recent finished report so a
  // returning user lands on something rather than an empty screen.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await refreshLibrary();
      if (cancelled) return;
      const firstReady = list.find((r) => r.status === "ready");
      if (firstReady) setSelectedId(firstReady.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshLibrary]);

  // Fetch whichever report is selected, and keep polling while it builds.
  useEffect(() => {
    clearPoll();
    if (selectedId === null) {
      setSelected(null);
      setPayload(null);
      return;
    }

    let cancelled = false;
    setLoadingReport(true);
    // Clearing immediately is deliberate: a report that is still generating
    // must never show the previous report's content underneath.
    setPayload(null);

    const tick = async () => {
      try {
        const detail = await api.getReport(selectedId);
        if (cancelled) return;

        setSelected(detail.report);
        setPayload(detail.payload);
        setError(null);

        if (detail.report.status === "generating") {
          // Keep the sidebar percentage moving too.
          refreshLibrary();
          pollTimer.current = window.setTimeout(tick, POLL_MS);
        } else {
          refreshLibrary();
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load that report");
      } finally {
        if (!cancelled) setLoadingReport(false);
      }
    };

    tick();
    return () => {
      cancelled = true;
      clearPoll();
    };
  }, [selectedId, clearPoll, refreshLibrary]);

  const select = useCallback((id: number) => {
    setError(null);
    setSelectedId(id);
  }, []);

  const upload = useCallback(
    async (file: File) => {
      setError(null);
      const { report } = await api.uploadReport(file);
      await refreshLibrary();
      // Switch straight to the new report so the user watches it build.
      setSelectedId(report.id);
    },
    [refreshLibrary],
  );

  const remove = useCallback(
    async (id: number) => {
      setError(null);
      const { reports: remaining } = await api.deleteReport(id);
      setReports(remaining);
      if (id === selectedId) {
        const next = remaining.find((r) => r.status === "ready") ?? remaining[0] ?? null;
        setSelectedId(next ? next.id : null);
      }
    },
    [selectedId],
  );

  const value = useMemo(
    () => ({
      reports, selected, payload, loadingLibrary, loadingReport, error,
      select, upload, remove, refreshLibrary: async () => {
        await refreshLibrary();
      },
    }),
    [reports, selected, payload, loadingLibrary, loadingReport, error, select, upload, remove, refreshLibrary],
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardDataProvider");
  return ctx;
}

/**
 * For pages rendered inside the layout, which only mounts them once a report
 * is loaded and ready.
 */
export function useLoadedDashboardData(): ReportPayload {
  const { payload } = useDashboard();
  if (!payload) throw new Error("useLoadedDashboardData called before a report was ready");
  return payload;
}
