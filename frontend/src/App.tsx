import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DashboardDataProvider } from "./data/DashboardDataContext";
import { AppLayout } from "./layout/AppLayout";
import { OverviewPage } from "./pages/OverviewPage";
import { CustomerValuePage } from "./pages/CustomerValuePage";
import { ReorderPage } from "./pages/ReorderPage";
import { ChurnPage } from "./pages/ChurnPage";

export default function App() {
  return (
    <DashboardDataProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="customer-value" element={<CustomerValuePage />} />
            <Route path="reorder" element={<ReorderPage />} />
            <Route path="churn" element={<ChurnPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </DashboardDataProvider>
  );
}
