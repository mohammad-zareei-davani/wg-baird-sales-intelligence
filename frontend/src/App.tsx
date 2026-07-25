import { useCallback, useState } from "react";
import { RegistrationMark } from "./components/RegistrationMark";
import { UploadControl } from "./components/UploadControl";
import { AtRisk } from "./pages/AtRisk";
import { Customers } from "./pages/Customers";
import { Overview } from "./pages/Overview";
import { Pricing } from "./pages/Pricing";

const PAGES = ["Overview", "At Risk", "Customers", "Pricing"] as const;
type Page = (typeof PAGES)[number];

export default function App() {
  const [page, setPage] = useState<Page>("Overview");
  const [dataVersion, setDataVersion] = useState(0);

  const handleIngested = useCallback(() => {
    setDataVersion((current) => current + 1);
  }, []);

  return (
    <div className="min-h-full">
      <header className="border-b border-ink px-6 pb-4 pt-6 md:px-10">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="flex items-center gap-2 font-head text-[11px] font-semibold uppercase tracking-[0.2em] text-mid">
              <RegistrationMark size={11} />
              W&amp;G Baird
            </p>
            <h1 className="mt-1 font-head text-2xl font-semibold tracking-tight text-ink">
              Sales Intelligence
            </h1>
          </div>
          <UploadControl onIngested={handleIngested} />
        </div>

        <nav aria-label="Sections" className="mt-6">
          <ul className="flex flex-wrap gap-6">
            {PAGES.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  aria-current={page === name ? "page" : undefined}
                  onClick={() => setPage(name)}
                  className={`border-b-2 pb-1 font-head text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors ${
                    page === name
                      ? "border-cyan text-ink"
                      : "border-transparent text-mid hover:text-ink"
                  }`}
                >
                  {name}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="px-6 py-10 md:px-10">
        {page === "Overview" ? <Overview dataVersion={dataVersion} /> : null}
        {page === "At Risk" ? <AtRisk dataVersion={dataVersion} /> : null}
        {page === "Customers" ? <Customers dataVersion={dataVersion} /> : null}
        {page === "Pricing" ? <Pricing dataVersion={dataVersion} /> : null}
      </main>

      <footer className="border-t border-rule px-6 py-6 text-[11px] text-mid md:px-10">
        Figures derive from the ingested workbook only. Value added excludes credit notes and
        in-flight jobs; Euro values are converted to GBP at the rate held in config.
      </footer>
    </div>
  );
}
