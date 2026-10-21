import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FilterBar } from '@/components/feature/FilterBar/FilterBar';
import { InfiniteGrid } from '@/components/feature/FilterBar/InfiniteGrid';
import { EmptyState, ListHeader } from '@/components/feature/FilterBar/MovieGrid';
import { getByCountry, getCountries, getTaxonomies, nullOn404 } from '@/lib/endpoints';
import { parseListFilters, type RawSearchParams } from '@/lib/search-params';

interface Props {
  params: { slug: string };
  searchParams: RawSearchParams;
}

/** Tên hiển thị của quốc gia — `/quoc-gia` cache 24h nên tra ở đây gần như miễn phí. */
async function countryName(slug: string): Promise<string | undefined> {
  const countries = await getCountries().catch(() => []);
  return countries.find((item) => item.slug === slug)?.name;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const name = await countryName(params.slug);
  if (!name) notFound();
  return { title: `Phim ${name}` };
}

/** §8.7 — lưới phim theo quốc gia, `/v1/api/quoc-gia/{slug}`. */
export default async function CountryPage({ params, searchParams }: Props) {
  const filters = parseListFilters(searchParams);

  const [result, taxonomies, name] = await Promise.all([
    nullOn404(() => getByCountry(params.slug, filters)),
    getTaxonomies(),
    countryName(params.slug),
  ]);

  if (!result) notFound();

  return (
    <main className="pb-16">
      <ListHeader title={name ?? params.slug} count={result.pagination.totalItems} />
      <FilterBar
        categories={taxonomies.categories}
        countries={taxonomies.countries}
        years={taxonomies.years}
      />

      {result.items.length > 0 ? (
        <InfiniteGrid
          source={{ kind: 'country', slug: params.slug }}
          filters={filters}
          initial={result}
        />
      ) : (
        <EmptyState
          title="Không có phim nào khớp bộ lọc"
          hint="Thử bỏ bớt một điều kiện ở thanh lọc phía trên."
        />
      )}
    </main>
  );
}
