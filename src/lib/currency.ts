const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

export const SUPPORTED_CURRENCIES = ["INR", "USD", "EUR", "GBP"] as const;

export function formatCurrency(amount: number, currency = "INR"): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency + " ";
  const formatted = new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${symbol}${formatted}`;
}
