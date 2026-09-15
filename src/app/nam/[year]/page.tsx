import { notFound } from 'next/navigation';
import { FilterBar } from '@/components/feature/FilterBar/FilterBar';
import { EmptyState, ListHeader, MovieGrid } from '@/components/feature/FilterBar/MovieGrid';
import { parseListFilters, type RawSearchParams } from '@/lib/search-params';
import { mockCategories, mockCountries, mockMovies, mockYears } from '@/mocks';

export default function YearPage({
  params,
  searchParams,
}: {
  params: { year: string };
  searchParams: RawSearchParams;
}) {
  const year = Number.parseInt(params.year, 10);
  // §3.1 — năm hợp lệ từ 1911 tới hiện tại.
  if (!Number.isFinite(year) || year < 1911 || year > new Date().getFullYear() + 2) notFound();

  parseListFilters(searchParams);
  const movies = mockMovies.filter((m) => m.year === year);

  return (
    <main className="pb-16">
      <ListHeader title={`Phim năm ${year}`} count={movies.length} />
      <FilterBar categories={mockCategories} countries={mockCountries} years={mockYears} />
      {movies.length > 0 ? (
        <MovieGrid movies={movies} />
      ) : (
        <EmptyState title={`Chưa có phim năm ${year} trong dữ liệu mock`} />
      )}
    </main>
  );
}
