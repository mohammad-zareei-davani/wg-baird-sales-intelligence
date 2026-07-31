export function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h1 className="mb-1.5 text-2xl font-bold">{title}</h1>
      <p className="max-w-[760px] text-sm leading-relaxed text-ink-secondary">{description}</p>
    </div>
  );
}
