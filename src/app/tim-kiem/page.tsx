import type { Metadata } from 'next';
import { InfiniteGrid } from '@/components/feature/FilterBar/InfiniteGrid';
import { EmptyState, ListHeader } from '@/components/feature/FilterBar/MovieGrid';
import { EMPTY_LIST, search } from '@/lib/endpoints';
import { parseKeyword, parseListFilters, type RawSearchParams } from '@/lib/search-params';

interface Props {
  searchParams: RawSearchParams;
}

export function generateMetadata({ searchParams }: Props): Metadata {
  const keyword = parseKeyword(searchParams);
  return { title: keyword ? `Tìm kiếm: ${keyword}` : 'Tìm kiếm' };
}

/** Trang kết quả tìm kiếm — `/v1/api/tim-kiem?keyword=` (§8.1). */
export default async function SearchPage({ searchParams }: Props) {
  const keyword = parseKeyword(searchParams);

  if (!keyword) {
    return (
      <main className="pb-16">
        <ListHeader title="Tìm kiếm" count={0} />
        <EmptyState title="Nhập từ khoá để bắt đầu" hint="Dùng ô tìm kiếm ở thanh điều hướng." />
      </main>
    );
  }

  const filters = parseListFilters(searchParams);
  /**
   * §14.1 — tìm kiếm fail thì coi như không có kết quả thay vì ném ra error
   * page: người dùng còn nguyên ô tìm kiếm để gõ lại từ khoá khác.
   */
  const result = await search(keyword, filters).catch(() => EMPTY_LIST);

  return (
    <main className="pb-16">
      <ListHeader title={`Kết quả cho "${keyword}"`} count={result.pagination.totalItems} />

      {result.items.length > 0 ? (
        <InfiniteGrid source={{ kind: 'search', keyword }} filters={filters} initial={result} />
      ) : (
        <EmptyState
          title={`Không tìm thấy phim nào khớp "${keyword}"`}
          hint="Thử từ khoá ngắn hơn, hoặc duyệt theo thể loại ở thanh điều hướng."
        />
      )}
    </main>
  );
}
