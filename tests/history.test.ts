import { describe, expect, it } from 'vitest';
import { groupByDay } from '@/lib/history';
import { routes } from '@/lib/routes';
import type { WatchIndexEntry } from '@/lib/storage';

/** 20:30 giờ máy, 5/10/2026 — dựng theo giờ máy để test không phụ thuộc múi giờ CI. */
const NOW = new Date(2026, 9, 5, 20, 30).getTime();
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 9, day, hour, minute).getTime();

const entry = (slug: string, updatedAt: number): WatchIndexEntry => ({
  slug,
  lastEp: 'tap-01',
  eps: { 'tap-01': [600, 2400, updatedAt] },
  updatedAt,
  finished: 0,
  snapshot: null,
});

const slugsOf = (groups: ReturnType<typeof groupByDay>) =>
  Object.fromEntries(groups.map((g) => [g.key, g.entries.map((e) => e.slug)]));

describe('groupByDay', () => {
  it('chia theo nửa đêm giờ máy, không theo 24 giờ trôi qua', () => {
    const groups = groupByDay(
      [
        entry('sang-nay', at(5, 0, 1)),
        // 23:59 hôm qua — chưa tới 24 giờ trước nhưng là ngày khác.
        entry('khuya-qua', at(4, 23, 59)),
        entry('dau-hom-qua', at(4, 0, 0)),
      ],
      NOW,
    );
    expect(slugsOf(groups)).toEqual({
      today: ['sang-nay'],
      yesterday: ['khuya-qua', 'dau-hom-qua'],
    });
  });

  it('"7 ngày qua" kéo tới nửa đêm của 6 ngày trước, cũ hơn là "Trước đó"', () => {
    // Ngày 0 của tháng 10 là 30/9 → ngày -1 là 29/9, đúng 6 ngày trước 5/10.
    const sixDaysAgo = at(-1, 0);
    const groups = groupByDay(
      [
        entry('hai-ngay', at(3, 10)),
        entry('sau-ngay', sixDaysAgo),
        entry('bay-ngay', sixDaysAgo - 1),
      ],
      NOW,
    );
    expect(slugsOf(groups)).toEqual({
      week: ['hai-ngay', 'sau-ngay'],
      older: ['bay-ngay'],
    });
  });

  it('giữ thứ tự đầu vào và bỏ nhóm rỗng', () => {
    const groups = groupByDay(
      [entry('b', at(5, 9)), entry('a', at(5, 8)), entry('c', at(-10, 8))],
      NOW,
    );
    expect(groups.map((g) => g.label)).toEqual(['Hôm nay', 'Trước đó']);
    expect(groups[0]!.entries.map((e) => e.slug)).toEqual(['b', 'a']);
  });

  it('mốc ở tương lai (đồng hồ máy bị chỉnh) vẫn là hôm nay', () => {
    expect(slugsOf(groupByDay([entry('x', NOW + 86_400_000)], NOW))).toEqual({ today: ['x'] });
  });

  it('không có entry thì không có nhóm', () => {
    expect(groupByDay([], NOW)).toEqual([]);
  });
});

describe('routes.history', () => {
  it('trỏ về /lich-su', () => {
    expect(routes.history()).toBe('/lich-su');
  });
});
