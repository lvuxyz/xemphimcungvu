import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FilterBar } from '@/components/feature/FilterBar/FilterBar';
import { InfiniteGrid } from '@/components/feature/FilterBar/InfiniteGrid';
import { EmptyState, ListHeader } from '@/components/feature/FilterBar/MovieGrid';
import { getByYear, getTaxonomies, nullOn404 } from '@/lib/endpoints';
import { parseListFilters, type RawSearchParams } from '@/lib/search-params';

interface Props {
  params: { year: string };
  searchParams: RawSearchParams;
}

/** §3.1 — năm hợp lệ từ 1911 tới hiện tại (nới 2 năm cho phim sắp chiếu). */
function parseYear(raw: string): number | null {
  const year = Number.parseInt(raw, 10);
  if (!Number.isFinite(year) || year < 1911 || year > new Date().getFullYear() + 2) return null;
  return year;
}

export function generateMetadata({ params }: Props): Metadata {
  const year = parseYear(params.year);
  return year ? { title: `Phim năm ${year}` } : {};
}

/** §8.7 — lưới phim theo năm, `/v1/api/nam/{year}`. */
export default async function YearPage({ params, searchParams }: Props) {
  const year = parseYear(params.year);
  if (year === null) notFound();

  const filters = parseListFilters(searchParams);

  const [result, taxonomies] = await Promise.all([
    nullOn404(() => getByYear(year, filters)),
    getTaxonomies(),
  ]);

  if (!result) notFound();

  return (
    <main className="pb-16">
      <ListHeader title={`Phim năm ${year}`} count={result.pagination.totalItems} />
      <FilterBar
        categories={taxonomies.categories}
        countries={taxonomies.countries}
        years={taxonomies.years}
      />

      {result.items.length > 0 ? (
        <InfiniteGrid source={{ kind: 'year', year }} filters={filters} initial={result} />
      ) : (
        <EmptyState
          title={`Chưa có phim nào của năm ${year}`}
          hint="Thử bỏ bớt một điều kiện ở thanh lọc phía trên."
        />
      )}
    </main>
  );
}
