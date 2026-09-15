/**
 * §6.2 — URL là nguồn sự thật duy nhất cho filter và phân trang.
 * Reload phải cho ra đúng trạng thái đang thấy.
 *
 * Hai hàm ở đây là cặp đối xứng: parse (URL → ListFilters) và serialize (ngược lại).
 */

import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  SORT_FIELDS,
  SORT_LANGS,
  SORT_TYPES,
  type ListFilters,
  type SortField,
  type SortLang,
  type SortType,
} from '@/types/filters';

export type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return value !== undefined && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

function positiveInt(value: string | undefined, max?: number): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return undefined;
  return max === undefined ? parsed : Math.min(parsed, max);
}

/** URL → ListFilters. Giá trị lạ bị bỏ qua thay vì làm hỏng request (§2.2 nguyên tắc 4). */
export function parseListFilters(searchParams: RawSearchParams = {}): ListFilters {
  const year = positiveInt(first(searchParams['year']));
  const currentYear = new Date().getFullYear();

  return {
    page: positiveInt(first(searchParams['page'])) ?? 1,
    sort_field: oneOf<SortField>(first(searchParams['sort_field']), SORT_FIELDS),
    sort_type: oneOf<SortType>(first(searchParams['sort_type']), SORT_TYPES),
    sort_lang: oneOf<SortLang>(first(searchParams['sort_lang']), SORT_LANGS),
    category: first(searchParams['category']) || undefined,
    country: first(searchParams['country']) || undefined,
    year: year !== undefined && year >= 1911 && year <= currentYear + 2 ? year : undefined,
    limit: positiveInt(first(searchParams['limit']), MAX_LIMIT) ?? DEFAULT_LIMIT,
  };
}

/** ListFilters → query string. Bỏ giá trị mặc định để URL gọn. */
export function serializeListFilters(filters: ListFilters): string {
  const params = new URLSearchParams();

  if (filters.category) params.set('category', filters.category);
  if (filters.country) params.set('country', filters.country);
  if (filters.year) params.set('year', String(filters.year));
  if (filters.sort_field) params.set('sort_field', filters.sort_field);
  if (filters.sort_type) params.set('sort_type', filters.sort_type);
  if (filters.sort_lang) params.set('sort_lang', filters.sort_lang);
  if (filters.limit && filters.limit !== DEFAULT_LIMIT) params.set('limit', String(filters.limit));
  if (filters.page && filters.page > 1) params.set('page', String(filters.page));

  return params.toString();
}

/** Ghép href giữ nguyên filter hiện tại, chỉ đổi phần được truyền vào. */
export function withFilters(pathname: string, current: ListFilters, patch: ListFilters): string {
  // Đổi bất kỳ filter nào cũng phải quay về trang 1, trừ khi chính `page` được đổi.
  const next: ListFilters = { ...current, ...patch };
  if (patch.page === undefined) next.page = 1;

  const query = serializeListFilters(next);
  return query ? `${pathname}?${query}` : pathname;
}

export function parseKeyword(searchParams: RawSearchParams = {}): string {
  return (first(searchParams['keyword']) ?? '').trim();
}
