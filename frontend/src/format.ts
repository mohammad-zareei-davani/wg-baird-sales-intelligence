// All monetary figures from the API are pre-converted to the base reporting
// currency (GBP) by the backend, so formatting is single-currency here.
const currencyFmt = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

const compactCurrencyFmt = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  notation: "compact",
  maximumFractionDigits: 1,
});

const numberFmt = new Intl.NumberFormat("en-GB");

export function formatCurrency(value: number): string {
  return currencyFmt.format(value);
}

export function formatCurrencyCompact(value: number): string {
  return compactCurrencyFmt.format(value);
}

export function formatNumber(value: number): string {
  return numberFmt.format(value);
}

export function formatPct(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

export function formatDays(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}d`;
}
