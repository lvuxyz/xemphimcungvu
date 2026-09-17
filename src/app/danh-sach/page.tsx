import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FilterBar } from '@/components/feature/FilterBar/FilterBar';
import { InfiniteGrid } from '@/components/feature/FilterBar/InfiniteGrid';
import { EmptyState, ListHeader } from '@/components/feature/FilterBar/MovieGrid';
import { getList, getTaxonomies, nullOn404 } from '@/lib/endpoints';
import { parseListFilters, type RawSearchParams } from '@/lib/search-params';

export const metadata: Metadata = { title: 'Tất cả phim' };

/**
 * §3.1 — `/v1/api/danh-sach`: danh sách tổng hợp, không cần `type_list`.
 * Là điểm vào cho việc lọc thuần theo thể loại / quốc gia / năm mà không bị bó
 * trong một loại phim, và giữ cho URL `/danh-sach` không rơi vào 404.
 */
export default async function AllMoviesPage({ searchParams }: { searchParams: RawSearchParams }) {
  const filters = parseListFilters(searchParams);

  const [result, taxonomies] = await Promise.all([
    nullOn404(() => getList(filters)),
    getTaxonomies(),
  ]);

  if (!result) notFound();

  return (
    <main className="pb-16">
      <ListHeader title="Tất cả phim" count={result.pagination.totalItems} />
      <FilterBar
        categories={taxonomies.categories}
        countries={taxonomies.countries}
        years={taxonomies.years}
      />

      {result.items.length > 0 ? (
        <InfiniteGrid source={{ kind: 'all' }} filters={filters} initial={result} />
      ) : (
        <EmptyState
          title="Không có phim nào khớp bộ lọc"
          hint="Thử bỏ bớt một điều kiện ở thanh lọc phía trên."
        />
      )}
    </main>
  );
}
