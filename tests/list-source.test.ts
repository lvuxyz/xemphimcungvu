import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MovieListResult } from '@/types/movie';

/**
 * `ListSource` là thứ duy nhất đi qua ranh giới RSC → client component, nên nếu
 * nó ánh xạ sai endpoint thì lỗi chỉ lộ ra lúc cuộn tới trang 2. Test ở đây
 * chặn đúng chỗ đó: mỗi `kind` phải gọi đúng hàm, đúng tham số.
 */
const endpoints = {
  getNewlyUpdated: vi.fn(),
  getListByType: vi.fn(),
  getByCategory: vi.fn(),
  getByCountry: vi.fn(),
  getByYear: vi.fn(),
  search: vi.fn(),
  getList: vi.fn(),
};

vi.mock('@/lib/endpoints', () => endpoints);

const { fetchListSource, listQueryKey } = await import('@/lib/list-source');

const EMPTY: MovieListResult = {
  items: [],
  pagination: { totalItems: 0, itemsPerPage: 24, currentPage: 1, totalPages: 1 },
};

beforeEach(() => {
  for (const fn of Object.values(endpoints)) {
    fn.mockReset();
    fn.mockResolvedValue(EMPTY);
  }
});

describe('fetchListSource — §3.1', () => {
  const filters = { page: 2, limit: 24 };
  const opts = {};

  it('newly-updated → /danh-sach/phim-moi-cap-nhat-v3 theo page', async () => {
    await fetchListSource({ kind: 'newly-updated' }, filters, opts);
    expect(endpoints.getNewlyUpdated).toHaveBeenCalledWith(2, 'v3', opts);
  });

  it('type → /v1/api/danh-sach/{type_list}', async () => {
    await fetchListSource({ kind: 'type', type: 'phim-bo' }, filters, opts);
    expect(endpoints.getListByType).toHaveBeenCalledWith('phim-bo', filters, opts);
  });

  it('category → /v1/api/the-loai/{slug}', async () => {
    await fetchListSource({ kind: 'category', slug: 'hanh-dong' }, filters, opts);
    expect(endpoints.getByCategory).toHaveBeenCalledWith('hanh-dong', filters, opts);
  });

  it('country → /v1/api/quoc-gia/{slug}', async () => {
    await fetchListSource({ kind: 'country', slug: 'han-quoc' }, filters, opts);
    expect(endpoints.getByCountry).toHaveBeenCalledWith('han-quoc', filters, opts);
  });

  it('year → /v1/api/nam/{year}', async () => {
    await fetchListSource({ kind: 'year', year: 2024 }, filters, opts);
    expect(endpoints.getByYear).toHaveBeenCalledWith(2024, filters, opts);
  });

  it('search → /v1/api/tim-kiem', async () => {
    await fetchListSource({ kind: 'search', keyword: 'thiên' }, filters, opts);
    expect(endpoints.search).toHaveBeenCalledWith('thiên', filters, opts);
  });

  it('all → /v1/api/danh-sach', async () => {
    await fetchListSource({ kind: 'all' }, filters, opts);
    expect(endpoints.getList).toHaveBeenCalledWith(filters, opts);
  });

  it('không truyền filters thì newly-updated vẫn về trang 1', async () => {
    await fetchListSource({ kind: 'newly-updated' });
    expect(endpoints.getNewlyUpdated).toHaveBeenCalledWith(1, 'v3', {});
  });
});

describe('listQueryKey — §11', () => {
  it('hai nguồn khác nhau không bao giờ dùng chung key', () => {
    const keys = [
      listQueryKey({ kind: 'newly-updated' }),
      listQueryKey({ kind: 'type', type: 'phim-bo' }),
      listQueryKey({ kind: 'category', slug: 'phim-bo' }),
      listQueryKey({ kind: 'country', slug: 'phim-bo' }),
      listQueryKey({ kind: 'year', year: 2024 }),
      listQueryKey({ kind: 'search', keyword: 'phim-bo' }),
      listQueryKey({ kind: 'all' }),
    ].map((key) => JSON.stringify(key));

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('filter khác nhau → key khác nhau (đổi lọc phải refetch)', () => {
    const a = listQueryKey({ kind: 'type', type: 'phim-bo' }, { year: 2024 });
    const b = listQueryKey({ kind: 'type', type: 'phim-bo' }, { year: 2023 });
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('trang bắt đầu nằm trong key — vào thẳng ?page=5 không đọc nhầm cache trang 1', () => {
    const a = listQueryKey({ kind: 'type', type: 'phim-bo' }, { page: 1 });
    const b = listQueryKey({ kind: 'type', type: 'phim-bo' }, { page: 5 });
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
});
