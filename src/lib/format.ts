/** Client-side money + date formatting (mirrors server formatting). */

export function formatKES(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  const hasFraction = Math.abs(rounded % 1) > 0.004;
  return (
    "KES " +
    rounded.toLocaleString("en-KE", {
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: 2,
    })
  );
}

export function formatCompactKES(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `KES ${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `KES ${(n / 1_000).toFixed(1)}K`;
  return formatKES(n);
}

/** "7 Oct 2026, 14:32" in Nairobi time. */
export function formatDateTime(t: number): string {
  const d = new Date(t + 3 * 60 * 60 * 1000);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${hh}:${mm}`;
}

/** "7 Oct" in Nairobi time. */
export function formatDay(t: number): string {
  const d = new Date(t + 3 * 60 * 60 * 1000);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
}

export const TX_TYPE_LABELS: Record<string, string> = {
  sale: "Sale",
  expense: "Expense",
  purchase: "Purchase",
  payment_received: "Payment received",
  debt: "Debt",
};

export const TX_TYPE_COLORS: Record<string, string> = {
  sale: "text-emerald-400",
  expense: "text-red-400",
  purchase: "text-teal-400",
  payment_received: "text-sky-400",
  debt: "text-amber-400",
};
