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
    <section className="rounded-lg border border-edge bg-surface shadow-card">
      <header className="border-b border-edge px-5 py-3.5">
        <h3 className="text-[14px] font-semibold text-ink-primary">{title}</h3>
        {subtitle && (
          <p className="mt-1 max-w-[80ch] text-[12.5px] leading-relaxed text-ink-secondary">
            {subtitle}
          </p>
        )}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}
