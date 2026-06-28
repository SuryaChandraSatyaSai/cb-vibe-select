/** Human-readable byte size, e.g. bytes(1536) -> "1.5 KB". */
export function bytes(n: number, decimals = 1): string {
  if (!n) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(n) / Math.log(k));
  return `${parseFloat((n / k ** i).toFixed(decimals))} ${units[i]}`;
}
