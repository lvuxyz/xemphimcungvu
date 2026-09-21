import { describe, expect, it } from 'vitest';
import { PLAYER } from '@/lib/constants';
import type { WatchIndexEntry, WatchSnapshot } from '@/lib/storage';
import { resumePoint } from '@/store/useWatchStore';

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
