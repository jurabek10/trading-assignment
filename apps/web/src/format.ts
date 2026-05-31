export function formatPrice(n: number): string {
  return new Intl.NumberFormat("ko-KR").format(Math.round(n));
}

export function formatPct(n: number): string {
  const v = Math.abs(n).toFixed(2);
  return `${v}%`;
}

export function formatTradingValue(krw: number): string {
  // Convert KRW to 억 (100 million) with 1 fractional digit when small.
  const eok = krw / 100_000_000;
  if (eok >= 10000) return `${Math.round(eok).toLocaleString("ko-KR")}억`;
  if (eok >= 100) return `${Math.round(eok).toLocaleString("ko-KR")}억`;
  return `${eok.toFixed(0)}억`;
}

export function formatNowKR(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const dow = days[d.getDay()];
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}-${dd}(${dow}) ${hh}:${mi}`;
}
