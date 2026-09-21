import { HeroBillboard } from '@/components/feature/HeroBillboard/HeroBillboard';
import { ContentRow } from '@/components/feature/ContentRow/ContentRow';
import { PersonalizedRows } from '@/components/feature/ContentRow/PersonalizedRows';
import { ContinueRow } from '@/components/feature/ContinueRow/ContinueRow';
import { CONTINUE_PROBE } from '@/components/feature/ContinueRow/continue-probe';
import { EMPTY_LIST, getHeroSpotlight, getHome, getNewlyUpdated } from '@/lib/endpoints';
import { ROW_LIMIT } from '@/lib/constants';
import type { ListSource } from '@/lib/list-source';
import { PATH, routes } from '@/lib/routes';

interface HomeRow {
  /**
   * Định danh ổn định của row, KHÔNG phải tiêu đề — tiêu đề đổi được ("Hành động"
   * → "Vì bạn đã xem X") và nguồn cũng đổi được. Dùng để nói về một row cụ thể
   * trong test và trong log, không phải để làm `key` của React (xem
   * `PersonalizedRows` về việc key phải theo vị trí).
   */
  id: string;
  title: string;
  source: ListSource;
  /** Link "Xem tất cả" — mọi row đều phải có đường đi tiếp (§8.3). */
  href: string;
}

/**
 * 10 row còn lại của trang chủ. KHÔNG fetch ở RSC: mỗi row tự gọi API khi cuộn
 * tới (§11.2 — "không được bắn 11 request song song ngay khi load").
 */
const LAZY_ROWS: HomeRow[] = [
  {
    id: 'type-phim-bo',
    title: 'Phim bộ',
    source: { kind: 'type', type: 'phim-bo' },
    href: routes.listByType('phim-bo'),
  },
  {
    id: 'type-phim-le',
    title: 'Phim lẻ',
    source: { kind: 'type', type: 'phim-le' },
    href: routes.listByType('phim-le'),
  },
  {
    id: 'type-hoat-hinh',
    title: 'Hoạt hình',
    source: { kind: 'type', type: 'hoat-hinh' },
    href: routes.listByType('hoat-hinh'),
  },
  {
    id: 'type-tv-shows',
    title: 'TV Shows',
    source: { kind: 'type', type: 'tv-shows' },
    href: routes.listByType('tv-shows'),
  },
  {
    id: 'country-han-quoc',
    title: 'Hàn Quốc',
    source: { kind: 'country', slug: 'han-quoc' },
    href: routes.country('han-quoc'),
  },
  {
    id: 'country-trung-quoc',
    title: 'Trung Quốc',
    source: { kind: 'country', slug: 'trung-quoc' },
    href: routes.country('trung-quoc'),
  },
  {
    id: 'country-nhat-ban',
    title: 'Nhật Bản',
    source: { kind: 'country', slug: 'nhat-ban' },
    href: routes.country('nhat-ban'),
  },
  {
    id: 'category-hanh-dong',
    title: 'Hành động',
    source: { kind: 'category', slug: 'hanh-dong' },
    href: routes.category('hanh-dong'),
  },
  {
    id: 'category-tinh-cam',
    title: 'Tình cảm',
    source: { kind: 'category', slug: 'tinh-cam' },
    href: routes.category('tinh-cam'),
  },
  {
    id: 'category-kinh-di',
    title: 'Kinh dị',
    source: { kind: 'category', slug: 'kinh-di' },
    href: routes.category('kinh-di'),
  },
];

/**
 * Trang chủ (§6) — thứ tự fetch bám đúng §11.2:
 *
 *   1. RSC  : `/v1/api/home` → chọn hero, dựng row đầu
 *   2. Client: 10 row còn lại, lazy khi vào viewport (`LazyRow`)
 *
 * ⚠️ Sai lệch có chủ đích: `/v1/api/home` KHÔNG trả `thumb_url` (chỉ có
 * `poster_url`), mà ContentRow dùng ảnh 16:9. Vì vậy row "Mới cập nhật" lấy dữ
 * liệu từ `/danh-sach/phim-moi-cap-nhat-v3` — cùng nội dung, cùng thứ tự, nhưng
 * có đủ hai cỡ ảnh. `/home` vẫn là lời gọi đầu tiên và vẫn là nguồn chọn hero.
 */
export default async function HomePage() {
  const [home, newly] = await Promise.all([
    getHome().catch(() => EMPTY_LIST),
    getNewlyUpdated(1, 'v3').catch(() => EMPTY_LIST),
  ]);

  const firstRow = newly.items.length > 0 ? newly.items : home.items;
  const heroPool = home.items.length > 0 ? home.items : newly.items;

  // Mất cả hai nguồn là hỏng phần cốt lõi → để error.tsx hiện nút "Thử lại" (§14.1).
  if (heroPool.length === 0) {
    throw new Error('Không tải được danh sách phim cho trang chủ');
  }

  const hero = await getHeroSpotlight(heroPool);

  return (
    <>
      {hero && (
        <HeroBillboard movie={hero.movie} images={hero.images} trailerUrl={hero.trailerUrl} />
      )}

      {/*
        §8.2 layer 3 — row đầu chồng lên đáy hero cho liền mạch, nhưng KHÔNG
        được chồng lên chữ: `-8vw` ở màn 1920 là 154px, nuốt luôn 62px cuối của
        khối tiêu đề + nút Phát. Kẹp lại còn tối đa 4.5rem — vẫn đủ để gradient
        đáy hero nối vào row, mà mọi khổ màn đều còn khoảng hở dưới nút.
      */}
      <div className="relative z-row -mt-[clamp(0.5rem,4vw,4.5rem)] pb-16">
        {/*
          Phải đứng TRƯỚC chỗ chừa: script đồng bộ chạy đúng lúc trình duyệt đọc
          tới đây, nên `<html data-continue-watching>` đã có mặt khi `.continue-slot`
          bên dưới được layout. Đặt sau là chừa chỗ muộn hơn một lượt vẽ, tức là
          vẫn dịch — chính thứ nó sinh ra để tránh.
        */}
        <script dangerouslySetInnerHTML={{ __html: CONTINUE_PROBE }} />
        <div className="continue-slot">
          <ContinueRow />
        </div>

        <ContentRow
          title="Mới cập nhật"
          movies={firstRow.slice(0, ROW_LIMIT)}
          href={PATH.list}
          priority
        />

        {/* Thứ tự 10 row này do sở thích của người đang xem quyết định — xem `lib/taste.ts`. */}
        <PersonalizedRows rows={LAZY_ROWS} />
      </div>
    </>
  );
}
