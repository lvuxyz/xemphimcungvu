import { FilterBar } from '@/components/feature/FilterBar/FilterBar';
import { EmptyState, ListHeader, MovieGrid } from '@/components/feature/FilterBar/MovieGrid';
import { parseListFilters, type RawSearchParams } from '@/lib/search-params';
import { mockCategories, mockCountries, mockMovies, mockYears } from '@/mocks';

export default function CountryPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: RawSearchParams;
}) {
  parseListFilters(searchParams);

  const country = mockCountries.find((c) => c.slug === params.slug);
  const movies = mockMovies.filter((m) => m.countries.some((c) => c.slug === params.slug));

  return (
    <main className="pb-16">
      <ListHeader title={country?.name ?? params.slug} count={movies.length} />
      <FilterBar categories={mockCategories} countries={mockCountries} years={mockYears} />
      {movies.length > 0 ? (
        <MovieGrid movies={movies} />
      ) : (
        <EmptyState
          title="Chưa có phim nào của quốc gia này"
          hint="Dữ liệu mock chỉ phủ một phần. Nối API thật sẽ đầy đủ."
        />
      )}
    </main>
  );
}
