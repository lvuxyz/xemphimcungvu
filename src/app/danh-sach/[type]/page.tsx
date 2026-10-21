import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FilterBar } from '@/components/feature/FilterBar/FilterBar';
import { InfiniteGrid } from '@/components/feature/FilterBar/InfiniteGrid';
import { EmptyState, ListHeader } from '@/components/feature/FilterBar/MovieGrid';
import { getListByType, getTaxonomies, nullOn404 } from '@/lib/endpoints';
import { parseListFilters, type RawSearchParams } from '@/lib/search-params';
import { isTypeList } from '@/types/filters';

const TITLES: Record<string, string> = {
  'phim-bo': 'Phim bộ',
  'phim-le': 'Phim lẻ',
  'tv-shows': 'TV Shows',
  'hoat-hinh': 'Hoạt hình',
  'phim-vietsub': 'Phim Vietsub',
  'phim-thuyet-minh': 'Phim thuyết minh',
  'phim-long-tieng': 'Phim lồng tiếng',
  'phim-chieu-rap': 'Phim chiếu rạp',
};

interface Props {
  params: { type: string };
  searchParams: RawSearchParams;
}

export function generateMetadata({ params }: Props): Metadata {
  const title = TITLES[params.type];
  if (!title) notFound();
  return { title };
}

/** Trang danh sách theo `type_list` (§8.7). Filter đồng bộ searchParams (§6.2). */
export default async function ListByTypePage({ params, searchParams }: Props) {
  // Gán ra biến const để type guard còn hiệu lực bên trong closure phía dưới.
  const type = params.type;
  if (!isTypeList(type)) notFound();

  const filters = parseListFilters(searchParams);

  const [result, taxonomies] = await Promise.all([
    nullOn404(() => getListByType(type, filters)),
    getTaxonomies(),
  ]);

  if (!result) notFound();

  return (
    <main className="pb-16">
      <ListHeader title={TITLES[type] ?? type} count={result.pagination.totalItems} />
      <FilterBar
        categories={taxonomies.categories}
        countries={taxonomies.countries}
        years={taxonomies.years}
      />

      {result.items.length > 0 ? (
        <InfiniteGrid source={{ kind: 'type', type }} filters={filters} initial={result} />
      ) : (
        <EmptyState
          title="Không có phim nào khớp bộ lọc"
          hint="Thử bỏ bớt một điều kiện ở thanh lọc phía trên."
        />
      )}
    </main>
  );
}
