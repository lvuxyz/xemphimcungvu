import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FilterBar } from '@/components/feature/FilterBar/FilterBar';
import { InfiniteGrid } from '@/components/feature/FilterBar/InfiniteGrid';
import { EmptyState, ListHeader } from '@/components/feature/FilterBar/MovieGrid';
import { getByCategory, getCategories, getTaxonomies, nullOn404 } from '@/lib/endpoints';
import { parseListFilters, type RawSearchParams } from '@/lib/search-params';

interface Props {
  params: { slug: string };
  searchParams: RawSearchParams;
}

/** Tên hiển thị của thể loại — `/the-loai` cache 24h nên tra ở đây gần như miễn phí. */
async function categoryName(slug: string): Promise<string | undefined> {
  const categories = await getCategories().catch(() => []);
  return categories.find((item) => item.slug === slug)?.name;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const name = await categoryName(params.slug);
  if (!name) notFound();
  return { title: `Phim ${name}` };
}

/** §8.7 — lưới phim theo thể loại, `/v1/api/the-loai/{slug}`. */
export default async function CategoryPage({ params, searchParams }: Props) {
  const filters = parseListFilters(searchParams);

  const [result, taxonomies, name] = await Promise.all([
    nullOn404(() => getByCategory(params.slug, filters)),
    getTaxonomies(),
    categoryName(params.slug),
  ]);

  // Slug lạ → API trả 404, không phải danh sách rỗng.
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
          source={{ kind: 'category', slug: params.slug }}
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
