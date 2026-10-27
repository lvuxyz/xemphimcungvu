/** §3.1 — năm hợp lệ từ 1911 tới hiện tại (nới 2 năm cho phim sắp chiếu). */
export function parseYear(raw: string): number | null {
  const year = Number.parseInt(raw, 10);
  if (!Number.isFinite(year) || year < 1911 || year > new Date().getFullYear() + 2) return null;
  return year;
}
