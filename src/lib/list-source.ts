/**
 * Mô tả NGUỒN của một danh sách phim — §3.1.
 *
 * Bốn endpoint danh sách khác nhau nhưng cùng trả về `MovieListResult`, và cùng
 * cần được gọi lại từ phía client (infinite scroll §8.7, row lazy §11.2).
 * Client component không thể nhận hàm làm prop, nên nguồn được mô tả bằng một
 * object thuần — RSC truyền xuống, client dựng lại lời gọi và query key từ đó.
 */

import {
  getByCategory,
  getByCountry,
  getByYear,
  getList,
  getListByType,
  getNewlyUpdated,
  search,
} from './endpoints';
import { queryKeys } from './query-keys';
import type { ListFilters, TypeList } from '@/types/filters';
import type { MovieListResult } from '@/types/movie';

export type ListSource =
  /** `/danh-sach/phim-moi-cap-nhat-v3` — Shape A */
  | { kind: 'newly-updated' }
  /** `/v1/api/danh-sach/{type_list}` */
  | { kind: 'type'; type: TypeList }
  /** `/v1/api/the-loai/{slug}` */
  | { kind: 'category'; slug: string }
  /** `/v1/api/quoc-gia/{slug}` */
  | { kind: 'country'; slug: string }
  /** `/v1/api/nam/{year}` */
  | { kind: 'year'; year: number }
  /** `/v1/api/tim-kiem?keyword=` */
  | { kind: 'search'; keyword: string }
  /** `/v1/api/danh-sach` — danh sách tổng hợp, không cần slug */
  | { kind: 'all' };

/** Gọi đúng endpoint của nguồn. Chạy được ở cả RSC lẫn browser (API cho CORS `*`). */
export function fetchListSource(
  source: ListSource,
  filters: ListFilters = {},
  opts: { signal?: AbortSignal } = {},
): Promise<MovieListResult> {
  switch (source.kind) {
    case 'newly-updated':
      return getNewlyUpdated(filters.page ?? 1, 'v3', opts);
    case 'type':
      return getListByType(source.type, filters, opts);
    case 'category':
      return getByCategory(source.slug, filters, opts);
    case 'country':
      return getByCountry(source.slug, filters, opts);
    case 'year':
      return getByYear(source.year, filters, opts);
    case 'search':
      return search(source.keyword, filters, opts);
    case 'all':
      return getList(filters, opts);
  }
}

/**
 * Query key của nguồn (§11).
 *
 * `filters` giữ nguyên cả `page`: với `useInfiniteQuery`, page trong key là
 * TRANG BẮT ĐẦU (lấy từ URL), còn các trang sau đi qua `pageParam`. Nhờ vậy vào
 * thẳng `?page=5` không đọc nhầm cache của `?page=1`.
 */
export function listQueryKey(source: ListSource, filters: ListFilters = {}) {
  switch (source.kind) {
    case 'newly-updated':
      return queryKeys.newlyUpdated(filters);
    case 'type':
      return queryKeys.listByType(source.type, filters);
    case 'category':
      return queryKeys.listByCategory(source.slug, filters);
    case 'country':
      return queryKeys.listByCountry(source.slug, filters);
    case 'year':
      return queryKeys.listByYear(source.year, filters);
    case 'search':
      return queryKeys.search(source.keyword, filters);
    case 'all':
      return queryKeys.listAll(filters);
  }
}
