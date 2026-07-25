import type { ReactNode } from "react";

export function Th({
  children,
  numeric = false,
  sortKey,
  activeSort,
  direction,
  onSort,
}: {
  children: ReactNode;
  numeric?: boolean;
  sortKey?: string;
  activeSort?: string;
  direction?: "asc" | "desc";
  onSort?: (key: string) => void;
}) {
  const align = numeric ? "text-right" : "text-left";
  const base = `pb-2 font-head text-[10px] font-semibold uppercase tracking-[0.14em] ${align}`;
  if (!sortKey || !onSort) {
    return (
      <th scope="col" className={`${base} text-mid`}>
        {children}
      </th>
    );
  }
  const active = activeSort === sortKey;
  return (
    <th scope="col" className={`${base} ${active ? "text-ink" : "text-mid"}`} aria-sort={
      active ? (direction === "asc" ? "ascending" : "descending") : "none"
    }>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`font-head uppercase tracking-[0.14em] hover:text-cyan ${align} w-full`}
      >
        {children}
        <span aria-hidden="true" className="ml-1 text-[9px]">
          {active ? (direction === "asc" ? "▲" : "▼") : "\u00A0"}
        </span>
      </button>
    </th>
  );
}

export function Td({
  children,
  numeric = false,
  className = "",
}: {
  children: ReactNode;
  numeric?: boolean;
  className?: string;
}) {
  return (
    <td
      className={`py-2.5 pr-4 text-[13px] text-ink ${
        numeric ? "num text-right" : "text-left"
      } ${className}`}
    >
      {children}
    </td>
  );
}
