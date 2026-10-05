/**
 * Gom lịch sử xem theo ngày — nguồn cho trang `/lich-su`.
 *
 * Tách khỏi component để test được bằng một `now` cố định: ranh giới "hôm nay /
 * hôm qua" là nửa đêm GIỜ MÁY, và lỗi lệch một ngày chỉ lộ ra đúng lúc gần nửa
 * đêm — thứ không ai bắt được bằng mắt.
 */

import type { WatchIndexEntry } from './storage';

export interface HistoryGroup {
  /** Khoá ổn định cho React và cho `aria-labelledby`. */
  key: 'today' | 'yesterday' | 'week' | 'older';
  label: string;
  entries: WatchIndexEntry[];
}

const GROUPS: ReadonlyArray<Pick<HistoryGroup, 'key' | 'label'>> = [
  { key: 'today', label: 'Hôm nay' },
  { key: 'yesterday', label: 'Hôm qua' },
  { key: 'week', label: '7 ngày qua' },
  { key: 'older', label: 'Trước đó' },
];

/**
 * Nửa đêm của ngày cách `now` đúng `daysAgo` ngày, theo giờ máy.
 *
 * Dựng bằng `new Date(y, m, d - n)` chứ không trừ `n * 24h`: ngày chuyển giờ mùa
 * hè chỉ dài 23 hoặc 25 tiếng, và phép trừ cố định sẽ đặt mốc lệch một tiếng.
 */
function midnight(now: number, daysAgo: number): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysAgo).getTime();
}

/**
 * Chia entry vào bốn nhóm theo `updatedAt`, giữ nguyên thứ tự đầu vào trong từng
 * nhóm (index đã là mới nhất trước). Nhóm rỗng bị bỏ — tiêu đề "Hôm qua" không kèm
 * phim nào chỉ là nhiễu.
 */
export function groupByDay(entries: readonly WatchIndexEntry[], now: number): HistoryGroup[] {
  const today = midnight(now, 0);
  const yesterday = midnight(now, 1);
  const week = midnight(now, 6);

  const buckets: Record<HistoryGroup['key'], WatchIndexEntry[]> = {
    today: [],
    yesterday: [],
    week: [],
    older: [],
  };

  for (const entry of entries) {
    // Đồng hồ máy bị chỉnh lùi thì `updatedAt` có thể nằm ở tương lai — vẫn là "hôm nay".
    if (entry.updatedAt >= today) buckets.today.push(entry);
    else if (entry.updatedAt >= yesterday) buckets.yesterday.push(entry);
    else if (entry.updatedAt >= week) buckets.week.push(entry);
    else buckets.older.push(entry);
  }

  return GROUPS.map((g) => ({ ...g, entries: buckets[g.key] })).filter((g) => g.entries.length > 0);
}
