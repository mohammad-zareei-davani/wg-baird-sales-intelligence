import { OverviewPage } from "../pages/OverviewPage";
import { CustomerValuePage } from "../pages/CustomerValuePage";
import { RepeatBusinessPage } from "../pages/RepeatBusinessPage";
import { ReorderPage } from "../pages/ReorderPage";
import { ChurnPage } from "../pages/ChurnPage";
import { PricingPage } from "../pages/PricingPage";
import { SeasonalityPage } from "../pages/SeasonalityPage";
import { DeliveryPage } from "../pages/DeliveryPage";
import { QuoteGuardPage } from "../pages/QuoteGuardPage";

const PRINT_SECTIONS = [
  OverviewPage,
  CustomerValuePage,
  RepeatBusinessPage,
  ReorderPage,
  ChurnPage,
  PricingPage,
  SeasonalityPage,
  DeliveryPage,
  QuoteGuardPage,
] as const;

/** Renders every insight page in sequence for a single multi-page PDF. */
export function PrintAllPages() {
  return (
    <div className="print-report flex flex-col">
      {PRINT_SECTIONS.map((Page, index) => (
        <section key={index} className="print-section pb-6">
          <Page />
        </section>
      ))}
    </div>
  );
}
