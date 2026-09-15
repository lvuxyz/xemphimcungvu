import { notFound } from 'next/navigation';
import { FilterBar } from '@/components/feature/FilterBar/FilterBar';
import { InfiniteGrid } from '@/components/feature/FilterBar/InfiniteGrid';
import { ListHeader } from '@/components/feature/FilterBar/MovieGrid';
import { parseListFilters, type RawSearchParams } from '@/lib/search-params';
import { isTypeList } from '@/types/filters';
import { getMockGrid, mockCategories, mockCountries, mockYears } from '@/mocks';

const TITLES: Record<string, string> = {
  'phim-bo': 'Phim bộ',
  'phim-le': 'Phim lẻ',
  'tv-shows': 'TV Shows',
  'hoat-hinh': 'Hoạt hình',
  'phim-vietsub': 'Phim Vietsub',
  'phim-thuyet-minh': 'Phim thuyết minh',
  'phim-long-tieng': 'Phim lồng tiếng',
};

/** Trang danh sách theo `type_list` (§8.7). Filter đồng bộ searchParams (§6.2). */
export default function ListByTypePage({
  params,
  searchParams,
}: {
  params: { type: string };
  searchParams: RawSearchParams;
}) {
  if (!isTypeList(params.type)) notFound();

  const filters = parseListFilters(searchParams);
  // Mock tĩnh: lặp lại pool cho đủ nhiều trang để thấy infinite scroll hoạt động.
  const movies = getMockGrid(120, ((filters.page ?? 1) - 1) * 24);

  return (
    <main className="pb-16">
      <ListHeader title={TITLES[params.type] ?? params.type} count={movies.length} />
      <FilterBar categories={mockCategories} countries={mockCountries} years={mockYears} />
      <InfiniteGrid movies={movies} />
    </main>
  );
}
