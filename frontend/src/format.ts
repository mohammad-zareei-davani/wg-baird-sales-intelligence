const currencyFmt = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const compactCurrencyFmt = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 1,
});

const numberFmt = new Intl.NumberFormat("en-IE");

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
