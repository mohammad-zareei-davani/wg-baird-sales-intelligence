import type { ReactNode } from "react";
import { RegistrationMark } from "./RegistrationMark";

interface PanelProps {
  title: string;
  note?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function Panel({ title, note, actions, children }: PanelProps) {
  return (
    <section className="border-t border-ink pt-3">
      <header className="mb-4 flex items-baseline justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-head text-[13px] font-semibold uppercase tracking-[0.14em] text-ink">
            <RegistrationMark />
            {title}
          </h2>
          {note ? <p className="mt-1.5 max-w-3xl text-xs leading-relaxed text-mid">{note}</p> : null}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}
