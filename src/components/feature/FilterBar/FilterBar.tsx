'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { parseListFilters, withFilters } from '@/lib/search-params';
import { SORT_LANGS, type ListFilters } from '@/types/filters';
import type { Taxonomy } from '@/types/movie';
import { Dropdown, type DropdownOption } from '@/components/ui/Dropdown';

/**
 * §8.7 — filter bar: thể loại · quốc gia · năm · ngôn ngữ · sắp xếp.
 *
 * §6.2 — mọi filter đồng bộ vào `searchParams`. URL là nguồn sự thật duy nhất,
 * reload phải ra đúng trạng thái. Đổi filter luôn quay về trang 1.
 */
interface FilterBarProps {
  categories: Taxonomy[];
  countries: Taxonomy[];
  years: number[];
}

export function FilterBar({ categories, countries, years }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = parseListFilters(Object.fromEntries(searchParams.entries()));

  const apply = useCallback(
    (patch: ListFilters) => {
      router.push(withFilters(pathname, current, patch), { scroll: false });
    },
    [router, pathname, current],
  );

  const toOptions = (items: { name: string; slug: string }[]): DropdownOption[] =>
    items.map((item) => ({ value: item.slug, label: item.name }));

  const hasFilter = Boolean(
    current.category || current.country || current.year || current.sort_lang || current.sort_field,
  );

  return (
    <div className="flex flex-wrap items-center gap-2 px-row py-4">
      <Dropdown
        label="Thể loại"
        allLabel="Tất cả"
        value={current.category}
        options={toOptions(categories)}
        onChange={(category) => apply({ category })}
      />

      <Dropdown
        label="Quốc gia"
        allLabel="Tất cả"
        value={current.country}
        options={toOptions(countries)}
        onChange={(country) => apply({ country })}
      />

      <Dropdown
        label="Năm"
        allLabel="Tất cả"
        value={current.year ? String(current.year) : undefined}
        options={years.map((y) => ({ value: String(y), label: String(y) }))}
        onChange={(year) => apply({ year: year ? Number(year) : undefined })}
      />

      <Dropdown
        label="Ngôn ngữ"
        allLabel="Tất cả"
        value={current.sort_lang}
        options={SORT_LANGS.map((lang) => ({
          value: lang,
          label: lang === 'vietsub' ? 'Vietsub' : lang === 'thuyet-minh' ? 'Thuyết minh' : 'Lồng tiếng',
        }))}
        onChange={(sort_lang) => apply({ sort_lang: sort_lang as ListFilters['sort_lang'] })}
      />

      <Dropdown
        label="Sắp xếp"
        value={current.sort_field ?? 'modified.time'}
        options={[
          { value: 'modified.time', label: 'Mới cập nhật' },
          { value: 'year', label: 'Năm phát hành' },
          { value: '_id', label: 'Mới thêm' },
        ]}
        onChange={(sort_field) =>
          apply({ sort_field: sort_field as ListFilters['sort_field'], sort_type: 'desc' })
        }
      />

      {hasFilter && (
        <button
          type="button"
          onClick={() => router.push(pathname, { scroll: false })}
          className="ml-1 text-xs text-text-muted transition-colors duration-micro ease-standard hover:text-accent-hover"
        >
          Xoá bộ lọc
        </button>
      )}
    </div>
  );
}
