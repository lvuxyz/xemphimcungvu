import { describe, expect, it, vi } from 'vitest';
import { WATCH_INDEX_LIMIT, WATCH_PROGRESS_TTL_DAYS } from '@/lib/constants';
import type { WatchSnapshot } from '@/lib/storage';

/**
 * Index tiến độ xem tồn tại vì MỘT lý do: số lượt chạm localStorage đồng bộ trên
 * main thread. Nên phần lớn test ở đây ĐẾM số lượt đọc, không chỉ kiểm dữ liệu
 * ra đúng — "đúng nhưng vẫn quét 200 key" là hỏng đúng cái đang sửa.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** localStorage giả, đủ cho `lib/storage.ts` chạy trong môi trường `node`. */
function fakeStorage() {
  const data = new Map<string, string>();
  const calls = { get: 0, set: 0, key: 0 };

  const store = {
    get length() {
      return data.size;
    },
    key(i: number) {
      calls.key++;
      return [...data.keys()][i] ?? null;
    },
    getItem(k: string) {
      calls.get++;
      return data.get(k) ?? null;
    },
    setItem(k: string, v: string) {
      calls.set++;
      data.set(k, v);
    },
    removeItem(k: string) {
      data.delete(k);
    },
    clear() {
      data.clear();
    },
  };

  return { store, data, calls, reset: () => ((calls.get = 0), (calls.set = 0), (calls.key = 0)) };
}

/**
 * `lib/storage.ts` giữ index trong RAM cho cả phiên — đúng điều khiến nó nhanh,
 * và cũng là lý do mỗi test phải nhận một module mới.
 */
async function freshModule(seed: Record<string, unknown> = {}) {
  const fake = fakeStorage();
  for (const [key, value] of Object.entries(seed)) fake.data.set(key, JSON.stringify(value));

  const listeners: Record<string, ((event: { key: string | null }) => void)[]> = {};

  vi.stubGlobal('window', {
    localStorage: fake.store,
    addEventListener(type: string, fn: (event: { key: string | null }) => void) {
      (listeners[type] ??= []).push(fn);
    },
  });
  vi.resetModules();
  const storage = await import('@/lib/storage');

  fake.reset();

  /** Giả lập một tab KHÁC vừa ghi vào storage. */
  const emitStorage = (key: string | null) =>
    (listeners['storage'] ?? []).forEach((fn) => fn({ key }));

  return { storage, emitStorage, ...fake };
}

const progress = (position: number, duration: number, ageDays = 0) => ({
  position,
  duration,
  updatedAt: Date.now() - ageDays * DAY_MS,
});

const snapshot = (name: string): WatchSnapshot => ({
  name,
  originName: `${name} origin`,
  poster: 'https://phimimg.com/p.jpg',
  thumb: 'https://phimimg.com/t.jpg',
  year: 2026,
  quality: 'FHD',
  episodeCurrent: 'Tập 12',
  episodeName: 'Tập 5',
  type: 'series',
  categories: ['hanh-dong', 'phieu-luu'],
  countries: ['han-quoc'],
});

describe('gom key tiến độ cũ vào index', () => {
  it('dựng một entry cho mỗi PHIM, mới nhất trước', async () => {
    const { storage } = await freshModule({
      'watch:phim-a:tap-01': progress(120, 1400, 3),
      'watch:phim-a:tap-02': progress(60, 1400, 1),
      'watch:phim-b:tap-01': progress(300, 2000, 2),
    });

    const entries = storage.readWatchIndex();

    expect(entries.map((e) => e.slug)).toEqual(['phim-a', 'phim-b']);
    // Tập xem gần nhất của phim A là tập 2, không phải tập 1.
    expect(entries[0]?.lastEp).toBe('tap-02');
    expect(Object.keys(entries[0]?.eps ?? {})).toHaveLength(2);
    // Key cũ không mang theo snapshot — nó được bù ở lượt ghi đầu từ trang phát.
    expect(entries[0]?.snapshot).toBeNull();
  });

  it('ghi index xuống storage ngay, để lần khởi động sau không quét nữa', async () => {
    const { storage, data, calls } = await freshModule({
      'watch:phim-a:tap-01': progress(120, 1400),
    });

    storage.readWatchIndex();
    expect(data.has('watch-index')).toBe(true);

    const keyCalls = calls.key;
    storage.readWatchIndex();
    // Lượt sau lấy từ RAM: không quét thêm một key nào.
    expect(calls.key).toBe(keyCalls);
  });

  /**
   * Cái bẫy của chính thiết kế này: đặt index là `watch:index` thì vòng quét
   * theo tiền tố `watch:` bên trên coi nó là một key tiến độ, thấy `updatedAt`
   * không hợp lệ rồi xoá sạch. Tên `watch-index` là để tránh đúng chuyện đó.
   */
  it('không tự xoá chính index trong lúc quét', async () => {
    const { storage, data } = await freshModule({
      'watch:phim-a:tap-01': progress(120, 1400),
    });

    storage.readWatchIndex();
    storage.pruneWatchProgress();

    expect(data.has('watch-index')).toBe(true);
    expect(storage.readWatchIndex()).toHaveLength(1);
  });

  it('bỏ key rác và key quá hạn', async () => {
    const { storage, data } = await freshModule({
      'watch:phim-a:tap-01': progress(120, 1400),
      'watch:phim-cu:tap-01': progress(120, 1400, WATCH_PROGRESS_TTL_DAYS + 5),
      'watch:khong-co-tap': { position: 1, duration: 2, updatedAt: Date.now() },
    });

    expect(storage.readWatchIndex().map((e) => e.slug)).toEqual(['phim-a']);
    expect(data.has('watch:phim-cu:tap-01')).toBe(false);
    expect(data.has('watch:khong-co-tap')).toBe(false);
  });
});

describe('pruneWatchProgress', () => {
  /** Đây là phép đo của cả bước này: dọn dẹp KHÔNG được quét localStorage nữa. */
  it('không quét toàn bộ localStorage khi đã có index', async () => {
    const now = Date.now();
    const { storage, calls } = await freshModule({
      'watch-index': {
        v: 1,
        entries: [
          {
            slug: 'phim-a',
            lastEp: 'tap-02',
            eps: { 'tap-02': [60, 1400, now] },
            updatedAt: now,
            snapshot: null,
          },
        ],
      },
      'watch:phim-a:tap-02': progress(60, 1400),
    });

    storage.pruneWatchProgress();

    expect(calls.key).toBe(0);
    expect(storage.readWatchIndex()).toHaveLength(1);
  });

  it('xoá tập quá hạn nhưng giữ phim còn tập trong hạn', async () => {
    const { storage, data } = await freshModule({
      'watch:phim-a:tap-01': progress(120, 1400, WATCH_PROGRESS_TTL_DAYS + 1),
      'watch:phim-a:tap-09': progress(30, 1400, 1),
    });

    // Đọc index trước khi hết hạn được tính, để prune là chỗ duy nhất dọn.
    expect(storage.readWatchIndex()).toHaveLength(1);

    storage.pruneWatchProgress();

    expect(data.has('watch:phim-a:tap-01')).toBe(false);
    expect(data.has('watch:phim-a:tap-09')).toBe(true);
    expect(Object.keys(storage.readWatchIndex()[0]?.eps ?? {})).toEqual(['tap-09']);
  });
});

describe('setWatchProgress', () => {
  it('ghi cả key rời và index, rồi đọc lại được từ cả hai đường', async () => {
    const { storage, data } = await freshModule();

    storage.setWatchProgress('phim-a', 'tap-03', 420, 1400, snapshot('Phim A'));

    expect(data.has('watch:phim-a:tap-03')).toBe(true);
    expect(storage.getWatchProgress('phim-a', 'tap-03')?.position).toBe(420);
    expect(storage.getMovieProgress('phim-a')['tap-03']).toBeCloseTo(0.3);
    expect(storage.readWatchIndex()[0]?.snapshot?.name).toBe('Phim A');
  });

  it('giữ snapshot cũ khi lượt ghi sau không mang snapshot', async () => {
    const { storage } = await freshModule();

    storage.setWatchProgress('phim-a', 'tap-01', 100, 1400, snapshot('Phim A'));
    storage.setWatchProgress('phim-a', 'tap-02', 50, 1400);

    const entry = storage.readWatchIndex()[0];
    expect(entry?.lastEp).toBe('tap-02');
    expect(entry?.snapshot?.name).toBe('Phim A');
  });

  it('cắt index về trần và dọn luôn key của phim bị loại', async () => {
    const { storage, data } = await freshModule();

    for (let i = 0; i < WATCH_INDEX_LIMIT + 2; i++) {
      storage.setWatchProgress(`phim-${i}`, 'tap-01', 10, 1400);
    }

    const entries = storage.readWatchIndex();
    expect(entries).toHaveLength(WATCH_INDEX_LIMIT);
    // Mới nhất trước → hai phim đầu tiên là hai phim bị loại.
    expect(entries.some((e) => e.slug === 'phim-0')).toBe(false);
    expect(data.has('watch:phim-0:tap-01')).toBe(false);
  });
});

describe('markCompleted', () => {
  /**
   * Tín hiệu sở thích mạnh nhất từng tự xoá chính nó: xem xong là key tiến độ bị
   * dọn, nên xem hết một bộ là bộ đó biến mất sạch khỏi index.
   */
  it('giữ entry lại sau khi xem xong tập cuối, với số tập đã xong', async () => {
    const { storage, data } = await freshModule();

    storage.setWatchProgress('phim-a', 'tap-01', 100, 1400, snapshot('Phim A'));
    storage.markCompleted('phim-a', 'tap-01');

    const entry = storage.readWatchIndex()[0];
    expect(entry?.slug).toBe('phim-a');
    expect(entry?.finished).toBe(1);
    expect(Object.keys(entry?.eps ?? {})).toEqual([]);
    // Key tiến độ của tập đã xong thì không cần nữa.
    expect(data.has('watch:phim-a:tap-01')).toBe(false);
    // Nhưng snapshot — tức cả taxonomy để tính sở thích — vẫn còn.
    expect(entry?.snapshot?.name).toBe('Phim A');
  });

  it('cộng dồn qua từng tập, và vẫn giữ tập khác đang xem dở', async () => {
    const { storage } = await freshModule();

    storage.setWatchProgress('phim-a', 'tap-01', 100, 1400, snapshot('Phim A'));
    storage.setWatchProgress('phim-a', 'tap-02', 100, 1400);
    storage.markCompleted('phim-a', 'tap-01');
    storage.markCompleted('phim-a', 'tap-03');

    const entry = storage.readWatchIndex()[0];
    expect(entry?.finished).toBe(2);
    expect(Object.keys(entry?.eps ?? {})).toEqual(['tap-02']);
    expect(entry?.lastEp).toBe('tap-02');
  });

  it('"Xem từ đầu" ở tập cuối không được xoá tín hiệu của cả bộ', async () => {
    const { storage } = await freshModule();

    storage.setWatchProgress('phim-a', 'tap-01', 100, 1400, snapshot('Phim A'));
    storage.markCompleted('phim-a', 'tap-01');
    storage.setWatchProgress('phim-a', 'tap-02', 100, 1400);
    storage.clearWatchProgress('phim-a', 'tap-02');

    expect(storage.readWatchIndex()[0]?.finished).toBe(1);
  });

  it('entry đã xem xong vẫn sống qua prune cho tới khi chính nó quá hạn', async () => {
    const now = Date.now();
    const fresh = await freshModule({
      'watch-index': {
        v: 1,
        entries: [
          {
            slug: 'phim-a',
            lastEp: 'tap-01',
            eps: {},
            updatedAt: now,
            finished: 3,
            snapshot: null,
          },
          {
            slug: 'phim-cu',
            lastEp: 'tap-01',
            eps: {},
            updatedAt: now - (WATCH_PROGRESS_TTL_DAYS + 1) * DAY_MS,
            finished: 3,
            snapshot: null,
          },
        ],
      },
    });

    fresh.storage.pruneWatchProgress();

    expect(fresh.storage.readWatchIndex().map((e) => e.slug)).toEqual(['phim-a']);
  });
});

describe('forgetMovie', () => {
  it('xoá cả entry và mọi key tập của phim đó', async () => {
    const { storage, data } = await freshModule({
      'watch:phim-a:tap-01': progress(700, 1400),
      'watch:phim-a:tap-05': progress(100, 1400),
      'watch:phim-b:tap-01': progress(100, 1400),
    });

    storage.forgetMovie('phim-a');

    expect(storage.readWatchIndex().map((e) => e.slug)).toEqual(['phim-b']);
    expect(data.has('watch:phim-a:tap-01')).toBe(false);
    expect(data.has('watch:phim-a:tap-05')).toBe(false);
    expect(data.has('watch:phim-b:tap-01')).toBe(true);
  });

  it('phim không có trong index thì không làm gì', async () => {
    const { storage } = await freshModule({ 'watch:phim-a:tap-01': progress(700, 1400) });

    expect(() => storage.forgetMovie('khong-ton-tai')).not.toThrow();
    expect(storage.readWatchIndex()).toHaveLength(1);
  });
});

describe('getMovieProgress', () => {
  it('trả tỉ lệ của mọi tập đã xem trong phim, không chạm storage ở lượt sau', async () => {
    const { storage, calls } = await freshModule({
      'watch:phim-a:tap-01': progress(700, 1400),
      'watch:phim-a:tap-02': progress(1400, 1400),
      'watch:phim-b:tap-01': progress(100, 1400),
    });

    expect(storage.getMovieProgress('phim-a')).toEqual({ 'tap-01': 0.5, 'tap-02': 1 });

    calls.get = 0;
    expect(storage.getMovieProgress('phim-a')['tap-01']).toBe(0.5);
    // Cả sidebar 40 tập giờ tốn 0 lượt đọc, thay vì 40.
    expect(calls.get).toBe(0);
  });

  it('phim chưa xem thì rỗng, không phải undefined', async () => {
    const { storage } = await freshModule();
    expect(storage.getMovieProgress('chua-xem')).toEqual({});
  });
});

describe('clearWatchProgress', () => {
  it('xoá tập và lùi lastEp về tập gần nhất còn lại', async () => {
    const { storage } = await freshModule();

    storage.setWatchProgress('phim-a', 'tap-01', 100, 1400);
    storage.setWatchProgress('phim-a', 'tap-02', 50, 1400);
    storage.clearWatchProgress('phim-a', 'tap-02');

    const entry = storage.readWatchIndex()[0];
    expect(Object.keys(entry?.eps ?? {})).toEqual(['tap-01']);
    expect(entry?.lastEp).toBe('tap-01');
  });

  it('hết tập dở dang thì phim rời index', async () => {
    const { storage, data } = await freshModule();

    storage.setWatchProgress('phim-a', 'tap-01', 100, 1400);
    storage.clearWatchProgress('phim-a', 'tap-01');

    expect(storage.readWatchIndex()).toHaveLength(0);
    expect(data.has('watch:phim-a:tap-01')).toBe(false);
  });
});

describe('cache trong RAM', () => {
  /**
   * Hai tab cùng xem: tab kia ghi index, tab này phải bỏ bản cũ. Không bỏ thì
   * lượt ghi kế tiếp của tab này ghi đè, và phim tab kia vừa xem biến mất khỏi
   * "Tiếp tục xem".
   */
  it('bỏ cache khi tab khác ghi index', async () => {
    const { storage, data, emitStorage } = await freshModule();

    storage.setWatchProgress('phim-a', 'tap-01', 10, 1400);
    expect(storage.readWatchIndex().map((e) => e.slug)).toEqual(['phim-a']);

    // Tab khác thêm phim B rồi phát tín hiệu.
    const other = JSON.parse(data.get('watch-index') as string);
    other.entries.unshift({
      slug: 'phim-b',
      lastEp: 'tap-01',
      eps: { 'tap-01': [20, 1400, Date.now() + 1000] },
      updatedAt: Date.now() + 1000,
      snapshot: null,
    });
    data.set('watch-index', JSON.stringify(other));
    emitStorage('watch-index');

    expect(storage.readWatchIndex().map((e) => e.slug)).toEqual(['phim-b', 'phim-a']);

    // Và lượt ghi sau của tab này KHÔNG được xoá phim B.
    storage.setWatchProgress('phim-a', 'tap-02', 30, 1400);
    expect(storage.readWatchIndex().map((e) => e.slug)).toContain('phim-b');
  });

  /** Row "Tiếp tục xem" giữ entry trong React state và so bằng tham chiếu. */
  it('không sửa entry đã trả ra trước đó', async () => {
    const { storage } = await freshModule();

    storage.setWatchProgress('phim-a', 'tap-01', 100, 1400);
    const before = storage.readWatchIndex()[0];

    storage.setWatchProgress('phim-a', 'tap-02', 200, 1400);
    const after = storage.readWatchIndex()[0];

    expect(before).not.toBe(after);
    expect(before?.lastEp).toBe('tap-01');
    expect(Object.keys(before?.eps ?? {})).toEqual(['tap-01']);
    expect(after?.lastEp).toBe('tap-02');
  });
});

describe('cờ cá nhân hoá', () => {
  it('chưa có key nghĩa là BẬT', async () => {
    const { storage } = await freshModule();
    expect(storage.getPersonalized()).toBe(true);
  });

  it('tắt rồi bật lại, và KHÔNG xoá gì của tiến độ xem', async () => {
    const { storage, data } = await freshModule();
    storage.setWatchProgress('phim-a', 'tap-01', 420, 1400, snapshot('Phim A'));

    storage.setPersonalized(false);
    expect(storage.getPersonalized()).toBe(false);
    // Tắt là không ĐEM RA hiện, không phải xoá: index và key tập còn nguyên.
    expect(storage.readWatchIndex()).toHaveLength(1);
    expect(data.has('watch:phim-a:tap-01')).toBe(true);

    storage.setPersonalized(true);
    expect(storage.getPersonalized()).toBe(true);
  });

  it('chỉ đúng giá trị `false` mới tắt — rác thì coi như bật', async () => {
    const { storage, data } = await freshModule();
    data.set('personalized', 'không-phải-json');
    expect(storage.getPersonalized()).toBe(true);
  });
});

describe('storage không dùng được', () => {
  /** Safari private mode: mọi lời gọi ném exception ngay từ lượt thăm dò. */
  it('không ném lỗi, chỉ trả về rỗng', async () => {
    vi.stubGlobal('window', {
      get localStorage(): Storage {
        throw new Error('SecurityError');
      },
    });
    vi.resetModules();
    const storage = await import('@/lib/storage');

    expect(() => storage.setWatchProgress('phim-a', 'tap-01', 10, 100)).not.toThrow();
    expect(storage.readWatchIndex()).toEqual([]);
    expect(storage.getWatchProgress('phim-a', 'tap-01')).toBeNull();
    expect(storage.pruneWatchProgress()).toBe(0);
  });
});
