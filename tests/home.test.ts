import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { ROW_LIMIT } from '@/lib/constants';
import {
  HOME_SECTIONS,
  fetchHomeSection,
  homeSectionOf,
  isHomeSection,
  toCardMovie,
} from '@/lib/home';
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
  it('đúng ba section lazy, đều là loại phim lọc ở phía API', () => {
    expect([...HOME_SECTIONS]).toEqual(['phim-bo', 'phim-le', 'hoat-hinh']);
  });

  it('ánh xạ nguồn danh sách → section', () => {
    expect(homeSectionOf({ kind: 'type', type: 'phim-bo' })).toBe('phim-bo');
    expect(homeSectionOf({ kind: 'type', type: 'hoat-hinh' })).toBe('hoat-hinh');
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

describe('GET /api/home/[section]', () => {
  it('lọc loại phim + giới hạn số phim NGAY Ở API, trả về card đã cắt', async () => {
    const fetchMock = mockFetch(shapeB);

    const res = await GET(new Request('http://localhost/api/home/phim-bo'), {
      params: { section: 'phim-bo' },
    });
    const body = (await res.json()) as { items: Record<string, unknown>[] };

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const url = new URL(String((fetchMock.mock.calls[0] as unknown[])[0]));
    expect(url.pathname).toBe('/v1/api/danh-sach/phim-bo');
    expect(url.searchParams.get('limit')).toBe(String(ROW_LIMIT));

    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.length).toBeLessThanOrEqual(ROW_LIMIT);
    expect(Object.keys(body.items[0]!).sort()).toEqual(CARD_KEYS);
  });

  it('tự khai Cache-Control 5 phút — Next không tự thêm cho route handler ISR', async () => {
    mockFetch(shapeB);

    const res = await GET(new Request('http://localhost/api/home/phim-bo'), {
      params: { section: 'phim-bo' },
    });
    const cacheControl = res.headers.get('cache-control') ?? '';

    expect(cacheControl).toContain('max-age=300');
    expect(cacheControl).toContain('s-maxage=300');
  });

  it('API lờ `limit` đi thì vẫn không vượt ROW_LIMIT', async () => {
    const raw = structuredClone(shapeB) as { data: { items: unknown[] } };
    raw.data.items = Array.from({ length: 40 }, (_, i) => ({
      ...(raw.data.items[0] as object),
      slug: `phim-${i}`,
    }));
    mockFetch(raw);

    const res = await GET(new Request('http://localhost/api/home/phim-le'), {
      params: { section: 'phim-le' },
    });
    const body = (await res.json()) as { items: unknown[] };

    expect(body.items).toHaveLength(ROW_LIMIT);
  });

  it('section ngoài whitelist → 404, KHÔNG gọi KKPhim', async () => {
    const fetchMock = mockFetch(shapeB);

    const res = await GET(new Request('http://localhost/api/home/tv-shows'), {
      params: { section: 'tv-shows' },
    });

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
