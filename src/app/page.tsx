import { HeroBillboard } from '@/components/feature/HeroBillboard/HeroBillboard';
import { ContentRow } from '@/components/feature/ContentRow/ContentRow';
import { mockHero, mockRows } from '@/mocks';

/**
 * Trang chủ (§6).
 *
 * Giai đoạn dựng giao diện: dữ liệu lấy từ mock tĩnh, KHÔNG gọi API.
 * Khi nối API thật: thay `mockRows` bằng `getHome()` ở RSC và fetch lazy
 * các row còn thiếu theo viewport (§11.2).
 */
export default function HomePage() {
  return (
    <>
      <HeroBillboard
        movie={mockHero.movie}
        images={mockHero.images}
        trailerUrl={mockHero.trailerUrl}
      />

      {/* Row đầu chồng lên đáy hero, tạo cảm giác liền mạch (§8.2 layer 3) */}
      <div className="relative z-row -mt-[8vw] pb-16">
        {mockRows.map((row, index) => (
          <ContentRow
            key={row.title}
            title={row.title}
            movies={row.movies}
            priority={index === 0}
          />
        ))}
      </div>
    </>
  );
}
