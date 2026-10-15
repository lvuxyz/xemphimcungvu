import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import shapeC from './fixtures/shape-c-phim-slug.json';

/**
 * Các link tra cứu là cửa vào từ BÊN NGOÀI (link TMDB/IMDB, link `/xem/{slug}`
 * không kèm tập). Đặt `redirect()`/`notFound()` trong page thì chúng chạy SAU khi
 * `app/loading.tsx` đã đẩy shell kèm status 200 đi — người nhận chỉ thấy 200 và một
 * meta refresh, nên preview link (Facebook, Zalo…) hiện trang trống. Middleware
 * quyết định trước khi render, nên status là thật.
 */

const BASE = 'http://localhost:3000';

const run = (path: string) => middleware(new NextRequest(BASE + path));

/** fetch giả: URL chứa `hit` → phim fixture; còn lại → 404 như API thật. */
function stubApi(hit: string) {
  const fetchMock = vi.fn(async (url: string | URL) =>
    String(url).includes(hit)
      ? new Response(JSON.stringify(shapeC), { status: 200 })
      : new Response(JSON.stringify({ status: false, msg: 'hmmm!' }), { status: 404 }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const location = (res: Response) => res.headers.get('location')?.replace(BASE, '');
const rewrittenTo = (res: Response) => res.headers.get('x-middleware-rewrite')?.replace(BASE, '');

describe('middleware — link tra cứu trả status thật', () => {
  it.each([
    ['/tmdb/tv/324931', '/tmdb/tv/324931'],
    ['/imdb/title/tt0000001', '/imdb/title/tt0000001'],
    ['/phim/id/863e3c95bb7bb455d9da4e2b056948d1', '/phim/id/863e3c95bb7bb455d9da4e2b056948d1'],
  ])('%s tìm thấy → 307 về /phim/{slug}', async (path, apiPath) => {
    const fetchMock = stubApi(apiPath);
    const res = await run(path);

    expect(res.status).toBe(307);
    expect(location(res)).toBe('/phim/trai-tim-cua-ke-ky-sinh');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(apiPath);
  });

  it.each(['/tmdb/movie/999999999', '/imdb/title/xx', '/phim/id/zzz'])(
    '%s không có phim → rewrite sang trang 404',
    async (path) => {
      stubApi('__never__');
      const res = await run(path);

      expect(res.status).not.toBe(307);
      expect(rewrittenTo(res)).toBe('/_khong-tim-thay');
    },
  );

  it('/tmdb/{loại lạ}/… → 404 mà không gọi API', async () => {
    const fetchMock = stubApi('__never__');
    const res = await run('/tmdb/abc/1');

    expect(rewrittenTo(res)).toBe('/_khong-tim-thay');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('API lỗi mạng → để page tự xử lý như cũ, không bịa ra 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );
    const res = await run('/tmdb/movie/1058424');

    expect(res.headers.get('x-middleware-next')).toBe('1');
    expect(rewrittenTo(res)).toBeUndefined();
  });

  it('/xem/{slug}/{tập} — trang phát thật — đi thẳng, không bị đụng tới', async () => {
    const fetchMock = stubApi('__never__');
    const res = await run('/xem/vung-tu-dia/tap-01');

    expect(res.headers.get('x-middleware-next')).toBe('1');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('/xem/{slug} → 307 về tập đầu, không cần API', async () => {
    const fetchMock = stubApi('__never__');
    const res = await run('/xem/vung-tu-dia');

    expect(res.status).toBe(307);
    expect(location(res)).toBe('/xem/vung-tu-dia/1');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

/**
 * Trang 404 dựng sẵn của Next (`/_not-found`) có cây router KHÔNG có slot `modal`,
 * trong khi root layout có `@modal`. Prefetch link nav từ trang đó gửi cây ấy lên,
 * và Next 14.2 đọc `flightRouterState[1].modal[0]` khi slot đích rơi về
 * `default.tsx` → TypeError, 500 cho từng link, rồi rơi về tải lại cả trang.
 *
 * Request dựng ở đây CHỈ có `Next-Url`: đó là tất cả những gì middleware thật nhìn
 * thấy. Next gỡ `RSC`, `Next-Router-State-Tree`, `Next-Router-Prefetch` khỏi
 * request trước khi đưa cho middleware rồi gắn lại sau — test từng dựng đủ cả bộ
 * header thì xanh, trong khi server thật vẫn 500.
 */
describe('middleware — request RSC từ trang 404', () => {
  const fromPage = (nextUrl: string) =>
    middleware(new NextRequest(BASE + '/danh-sach/phim-bo', { headers: { 'Next-Url': nextUrl } }));

  it('từ trang 404 → 204, client tự rơi về tải trang thường thay vì nhận 500', async () => {
    const res = await fromPage('/_not-found');

    expect(res.status).toBe(204);
    expect(res.headers.get('x-middleware-next')).toBeNull();
  });

  it('từ trang thường → đi thẳng, không bị đụng tới', async () => {
    const res = await fromPage('/');

    expect(res.headers.get('x-middleware-next')).toBe('1');
  });
});
