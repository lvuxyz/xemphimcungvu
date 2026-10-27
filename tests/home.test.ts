import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { ROW_LIMIT } from '@/lib/constants';
import { HERO_CANDIDATES } from '@/lib/endpoints';
import {
  HOME_SECTIONS,
  HOME_SHOWN,
  SECTION_FETCH_LIMIT,
  THEATRICAL_SECTION,
  excludeShown,
  fetchHomeSection,
  homeFirstRow,
  homeSectionLayout,
  homeSectionOf,
  isHomeSection,
  toCardMovie,
} from '@/lib/home';
import { MAX_LIMIT } from '@/types/filters';
import { normalizeList } from '@/lib/normalize';
import { GET } from '@/app/api/home/[section]/route';

import shapeB from './fixtures/shape-b-v1-danh-sach.json';

/**
 * Trang chủ chỉ tải đúng thứ card cần. Ba chỗ dễ vỡ lặng lẽ nhất được chặn ở đây:
 * payload phình lại (field mới lọt qua `toCardMovie`), route thành proxy mở (nhận
 * section ngoài whitelist), và số phim mỗi section vượt `ROW_LIMIT`.
 */

const CARD_KEYS = [
  'categories',
  'countries',
  'duration',
  'episodeCurrent',
  'id',
  'imdb',
  'name',
  'originName',
  'poster',
  'quality',
  'slug',
  'thumb',
  'tmdb',
  'type',
  'year',
];

const movies = normalizeList(shapeB).items;

function mockFetch(body: unknown, init: ResponseInit = {}) {
  const fn = vi.fn(async () => Response.json(body, init));
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('toCardMovie', () => {
  it('chỉ giữ đúng các field card đọc', () => {
    const card = toCardMovie(movies[0]!);

    expect(Object.keys(card).sort()).toEqual(CARD_KEYS);
    expect(Object.keys(card.tmdb).sort()).toEqual(['vote_average', 'vote_count']);
    expect(Object.keys(card.imdb).sort()).toEqual(['vote_average', 'vote_count']);
    for (const taxonomy of [...card.categories, ...card.countries]) {
      expect(Object.keys(taxonomy).sort()).toEqual(['name', 'slug']);
    }
  });

  it('không đổi giá trị nào card hiển thị', () => {
    const movie = movies[0]!;
    const card = toCardMovie(movie);

    expect(card).toMatchObject({
      slug: movie.slug,
      name: movie.name,
      thumb: movie.thumb,
      poster: movie.poster,
      year: movie.year,
      episodeCurrent: movie.episodeCurrent,
    });
    expect(card.categories.map((c) => c.slug)).toEqual(movie.categories.map((c) => c.slug));
  });

  it('gọi lại trên chính kết quả của nó thì không đổi gì', () => {
    const card = toCardMovie(movies[0]!);
    expect(toCardMovie(card)).toEqual(card);
  });

  it('nhẹ hơn hẳn `Movie` đầy đủ', () => {
    const full = JSON.stringify(movies).length;
    const trimmed = JSON.stringify(movies.map(toCardMovie)).length;
    expect(trimmed).toBeLessThan(full * 0.8);
  });
});

describe('section trang chủ', () => {
  it('đúng bốn section lazy, đều lọc ở phía API', () => {
    expect([...HOME_SECTIONS]).toEqual(['phim-bo', 'phim-chieu-rap', 'phim-le', 'hoat-hinh']);
  });

  it('chỉ "Phim chiếu rạp" là row poster', () => {
    expect(HOME_SECTIONS.filter((s) => homeSectionLayout(s) === 'poster')).toEqual([
      THEATRICAL_SECTION,
    ]);
  });

  it('ánh xạ nguồn danh sách → section', () => {
    expect(homeSectionOf({ kind: 'type', type: 'phim-bo' })).toBe('phim-bo');
    expect(homeSectionOf({ kind: 'type', type: 'hoat-hinh' })).toBe('hoat-hinh');
    expect(homeSectionOf({ kind: 'type', type: 'phim-chieu-rap' })).toBe('phim-chieu-rap');
    // Không còn trên trang chủ → không có route cache
    expect(homeSectionOf({ kind: 'type', type: 'tv-shows' })).toBeNull();
    expect(homeSectionOf({ kind: 'category', slug: 'hanh-dong' })).toBeNull();
    expect(homeSectionOf({ kind: 'newly-updated' })).toBeNull();
  });

  it('whitelist không nhận giá trị lạ', () => {
    expect(isHomeSection('phim-le')).toBe(true);
    expect(isHomeSection('tv-shows')).toBe(false);
    expect(isHomeSection('../the-loai')).toBe(false);
  });
});

describe('loại trùng giữa các section', () => {
  const slugs = (n: number) => Array.from({ length: n }, (_, i) => ({ slug: `phim-${i}` }));

  it('xin dư đúng chừng có thể bị loại — luôn còn đủ ROW_LIMIT, vẫn dưới trần API', () => {
    // mất tối đa màn đầu + 16 phim "Phim chiếu rạp" đã giữ
    expect(SECTION_FETCH_LIMIT - HOME_SHOWN - ROW_LIMIT).toBeGreaterThanOrEqual(ROW_LIMIT);
    expect(SECTION_FETCH_LIMIT).toBeLessThanOrEqual(MAX_LIMIT);
  });

  it('bỏ cả phim mà section khác đã giữ', () => {
    const kept = excludeShown(slugs(60), [], slugs(3)).map((m) => m.slug);
    expect(kept[0]).toBe('phim-3');
  });

  it('row đầu bỏ phim đang ở hero, vẫn đủ ROW_LIMIT', () => {
    const row = homeFirstRow(slugs(24), 'phim-1').map((m) => m.slug);

    expect(row).toHaveLength(ROW_LIMIT);
    expect(row).not.toContain('phim-1');
    expect(row[0]).toBe('phim-0');
    expect(row.at(-1)).toBe(`phim-${ROW_LIMIT}`);
  });

  it('không có hero thì row đầu là ROW_LIMIT phim đầu', () => {
    const row = homeFirstRow(slugs(24)).map((m) => m.slug);
    expect(row).toEqual(slugs(ROW_LIMIT).map((m) => m.slug));
  });

  it('mỗi bộ phim chỉ hiện một phần — phần đứng trước trong nguồn', () => {
    const lupin = [4, 3, 2, 1].map((n) => ({ slug: `sieu-trom-lupin-phan-${n}` }));
    const kept = excludeShown([...lupin, ...slugs(20)], []).map((m) => m.slug);

    expect(kept.filter((slug) => slug.startsWith('sieu-trom-lupin'))).toEqual([
      'sieu-trom-lupin-phan-4',
    ]);
    expect(kept).toHaveLength(ROW_LIMIT);
  });

  it('phần đã ở màn đầu hay ở section khác thì các phần còn lại cũng không hiện', () => {
    const feed = [{ slug: 'sieu-trom-lupin-phan-2' }];
    const items = [{ slug: 'sieu-trom-lupin-phan-1' }, { slug: 'sieu-trom-lupin' }, ...slugs(3)];

    expect(excludeShown(items, feed).map((m) => m.slug)).toEqual(['phim-0', 'phim-1', 'phim-2']);
    expect(excludeShown(items, [], feed).map((m) => m.slug)[0]).toBe('phim-0');
  });

  it('row đầu bỏ cả các phần khác của bộ phim đang ở hero', () => {
    const feed = [{ slug: 'lupin-mua-1' }, { slug: 'lupin-mua-2' }, ...slugs(20)];
    const row = homeFirstRow(feed, 'lupin-season-3').map((m) => m.slug);
    expect(row[0]).toBe('phim-0');
  });

  it('section loại ĐÚNG những phim đã ở màn đầu, dù hero là ứng viên nào', () => {
    const feed = slugs(24);

    for (let index = 0; index < HERO_CANDIDATES; index++) {
      const hero = `phim-${index}`;
      const onScreen = new Set([hero, ...homeFirstRow(feed, hero).map((m) => m.slug)]);
      const kept = excludeShown(slugs(40), feed).map((m) => m.slug);

      expect(kept.filter((slug) => onScreen.has(slug))).toEqual([]);
      // …và không loại oan phim nào ngoài màn đầu
      expect(kept[0]).toBe(`phim-${HOME_SHOWN}`);
    }
  });
});

describe('GET /api/home/[section]', () => {
  const FEED_PATH = '/danh-sach/phim-moi-cap-nhat-v3';

  /** Section `count` phim `phim-0`, `phim-1`…, cùng khuôn với fixture thật. */
  function sectionBody(count: number, from = 0) {
    const raw = structuredClone(shapeB) as { data: { items: unknown[] } };
    raw.data.items = Array.from({ length: count }, (_, i) => ({
      ...(raw.data.items[0] as object),
      slug: `phim-${from + i}`,
    }));
    return raw;
  }

  /** Nguồn "Mới cập nhật" (Shape A) chỉ gồm các slug cho trước. */
  const feedBody = (count: number) => ({
    items: Array.from({ length: count }, (_, i) => ({ slug: `phim-${i}` })),
  });

  /** fetch giả trả body theo pathname; đường nào không khai báo → 404. */
  function mockRoutes(bodies: Record<string, unknown>) {
    const fn = vi.fn(async (input: RequestInfo | URL) => {
      const { pathname } = new URL(String(input));
      return pathname in bodies
        ? Response.json(bodies[pathname])
        : new Response('', { status: 404, statusText: 'Not Found' });
    });
    vi.stubGlobal('fetch', fn);
    return fn;
  }

  const get = (section: string) =>
    GET(new Request(`http://localhost/api/home/${section}`), { params: { section } });

  it('lọc loại phim NGAY Ở API, xin dư để loại trùng, trả về card đã cắt', async () => {
    const fetchMock = mockRoutes({ '/v1/api/danh-sach/phim-bo': shapeB, [FEED_PATH]: feedBody(0) });

    const res = await get('phim-bo');
    const body = (await res.json()) as { items: Record<string, unknown>[] };

    expect(res.status).toBe(200);

    const urls = fetchMock.mock.calls.map((call) => new URL(String((call as unknown[])[0])));
    const list = urls.find((url) => url.pathname === '/v1/api/danh-sach/phim-bo');
    expect(list?.searchParams.get('limit')).toBe(String(SECTION_FETCH_LIMIT));

    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.length).toBeLessThanOrEqual(ROW_LIMIT);
    expect(Object.keys(body.items[0]!).sort()).toEqual(CARD_KEYS);
  });

  it('tự khai Cache-Control 5 phút — Next không tự thêm cho route handler ISR', async () => {
    mockRoutes({ '/v1/api/danh-sach/phim-bo': shapeB, [FEED_PATH]: feedBody(0) });

    const cacheControl = (await get('phim-bo')).headers.get('cache-control') ?? '';

    expect(cacheControl).toContain('max-age=300');
    expect(cacheControl).toContain('s-maxage=300');
  });

  it('API lờ `limit` đi thì vẫn không vượt ROW_LIMIT', async () => {
    mockRoutes({ '/v1/api/danh-sach/phim-le': sectionBody(64), [FEED_PATH]: feedBody(0) });

    const body = (await (await get('phim-le')).json()) as { items: unknown[] };

    expect(body.items).toHaveLength(ROW_LIMIT);
  });

  it('bỏ mọi phim đã có ở hero + "Mới cập nhật", vẫn trả đủ ROW_LIMIT', async () => {
    // "Phim bộ" trùng gần hết màn đầu — đúng tình huống đo được 25/09/2026.
    mockRoutes({ '/v1/api/danh-sach/phim-bo': sectionBody(40), [FEED_PATH]: feedBody(24) });

    const body = (await (await get('phim-bo')).json()) as { items: { slug: string }[] };
    const shown = feedBody(HOME_SHOWN).items.map((m) => m.slug);

    expect(body.items).toHaveLength(ROW_LIMIT);
    expect(body.items.filter((m) => shown.includes(m.slug))).toEqual([]);
  });

  it('section theo loại phim bỏ phim mà "Phim chiếu rạp" đang giữ', async () => {
    mockRoutes({
      '/v1/api/danh-sach/phim-le': sectionBody(60),
      // chiếu rạp giữ phim-10 … phim-25
      [`/v1/api/danh-sach/${THEATRICAL_SECTION}`]: sectionBody(40, 10),
      [FEED_PATH]: feedBody(0),
    });

    const body = (await (await get('phim-le')).json()) as { items: { slug: string }[] };
    const slugs = body.items.map((m) => m.slug);

    expect(slugs).toHaveLength(ROW_LIMIT);
    expect(slugs.slice(0, 10)).toEqual(Array.from({ length: 10 }, (_, i) => `phim-${i}`));
    expect(slugs[10]).toBe('phim-26');
  });

  it('"Phim chiếu rạp" không tự loại theo chính nó', async () => {
    const fetchMock = mockRoutes({
      [`/v1/api/danh-sach/${THEATRICAL_SECTION}`]: sectionBody(40),
      [FEED_PATH]: feedBody(0),
    });

    const body = (await (await get(THEATRICAL_SECTION)).json()) as { items: { slug: string }[] };
    const theatricalCalls = fetchMock.mock.calls.filter((call) =>
      String((call as unknown[])[0]).includes(THEATRICAL_SECTION),
    );

    expect(body.items[0]?.slug).toBe('phim-0');
    expect(theatricalCalls).toHaveLength(1);
  });

  it('danh sách chiếu rạp hỏng → section khác vẫn trả đủ', async () => {
    // chỉ có section chính; chiếu rạp, v3 và phao `/home` đều 404
    mockRoutes({ '/v1/api/danh-sach/phim-bo': sectionBody(20) });

    const res = await get('phim-bo');
    const body = (await res.json()) as { items: unknown[] };

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(ROW_LIMIT);
  });

  it('nguồn "Mới cập nhật" hỏng → section vẫn trả, chỉ là không loại trùng', async () => {
    // v3 lẫn phao `/v1/api/home` đều 404
    mockRoutes({ '/v1/api/danh-sach/hoat-hinh': sectionBody(20) });

    const res = await get('hoat-hinh');
    const body = (await res.json()) as { items: unknown[] };

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(ROW_LIMIT);
  });

  it('section ngoài whitelist → 404, KHÔNG gọi KKPhim', async () => {
    const fetchMock = mockFetch(shapeB);

    const res = await get('tv-shows');

    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('fetchHomeSection (trình duyệt)', () => {
  it('gọi route của mình, đúng một lần, kèm signal để huỷ được', async () => {
    const items = movies.slice(0, 3).map(toCardMovie);
    const fetchMock = mockFetch({ items });
    const controller = new AbortController();

    const result = await fetchHomeSection('hoat-hinh', { signal: controller.signal });

    expect(result).toEqual(items);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/home/hoat-hinh');
    expect(init.signal).toBe(controller.signal);
  });

  it('lỗi HTTP → ApiError mang status, để query biết có nên thử lại', async () => {
    mockFetch({ items: [] }, { status: 503 });

    const error = await fetchHomeSection('phim-bo').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(503);
  });

  it('body lạ → mảng rỗng, không ném', async () => {
    mockFetch({ nope: true });
    await expect(fetchHomeSection('phim-le')).resolves.toEqual([]);
  });
});
