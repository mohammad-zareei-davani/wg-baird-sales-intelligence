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
    <section className="border border-edge bg-raised">
      <header className="border-b border-edge px-5 py-4">
        <h3 className="font-display text-[17px] font-semibold tracking-[-0.01em] text-ink-primary">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-1.5 max-w-[80ch] text-[12.5px] leading-relaxed text-ink-secondary">
            {subtitle}
          </p>
        )}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}
