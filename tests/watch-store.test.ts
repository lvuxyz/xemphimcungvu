import { describe, expect, it, vi } from 'vitest';
import { PLAYER } from '@/lib/constants';
import type { WatchIndexEntry, WatchSnapshot } from '@/lib/storage';
import { resumePoint } from '@/store/useWatchStore';
import type { WatchSnapshot as Snapshot } from '@/lib/storage';

/**
 * `resumePoint` là chỗ ba nơi phải đồng ý với nhau: nút hero, row "Tiếp tục xem",
 * và script chừa chỗ chạy trước lượt vẽ đầu. Nó nói "có" mà script nói "không" thì
 * chỗ chừa xẹp lại giữa lúc trang đang dựng; ngược lại thì hero mời xem tiếp một
 * tập trình phát sẽ mở từ đầu.
 */

const snapshot: WatchSnapshot = {
  name: 'Phim A',
  originName: 'Movie A',
  poster: '',
  thumb: '',
  year: 2026,
  quality: 'FHD',
  episodeCurrent: 'Tập 10',
  episodeName: 'Tập 03',
  type: 'series',
  categories: ['hanh-dong'],
  countries: ['han-quoc'],
};

const entry = (position: number, duration = 1400, lastEp = 'tap-03'): WatchIndexEntry => ({
  slug: 'phim-a',
  lastEp,
  eps: { [lastEp]: [position, duration, Date.now()] },
  updatedAt: Date.now(),
  finished: 0,
  snapshot,
});

describe('resumePoint', () => {
  it('trả mốc để mở lại, kèm thời gian còn lại và tỉ lệ', () => {
    const point = resumePoint(entry(420, 1400));

    expect(point).toEqual({ ep: 'tap-03', position: 420, remaining: 980, ratio: 0.3 });
  });

  it('không có entry thì không có gì để tiếp tục', () => {
    expect(resumePoint(undefined)).toBeNull();
  });

  /**
   * Trình phát ghi lượt đầu ngay ở `timeupdate` đầu tiên (~0.2s), nên không có
   * ngưỡng này thì MỌI tập từng mở đều thành "đang xem".
   */
  it('bỏ qua tập mới mở vài giây', () => {
    expect(resumePoint(entry(PLAYER.resumeMinPosition))).toBeNull();
    expect(resumePoint(entry(PLAYER.resumeMinPosition + 0.5))).not.toBeNull();
  });

  it('bỏ qua tập không biết độ dài — không tính được tỉ lệ thì không vẽ được vạch', () => {
    expect(resumePoint(entry(420, 0))).toBeNull();
  });

  it('tập nào không có trong `eps` thì `lastEp` cũng vô nghĩa', () => {
    const broken: WatchIndexEntry = { ...entry(420), lastEp: 'tap-99' };
    expect(resumePoint(broken)).toBeNull();
  });

  /** Vị trí vượt quá độ dài (đổi nguồn phát, độ dài lệch) không được ra tỉ lệ > 1. */
  it('kẹp tỉ lệ ở 1', () => {
    expect(resumePoint(entry(2000, 1400))?.ratio).toBe(1);
    expect(resumePoint(entry(2000, 1400))?.remaining).toBe(0);
  });
});

/**
 * localStorage giả + module mới, để chạm được vào store thật trong môi trường `node`.
 * Xem `tests/storage.test.ts` về việc vì sao phải là module mới mỗi lần.
 */
async function freshStore() {
  const data = new Map<string, string>();
  const store = {
    get length() {
      return data.size;
    },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  };

  vi.stubGlobal('window', { localStorage: store, addEventListener: () => {} });
  vi.resetModules();

  const storage = await import('@/lib/storage');
  const { useWatchStore } = await import('@/store/useWatchStore');
  return { storage, useWatchStore, data };
}

/**
 * Tắt cá nhân hoá được ép ở đúng một chỗ — `entries` về rỗng — nên mọi mặt hiển thị
 * tự tắt theo mà không nơi nào phải tự kiểm cờ. Đây là test giữ lấy tính chất đó.
 */
describe('tắt cá nhân hoá', () => {
  it('rút hết entry khỏi store, và bật lại thì còn nguyên', async () => {
    const { storage, useWatchStore } = await freshStore();

    storage.setWatchProgress('phim-a', 'tap-01', 420, 1400, snapshot as Snapshot);
    useWatchStore.getState().refresh();
    expect(useWatchStore.getState().entries).toHaveLength(1);

    useWatchStore.getState().setPersonalized(false);
    expect(useWatchStore.getState().personalized).toBe(false);
    expect(useWatchStore.getState().entries).toEqual([]);

    useWatchStore.getState().setPersonalized(true);
    expect(useWatchStore.getState().entries).toHaveLength(1);
  });

  it('`refresh` sau khi tải lại trang vẫn tôn trọng cờ đã tắt', async () => {
    const { storage, useWatchStore } = await freshStore();

    storage.setWatchProgress('phim-a', 'tap-01', 420, 1400, snapshot as Snapshot);
    storage.setPersonalized(false);

    // Như lượt khởi động mới: store còn mặc định, `AppBootstrap` gọi refresh.
    useWatchStore.getState().refresh();

    expect(useWatchStore.getState().personalized).toBe(false);
    expect(useWatchStore.getState().entries).toEqual([]);
  });
});
