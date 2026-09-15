import { EmptyState, ListHeader, MovieGrid } from '@/components/feature/FilterBar/MovieGrid';
import { parseKeyword, type RawSearchParams } from '@/lib/search-params';
import { searchMock } from '@/mocks';

/** Trang kết quả tìm kiếm — `?keyword=` (§8.1). */
export default function SearchPage({ searchParams }: { searchParams: RawSearchParams }) {
  const keyword = parseKeyword(searchParams);
  const results = keyword ? searchMock(keyword) : [];

  if (!keyword) {
    return (
      <main className="pb-16">
        <ListHeader title="Tìm kiếm" count={0} />
        <EmptyState title="Nhập từ khoá để bắt đầu" hint="Dùng ô tìm kiếm ở thanh điều hướng." />
      </main>
    );
  }

  return (
    <main className="pb-16">
      <ListHeader title={`Kết quả cho "${keyword}"`} count={results.length} />
      {results.length > 0 ? (
        <MovieGrid movies={results} />
      ) : (
        <EmptyState
          title={`Không tìm thấy phim nào khớp "${keyword}"`}
          hint="Thử từ khoá ngắn hơn, hoặc duyệt theo thể loại ở thanh điều hướng."
        />
      )}
    </main>
  );
}
