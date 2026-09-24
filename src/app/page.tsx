import { HeroBillboard } from '@/components/feature/HeroBillboard/HeroBillboard';
import { ContentRow } from '@/components/feature/ContentRow/ContentRow';
import { PersonalizedRows } from '@/components/feature/ContentRow/PersonalizedRows';
import { ContinueRow } from '@/components/feature/ContinueRow/ContinueRow';
import { CONTINUE_PROBE } from '@/components/feature/ContinueRow/continue-probe';
import { EMPTY_LIST, getHeroSpotlight, getHome, getNewlyUpdated } from '@/lib/endpoints';
import { ROW_LIMIT } from '@/lib/constants';
import { toCardMovie } from '@/lib/home';
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
 * Ba section còn lại của trang chủ. KHÔNG fetch ở RSC: mỗi section tự gọi
 * `/api/home/{type}` khi người xem cuộn gần tới (`LazyRow`).
 *
 * Trang chủ cố ý chỉ có bốn section tính cả "Mới cập nhật" — TV Shows, quốc gia
 * và thể loại đã rời trang chủ, lối vào của chúng là menu Navbar và các trang
 * danh sách. Hệ quả cho cá nhân hoá: không còn row thể loại nào để nhường chỗ cho
 * "Vì bạn đã xem X", nên `personalizeRows` ở đây chỉ còn đảo thứ tự ba row này.
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
];

/**
 * Trang chủ (§6) — thứ tự fetch:
 *
 *   1. RSC   : `/danh-sach/phim-moi-cap-nhat-v3` → chọn hero, dựng "Mới cập nhật"
 *   2. Client: 3 section còn lại, mỗi section một request khi cuộn gần tới
 *
 * Đúng MỘT request danh sách ở RSC. Trước đây là hai (`/v1/api/home` song song
 * với v3), nhưng kiểm tra thật 24/09/2026 cho thấy hai endpoint trả CÙNG 24 phim
 * theo CÙNG thứ tự — mà `/home` lại thiếu `thumb_url`. Giờ v3 vừa là nguồn hero
 * vừa là nguồn row đầu; `/home` chỉ còn là phao khi v3 hỏng (không tốn gì lúc
 * bình thường).
 *
 * ⚠️ v3 lờ tham số `limit` (luôn trả 24 — đã thử), nên row đầu được cắt còn
 * `ROW_LIMIT` NGAY TẠI ĐÂY, trên server: HTML chỉ mang 16 card, và mỗi card chỉ
 * mang các field `CardMovie`.
 */
export default async function HomePage() {
  const newly = await getNewlyUpdated(1, 'v3').catch(() => getHome().catch(() => EMPTY_LIST));

  // Mất nguồn này là hỏng phần cốt lõi → để error.tsx hiện nút "Thử lại" (§14.1).
  if (newly.items.length === 0) {
    throw new Error('Không tải được danh sách phim cho trang chủ');
  }

  const hero = await getHeroSpotlight(newly.items);

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
          movies={newly.items.slice(0, ROW_LIMIT).map(toCardMovie)}
          href={PATH.list}
          priority
        />

        {/* Thứ tự 3 row này do sở thích của người đang xem quyết định — xem `lib/taste.ts`. */}
        <PersonalizedRows rows={LAZY_ROWS} />
      </div>
    </>
  );
}
