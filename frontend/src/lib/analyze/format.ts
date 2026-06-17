export function formatMoney(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return "$" + Math.round(value).toLocaleString("en-US");
}

export function hostOf(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}
