import type { ListFilters, TypeList } from '@/types/filters';

/**
 * Query key tập trung cho TanStack Query (§11).
 * Đặt ở một chỗ để invalidate và prefetch không bị lệch key.
 */
export const queryKeys = {
  all: ['phim'] as const,

  home: () => [...queryKeys.all, 'home'] as const,

  lists: () => [...queryKeys.all, 'list'] as const,
  listByType: (type: TypeList, filters: ListFilters = {}) =>
    [...queryKeys.lists(), 'type', type, filters] as const,
  listByCategory: (slug: string, filters: ListFilters = {}) =>
    [...queryKeys.lists(), 'the-loai', slug, filters] as const,
  listByCountry: (slug: string, filters: ListFilters = {}) =>
    [...queryKeys.lists(), 'quoc-gia', slug, filters] as const,
  listByYear: (year: number, filters: ListFilters = {}) =>
    [...queryKeys.lists(), 'nam', year, filters] as const,
  listAll: (filters: ListFilters = {}) => [...queryKeys.lists(), 'tong-hop', filters] as const,
  newlyUpdated: (filters: ListFilters = {}) =>
    [...queryKeys.lists(), 'moi-cap-nhat', filters] as const,

  search: (keyword: string, filters: ListFilters = {}) =>
    [...queryKeys.all, 'tim-kiem', keyword, filters] as const,

  details: () => [...queryKeys.all, 'detail'] as const,
  detail: (slug: string) => [...queryKeys.details(), slug] as const,
  images: (slug: string) => [...queryKeys.details(), slug, 'images'] as const,
  peoples: (slug: string) => [...queryKeys.details(), slug, 'peoples'] as const,
  keywords: (slug: string) => [...queryKeys.details(), slug, 'keywords'] as const,

  taxonomy: () => [...queryKeys.all, 'taxonomy'] as const,
  categories: () => [...queryKeys.taxonomy(), 'the-loai'] as const,
  countries: () => [...queryKeys.taxonomy(), 'quoc-gia'] as const,
  years: () => [...queryKeys.taxonomy(), 'nam'] as const,
} as const;
