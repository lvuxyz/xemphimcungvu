'use client';

import { useQuery } from '@tanstack/react-query';
import { CACHE } from '@/lib/constants';
import { getCategories, getCountries, getYears } from '@/lib/endpoints';
import { queryKeys } from '@/lib/query-keys';
import { routes } from '@/lib/routes';

export type TaxonomyKind = 'categories' | 'countries' | 'years';

export interface TaxonomyLink {
  label: string;
  href: string;
}

/**
 * Menu hỏng thì chỉ thử lại một lần trong `request()`, và TanStack Query không
 * thử thêm: người dùng đang đứng nhìn cái menu, đóng mở lại là tự thử lại — tốt
 * hơn bắt họ chờ thêm 2 vòng backoff.
 */
const MENU_FETCH = { retries: 1 } as const;

const LOADERS: Record<TaxonomyKind, (signal: AbortSignal) => Promise<TaxonomyLink[]>> = {
  categories: async (signal) =>
    (await getCategories({ ...MENU_FETCH, signal })).map((c) => ({
      label: c.name,
      href: routes.category(c.slug),
    })),
  countries: async (signal) =>
    (await getCountries({ ...MENU_FETCH, signal })).map((c) => ({
      label: c.name,
      href: routes.country(c.slug),
    })),
  years: async (signal) =>
    (await getYears({ ...MENU_FETCH, signal })).map((year) => ({
      label: String(year),
      href: routes.year(year),
    })),
};

/**
 * Danh mục cho menu Navbar — CHỈ tải khi menu đó được mở (`enabled`).
 *
 * Trước đây layout gốc gọi cả ba danh mục ở MỌI trang và nhét 178 mục vào HTML
 * của từng trang (~3.5 kB RSC payload), dù phần lớn người xem không bao giờ mở
 * menu. Giờ trang không mang theo gì; mở menu lần đầu là một request nhỏ (~2 kB),
 * những lần sau trong 24 giờ lấy từ cache (`CACHE.taxonomy`).
 *
 * Trang danh sách (`/the-loai/…`, `/danh-sach/…`) vẫn tự lấy danh mục ở RSC cho
 * FilterBar — ở đó nó là nội dung chính của trang, không phải thứ phụ.
 */
export function useTaxonomyLinks(kind: TaxonomyKind, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.taxonomyLinks(kind),
    queryFn: ({ signal }) => LOADERS[kind](signal),
    enabled,
    staleTime: CACHE.taxonomy.staleTime,
    gcTime: CACHE.taxonomy.gcTime,
    retry: false,
  });
}
