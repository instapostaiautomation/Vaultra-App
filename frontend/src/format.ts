export function inr(n: number | undefined | null, digits = 2) {
  const v = Number(n || 0);
  return "₹" + v.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function grams(n: number | undefined | null, digits = 4) {
  return `${Number(n || 0).toFixed(digits)}g`;
}

export function floor4(n: number) {
  return Math.floor(n * 10000) / 10000;
}

export function shortDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function dateTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}, ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
}

export function timeAgo(iso?: string) {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function maskPhone(p?: string) {
  if (!p) return "";
  return `+91 ${p.slice(0, 5)} ${p.slice(5)}`;
}

export const TXN_LABEL: Record<string, string> = {
  buy: "Gold Purchase",
  buy_silver: "Silver Purchase",
  sell: "Gold Sold",
  sip: "SIP Installment",
  redemption: "Redemption",
  counter_sale: "Counter Purchase",
  reversal: "Reversal",
  gift_sent: "Gift Sent",
  gift_received: "Gift Received",
};

export const TENANT_NAME: Record<string, string> = {
  all: "All Stores",
  vaultra: "Vaultra Gold Bullion",
  tanishq: "Tanishq Partner",
  malabar: "Malabar Partner",
};
