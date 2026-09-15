/**
 * Tham số filter dùng chung cho mọi endpoint danh sách (§3.1),
 * đồng thời là hình dạng của `searchParams` trên URL (§6.2).
 */

export const TYPE_LIST = [
  'phim-bo',
  'phim-le',
  'tv-shows',
  'hoat-hinh',
  'phim-vietsub',
  'phim-thuyet-minh',
  'phim-long-tieng',
] as const;

export type TypeList = (typeof TYPE_LIST)[number];

export const SORT_FIELDS = ['modified.time', '_id', 'year'] as const;
export type SortField = (typeof SORT_FIELDS)[number];

export const SORT_TYPES = ['asc', 'desc'] as const;
export type SortType = (typeof SORT_TYPES)[number];

export const SORT_LANGS = ['vietsub', 'thuyet-minh', 'long-tieng'] as const;
export type SortLang = (typeof SORT_LANGS)[number];

/** `limit` tối đa 64 — API từ chối giá trị lớn hơn (§3.1, §17 rủi ro #11). */
export const MAX_LIMIT = 64;
export const DEFAULT_LIMIT = 24;

export interface ListFilters {
  page?: number;
  sort_field?: SortField;
  sort_type?: SortType;
  sort_lang?: SortLang;
  category?: string;
  country?: string;
  year?: number;
  limit?: number;
}

export function isTypeList(value: string): value is TypeList {
  return (TYPE_LIST as readonly string[]).includes(value);
}
