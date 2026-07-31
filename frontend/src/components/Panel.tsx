import type { ReactNode } from "react";

export function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-black/10 bg-surface p-5">
      <header>
        <h2 className="mb-1 text-base font-semibold">{title}</h2>
        {subtitle && <p className="mb-4 text-[13px] text-ink-secondary">{subtitle}</p>}
      </header>
      <div>{children}</div>
    </section>
  );
}
