import { describe, expect, it } from 'vitest';
import { isDetailPath, routes } from '@/lib/routes';

/**
 * `isDetailPath` là chốt chặn của modal chi tiết: sai một ly ở đây thì modal
 * hoặc dính lại trên trang phát, hoặc biến mất ngay trên chính trang của nó.
 */
describe('isDetailPath', () => {
  it('nhận đúng trang chi tiết một phim', () => {
    expect(isDetailPath('/phim/doc-kiem-cuu-thien')).toBe(true);
    expect(isDetailPath(routes.detail('te-cong-hang-long-tru-yeu'))).toBe(true);
  });

  it('từ chối mọi route khác — đây là lúc modal phải tự tháo', () => {
    expect(isDetailPath('/')).toBe(false);
    expect(isDetailPath('/xem/doc-kiem-cuu-thien/tap-01')).toBe(false);
    expect(isDetailPath('/tim-kiem')).toBe(false);
    expect(isDetailPath('/danh-sach/phim-bo')).toBe(false);
  });

  it('từ chối `/phim` trần và `/phim/` rỗng', () => {
    expect(isDetailPath('/phim')).toBe(false);
    expect(isDetailPath('/phim/')).toBe(false);
  });

  /** `/phim/id/{id}` khớp tiền tố nhưng là route tra cứu rồi redirect. */
  it('từ chối các route con sâu hơn một đoạn', () => {
    expect(isDetailPath('/phim/id/12345')).toBe(false);
    expect(isDetailPath('/phim/doc-kiem-cuu-thien/tap-01')).toBe(false);
  });

  /** Tên route khác chỉ tình cờ bắt đầu bằng cùng mấy chữ cái. */
  it('không khớp nhầm route có tiền tố giống', () => {
    expect(isDetailPath('/phimhay/abc')).toBe(false);
  });
});
