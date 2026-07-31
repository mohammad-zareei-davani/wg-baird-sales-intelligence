import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api } from "../api/client";
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
} from "../api/types";

export interface DashboardData {
  summary: Summary;
  customerValue: CustomerValueResponse;
  reorder: ReorderResponse;
  churn: ChurnResponse;
  pricing: PricingResponse;
  seasonality: SeasonalityResponse;
  delivery: DeliveryResponse;
  repeatBusiness: RepeatBusinessResponse;
  quoteGuard: QuoteGuardResponse;
  churnRisk: ChurnRiskResponse;
  executive: ExecutiveSummaryResponse;
}

interface DashboardContextValue {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        summary, customerValue, reorder, churn, pricing,
        seasonality, delivery, repeatBusiness, quoteGuard, churnRisk, executive,
      ] = await Promise.all([
        api.summary(),
        api.customerValue(20),
        api.reorder(),
        api.churn(),
        api.pricing(),
        api.seasonality(),
        api.delivery(),
        api.repeatBusiness(),
        api.quoteGuard(),
        api.churnRisk(),
        api.executiveSummary(),
      ]);
      setData({
        summary, customerValue, reorder, churn, pricing,
        seasonality, delivery, repeatBusiness, quoteGuard, churnRisk, executive,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const value = useMemo(() => ({ data, loading, error, reload }), [data, loading, error, reload]);

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboardData(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboardData must be used within DashboardDataProvider");
  return ctx;
}

/** For pages rendered under AppLayout, which only mounts its <Outlet> once data has loaded. */
export function useLoadedDashboardData(): DashboardData {
  const { data } = useDashboardData();
  if (!data) throw new Error("useLoadedDashboardData called before data was loaded");
  return data;
}
