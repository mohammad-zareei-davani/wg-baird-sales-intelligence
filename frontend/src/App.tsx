import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DashboardDataProvider } from "./data/DashboardDataContext";
import { AppLayout } from "./layout/AppLayout";
import { OverviewPage } from "./pages/OverviewPage";
import { CustomerValuePage } from "./pages/CustomerValuePage";
import { RepeatBusinessPage } from "./pages/RepeatBusinessPage";
import { ReorderPage } from "./pages/ReorderPage";
import { ChurnPage } from "./pages/ChurnPage";
import { PricingPage } from "./pages/PricingPage";
import { SeasonalityPage } from "./pages/SeasonalityPage";
import { DeliveryPage } from "./pages/DeliveryPage";
import { QuoteGuardPage } from "./pages/QuoteGuardPage";
import { ChurnRiskPage } from "./pages/ChurnRiskPage";

export default function App() {
  return (
    <DashboardDataProvider>
      <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<OverviewPage />} />
              <Route path="customer-value" element={<CustomerValuePage />} />
              <Route path="repeat-business" element={<RepeatBusinessPage />} />
              <Route path="reorder" element={<ReorderPage />} />
              <Route path="churn" element={<ChurnPage />} />
              <Route path="pricing" element={<PricingPage />} />
              <Route path="seasonality" element={<SeasonalityPage />} />
              <Route path="delivery" element={<DeliveryPage />} />
              <Route path="quote-guard" element={<QuoteGuardPage />} />
              <Route path="churn-risk" element={<ChurnRiskPage />} />
            </Route>
        </Routes>
      </BrowserRouter>
    </DashboardDataProvider>
  );
}
