/** Mirrors CEOAgent._score_hidden_cost for display in the UI. */
export function scoreHiddenCost(trueAnnualCost: number, listingPrice: number): number {
  const annualCostRatio = trueAnnualCost / listingPrice;
  const score = 100 - ((annualCostRatio - 0.01) / 0.02) * 100;
  return Math.round(Math.min(100, Math.max(0, score)) * 100) / 100;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trimEnd()}…`;
}
