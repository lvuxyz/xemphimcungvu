import { describe, expect, it } from 'vitest';
import {
  personalizeRows,
  sourceTasteKey,
  tasteScores,
  type ListedMovie,
  type TasteRow,
} from '@/lib/taste';
import type { WatchIndexEntry, WatchSnapshot } from '@/lib/storage';
import type { MovieType } from '@/types/movie';
import { routes } from '@/lib/routes';

const NOW = Date.UTC(2026, 8, 21);
const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

function entry(
  slug: string,
  opts: {
    type?: MovieType;
    categories?: string[];
    countries?: string[];
    finished?: number;
    ratio?: number;
    ageWeeks?: number;
    name?: string;
    noSnapshot?: boolean;
  } = {},
): WatchIndexEntry {
  const snapshot: WatchSnapshot = {
    name: opts.name ?? slug,
    originName: '',
    poster: '',
    thumb: '',
    year: 2026,
    quality: 'FHD',
    episodeCurrent: '',
    episodeName: 'Tập 01',
    type: opts.type ?? 'series',
    categories: opts.categories ?? [],
    countries: opts.countries ?? [],
  };

  const duration = 1000;
  return {
    slug,
    lastEp: 'tap-01',
    eps: { 'tap-01': [duration * (opts.ratio ?? 0.5), duration, NOW] },
    updatedAt: NOW - (opts.ageWeeks ?? 0) * WEEK,
    finished: opts.finished ?? 0,
    snapshot: opts.noSnapshot ? null : snapshot,
  };
}

/** Một phim trong "Danh sách của tôi". */
const listed = (
  opts: { categories?: string[]; countries?: string[]; type?: MovieType; ageWeeks?: number } = {},
): ListedMovie => ({
  type: opts.type,
  categories: opts.categories,
  countries: opts.countries,
  addedAt: NOW - (opts.ageWeeks ?? 0) * WEEK,
});

/** Đúng 10 row của trang chủ, rút gọn. */
const ROWS: TasteRow[] = [
  { id: 'type-phim-bo', title: 'Phim bộ', source: { kind: 'type', type: 'phim-bo' }, href: '/a' },
  { id: 'type-phim-le', title: 'Phim lẻ', source: { kind: 'type', type: 'phim-le' }, href: '/b' },
  {
    id: 'country-han-quoc',
    title: 'Hàn Quốc',
    source: { kind: 'country', slug: 'han-quoc' },
    href: '/c',
  },
  {
    id: 'category-hanh-dong',
    title: 'Hành động',
    source: { kind: 'category', slug: 'hanh-dong' },
    href: '/d',
  },
  {
    id: 'category-kinh-di',
    title: 'Kinh dị',
    source: { kind: 'category', slug: 'kinh-di' },
    href: '/e',
  },
];

describe('sourceTasteKey', () => {
  it('tách theo nhóm, vì slug thể loại và slug quốc gia có thể trùng nhau', () => {
    expect(sourceTasteKey({ kind: 'category', slug: 'x' })).toBe('category:x');
    expect(sourceTasteKey({ kind: 'country', slug: 'x' })).toBe('country:x');
    expect(sourceTasteKey({ kind: 'type', type: 'phim-bo' })).toBe('type:phim-bo');
  });

  it('nguồn không mang sở thích thì không có khoá', () => {
    expect(sourceTasteKey({ kind: 'newly-updated' })).toBeNull();
    expect(sourceTasteKey({ kind: 'all' })).toBeNull();
    expect(sourceTasteKey({ kind: 'year', year: 2026 })).toBeNull();
  });
});

describe('tasteScores', () => {
  it('cộng trọng số cho thể loại, quốc gia và loại phim', () => {
    const scores = tasteScores(
      [entry('a', { categories: ['hanh-dong'], countries: ['han-quoc'] })],
      {
        now: NOW,
      },
    );

    expect(scores.get('category:hanh-dong')).toBeCloseTo(1.5);
    // Quốc gia rộng hơn nên chỉ 0.8 lần.
    expect(scores.get('country:han-quoc')).toBeCloseTo(1.2);
    // Loại phim là nhóm rộng nhất (4 giá trị, phim nào cũng thuộc một cái) → 0.5 lần.
    expect(scores.get('type:phim-bo')).toBeCloseTo(0.75);
  });

  it('snapshot không biết loại phim thì không bầu cho loại nào', () => {
    const old = entry('a', { categories: ['hanh-dong'] });
    const scores = tasteScores([{ ...old, snapshot: { ...old.snapshot!, type: undefined } }], {
      now: NOW,
    });

    expect([...scores.keys()].some((key) => key.startsWith('type:'))).toBe(false);
    expect(scores.get('category:hanh-dong')).toBeCloseTo(1.5);
  });

  it('xem xong nhiều tập thì nặng hơn xem dở', () => {
    const [dở, xong] = [
      tasteScores([entry('a', { categories: ['x'], ratio: 0.5 })], { now: NOW }),
      tasteScores([entry('a', { categories: ['x'], ratio: 0.5, finished: 5 })], { now: NOW }),
    ];

    expect(xong.get('category:x')).toBeGreaterThan(dở.get('category:x') ?? 0);
  });

  it('trần số tập xem xong — hết 40 tập không nặng gấp 8 lần hết 5 tập', () => {
    const five = tasteScores([entry('a', { categories: ['x'], finished: 5 })], { now: NOW });
    const forty = tasteScores([entry('a', { categories: ['x'], finished: 40 })], { now: NOW });

    expect(forty.get('category:x')).toBe(five.get('category:x'));
  });

  it('sở thích cũ nhạt dần theo tuần', () => {
    const fresh =
      tasteScores([entry('a', { categories: ['x'] })], { now: NOW }).get('category:x') ?? 0;
    const old =
      tasteScores([entry('a', { categories: ['x'], ageWeeks: 12 })], { now: NOW }).get(
        'category:x',
      ) ?? 0;

    expect(old).toBeLessThan(fresh);
    // Nhạt chứ không mất: sau 3 tháng vẫn còn quá nửa.
    expect(old).toBeGreaterThan(fresh * 0.6);
  });

  it('entry chưa có snapshot thì không đóng góp gì', () => {
    expect(tasteScores([entry('a', { noSnapshot: true })], { now: NOW }).size).toBe(0);
  });
});

describe('personalizeRows', () => {
  it('chưa xem gì thì trả về ĐÚNG mảng đầu vào — lượt render đầu phải khớp server', () => {
    expect(personalizeRows(ROWS, [], { now: NOW })).toBe(ROWS);
  });

  it('đưa row khớp sở thích lên đầu', () => {
    const entries = [entry('a', { categories: ['kinh-di'], countries: ['han-quoc'], finished: 4 })];
    const ids = personalizeRows(ROWS, entries, { now: NOW }).map((r) => r.id);

    expect(ids[0]).toBe('category-kinh-di');
    expect(ids).toHaveLength(ROWS.length);
  });

  it('giữ nguyên thứ tự ban đầu cho những row cùng điểm', () => {
    const entries = [entry('a', { categories: ['kinh-di'] })];
    const ids = personalizeRows(ROWS, entries, { now: NOW }).map((r) => r.id);

    // Chỉ "Kinh dị" và "Phim bộ" có điểm; ba row còn lại giữ nguyên thứ tự cũ.
    expect(ids.slice(2)).toEqual(['type-phim-le', 'country-han-quoc', 'category-hanh-dong']);
  });

  it('đặt lại tên row thể loại đã có thành "Vì bạn đã xem …"', () => {
    const entries = [
      entry('a', { categories: ['hanh-dong'], name: 'Phim Hành Động', finished: 3 }),
    ];
    const rows = personalizeRows(ROWS, entries, { now: NOW });
    const row = rows.find((r) => r.id === 'category-hanh-dong');

    expect(row?.title).toBe('Vì bạn đã xem Phim Hành Động');
    expect(row?.source).toEqual({ kind: 'category', slug: 'hanh-dong' });
  });

  /** Số row KHÔNG đổi: thêm một row là trang cao lên đúng lúc hydrate. */
  it('thể loại chưa có row thì lấy chỗ của row thể loại yếu nhất, không chèn thêm', () => {
    const entries = [entry('a', { categories: ['hoat-hinh-nhat'], name: 'Phim Lạ', finished: 5 })];
    const rows = personalizeRows(ROWS, entries, { now: NOW });

    expect(rows).toHaveLength(ROWS.length);
    expect(rows[0]?.title).toBe('Vì bạn đã xem Phim Lạ');
    expect(rows[0]?.source).toEqual({ kind: 'category', slug: 'hoat-hinh-nhat' });
    expect(rows[0]?.href).toBe(routes.category('hoat-hinh-nhat'));
    // Đúng một row thể loại bị thay, hai row thể loại cũ không thể còn cả hai.
    expect(rows.filter((r) => r.source.kind === 'category')).toHaveLength(2);
  });

  /**
   * Một phim mang 3–4 thể loại và tất cả cùng trọng số, nên bằng điểm là chuyện
   * thường. Chọn nhầm nhánh thì mất một row thể loại VÀ có hai row cùng nội dung.
   */
  it('bằng điểm thì chọn thể loại đã có row, khỏi phải thay row nào', () => {
    const entries = [
      entry('a', { categories: ['vien-tuong', 'hanh-dong'], name: 'Phim X', finished: 5 }),
    ];
    const rows = personalizeRows(ROWS, entries, { now: NOW });

    expect(rows.find((r) => r.id === 'category-hanh-dong')?.title).toBe('Vì bạn đã xem Phim X');
    // Không row nào bị đổi nguồn.
    expect(rows.map((r) => r.source)).toEqual(
      expect.arrayContaining(ROWS.map((r) => expect.objectContaining(r.source))),
    );
  });

  it('thể loại hơn điểm hẳn thì vẫn thắng dù chưa có row', () => {
    const entries = [
      entry('a', { categories: ['vien-tuong'], name: 'Phim X', finished: 5 }),
      entry('b', { categories: ['hanh-dong'], name: 'Phim Y', ratio: 0.1 }),
    ];
    const rows = personalizeRows(ROWS, entries, { now: NOW });

    expect(rows[0]?.title).toBe('Vì bạn đã xem Phim X');
    expect(rows[0]?.source).toEqual({ kind: 'category', slug: 'vien-tuong' });
  });

  it('phim tiêu biểu là phim nặng nhất trong thể loại, không phải phim mới nhất', () => {
    const entries = [
      entry('nhe', { categories: ['hanh-dong'], name: 'Mở 30 giây', ratio: 0.03 }),
      entry('nang', { categories: ['hanh-dong'], name: 'Xem Hết', finished: 5, ageWeeks: 1 }),
    ];
    const row = personalizeRows(ROWS, entries, { now: NOW }).find(
      (r) => r.source.kind === 'category',
    );

    expect(row?.title).toBe('Vì bạn đã xem Xem Hết');
  });

  it('không sửa mảng hay row nào của đầu vào', () => {
    const before = JSON.stringify(ROWS);
    personalizeRows(ROWS, [entry('a', { categories: ['hanh-dong'], name: 'X' })], { now: NOW });

    expect(JSON.stringify(ROWS)).toBe(before);
  });
});

describe('Danh sách của tôi làm tín hiệu thứ hai', () => {
  it('phim đã lưu cũng góp điểm, nhẹ hơn phim đã xem', () => {
    const watched = tasteScores([entry('a', { categories: ['x'] })], { now: NOW }).get(
      'category:x',
    );
    const saved = tasteScores([], { listed: [listed({ categories: ['x'] })], now: NOW }).get(
      'category:x',
    );

    expect(saved).toBeGreaterThan(0);
    expect(saved).toBeLessThan(watched ?? 0);
  });

  /** Người mới: chưa xem gì nhưng đã lưu vài phim — trang chủ vẫn nói được gì đó. */
  it('chưa xem gì mà đã lưu phim thì vẫn sắp lại row', () => {
    const ids = personalizeRows(ROWS, [], {
      listed: [listed({ categories: ['kinh-di'] }), listed({ categories: ['kinh-di'] })],
      now: NOW,
    }).map((r) => r.id);

    expect(ids[0]).toBe('category-kinh-di');
  });

  it('entry cũ chưa có taxonomy thì không bịa ra phiếu bầu nào', () => {
    const scores = tasteScores([], { listed: [{ addedAt: NOW }], now: NOW });
    expect(scores.size).toBe(0);
  });

  it('phim lưu lâu rồi nhạt hơn phim vừa lưu', () => {
    const fresh = tasteScores([], { listed: [listed({ categories: ['x'] })], now: NOW });
    const old = tasteScores([], {
      listed: [listed({ categories: ['x'], ageWeeks: 20 })],
      now: NOW,
    });

    expect(old.get('category:x')).toBeLessThan(fresh.get('category:x') ?? 0);
  });

  /**
   * "Vì bạn đã xem X" buộc phải nói về một phim ĐÃ XEM. Thể loại đứng đầu có thể đến
   * hoàn toàn từ phim đã lưu mà chưa xem — khi đó phải đi tiếp xuống thể loại sau,
   * chứ không để cả dòng tiêu đề đó lặng lẽ biến mất.
   */
  it('thể loại đứng đầu chỉ đến từ phim đã lưu thì tiêu đề lấy thể loại kế tiếp', () => {
    const rows = personalizeRows(
      ROWS,
      [entry('w', { categories: ['hanh-dong'], name: 'Đã Xem' })],
      {
        listed: [
          listed({ categories: ['kinh-di'] }),
          listed({ categories: ['kinh-di'] }),
          listed({ categories: ['kinh-di'] }),
        ],
        now: NOW,
      },
    );

    // "Kinh dị" thắng điểm và lên đầu, nhưng tiêu đề "Vì bạn đã xem" nói về phim đã xem.
    expect(rows[0]?.id).toBe('category-kinh-di');
    expect(rows.find((r) => r.title.startsWith('Vì bạn đã xem'))?.title).toBe(
      'Vì bạn đã xem Đã Xem',
    );
  });
});

describe('personalizeRows — row trang chủ hiện tại', () => {
  /** Đúng thứ tự `LAZY_ROWS` của `app/page.tsx`. */
  const HOME_ROWS: TasteRow[] = [
    { id: 'type-phim-bo', title: 'Phim bộ', source: { kind: 'type', type: 'phim-bo' }, href: '/a' },
    {
      id: 'type-phim-chieu-rap',
      title: 'Phim chiếu rạp',
      source: { kind: 'type', type: 'phim-chieu-rap' },
      href: '/b',
    },
    { id: 'type-phim-le', title: 'Phim lẻ', source: { kind: 'type', type: 'phim-le' }, href: '/c' },
    {
      id: 'type-hoat-hinh',
      title: 'Hoạt hình',
      source: { kind: 'type', type: 'hoat-hinh' },
      href: '/d',
    },
  ];

  /**
   * Row poster cao hơn các row khác, mà `PersonalizedRows` giữ khung theo VỊ TRÍ:
   * nó dời vào chỗ 0 — chỗ duy nhất có thể đang ló trong màn đầu — là khung ở đó
   * đổi hình ngay trước mắt người xem. Không sở thích nào được đưa nó lên đó.
   */
  it('"Phim chiếu rạp" không bao giờ lên chỗ đầu', () => {
    const tastes: MovieType[] = ['single', 'hoathinh', 'series', 'tvshows'];

    for (const type of tastes) {
      const entries = [entry('a', { type, finished: 3 }), entry('b', { type, finished: 3 })];
      const ids = personalizeRows(HOME_ROWS, entries, { now: NOW }).map((r) => r.id);

      expect(ids[0]).not.toBe('type-phim-chieu-rap');
    }
  });
});
