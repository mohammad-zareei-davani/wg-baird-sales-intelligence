export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <p role="status" className="py-8 text-xs uppercase tracking-[0.14em] text-mid">
      {label}…
    </p>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <p role="alert" className="border-l-2 border-magenta py-3 pl-3 text-sm text-ink">
      <span className="font-semibold">Could not load data.</span> {message}
    </p>
  );
}
