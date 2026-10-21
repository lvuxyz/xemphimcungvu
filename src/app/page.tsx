import { HeroBillboard } from '@/components/feature/HeroBillboard/HeroBillboard';
import { ContentRow } from '@/components/feature/ContentRow/ContentRow';
import { PersonalizedRows } from '@/components/feature/ContentRow/PersonalizedRows';
import { ContinueRow } from '@/components/feature/ContinueRow/ContinueRow';
import { CONTINUE_PROBE } from '@/components/feature/ContinueRow/continue-probe';
import { ExploreChips } from '@/components/feature/ExploreChips/ExploreChips';
import { SiteFooter } from '@/components/feature/SiteFooter/SiteFooter';
import { getHeroSpotlight, getHomeFeed } from '@/lib/endpoints';
import { homeFirstRow, toCardMovie } from '@/lib/home';
import type { ListSource } from '@/lib/list-source';
import { PATH, routes } from '@/lib/routes';
import { toPlainText } from '@/lib/sanitize';

/**
 * Trần độ dài tóm tắt ở hero. CSS chỉ hiện 2–3 dòng (~210 ký tự ở khổ rộng nhất),
 * phần dư không đáng đi kèm HTML.
 */
const SYNOPSIS_MAX = 280;

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
 * Bốn section còn lại của trang chủ. KHÔNG fetch ở RSC: mỗi section tự gọi
 * `/api/home/{type}` khi người xem cuộn gần tới (`LazyRow`).
 *
 * TV Shows, quốc gia và thể loại đã rời trang chủ, lối vào của chúng là dải chip
 * "Khám phá", menu Navbar và các trang danh sách. Hệ quả cho cá nhân hoá: không
 * còn row thể loại nào để nhường chỗ cho "Vì bạn đã xem X", nên `personalizeRows`
 * ở đây chỉ còn đảo thứ tự các row này.
 *
 * ⚠️ "Phim chiếu rạp" KHÔNG được đứng đầu danh sách. Nó là row poster, cao và hẹp
 * card khác các row còn lại, mà `PersonalizedRows` giữ khung theo VỊ TRÍ — row nào
 * dời vào chỗ 0 thì khung chờ ở chỗ đó đổi hình. Chỗ 0 là chỗ duy nhất có thể đang
 * ló trong màn hình đầu (điện thoại), nên đổi hình ở đó là layout shift thấy được.
 * Row này không có khoá sở thích (điểm luôn 0), sắp xếp lại đứng yên, nên nó chỉ
 * có thể TỤT xuống chứ không bao giờ lên được chỗ 0 — miễn là nó không bắt đầu ở đó.
 */
const LAZY_ROWS: HomeRow[] = [
  {
    id: 'type-phim-bo',
    title: 'Phim bộ',
    source: { kind: 'type', type: 'phim-bo' },
    href: routes.listByType('phim-bo'),
  },
  {
    id: 'type-phim-chieu-rap',
    title: 'Phim chiếu rạp',
    source: { kind: 'type', type: 'phim-chieu-rap' },
    href: routes.listByType('phim-chieu-rap'),
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
 *   2. Client: 4 section còn lại, mỗi section một request khi cuộn gần tới
 *
 * Đúng MỘT request danh sách ở RSC. Trước đây là hai (`/v1/api/home` song song
 * với v3), nhưng kiểm tra thật 24/09/2026 cho thấy hai endpoint trả CÙNG 24 phim
 * theo CÙNG thứ tự — mà `/home` lại thiếu `thumb_url`. Giờ v3 vừa là nguồn hero
 * vừa là nguồn row đầu; `/home` chỉ còn là phao khi v3 hỏng (xem `getHomeFeed`).
 *
 * ⚠️ v3 lờ tham số `limit` (luôn trả 24 — đã thử), nên row đầu được cắt còn
 * `ROW_LIMIT` NGAY TẠI ĐÂY, trên server: HTML chỉ mang 16 card, và mỗi card chỉ
 * mang các field `CardMovie`.
 *
 * Không phim nào hiện hai lần: row đầu bỏ phim đang ở hero (`homeFirstRow`), ba
 * section bỏ mọi phim đã có ở hai chỗ đó (`excludeShown` trong `/api/home/*`).
 */
export default async function HomePage() {
  const feed = await getHomeFeed();

  // Mất nguồn này là hỏng phần cốt lõi → để error.tsx hiện nút "Thử lại" (§14.1).
  if (feed.items.length === 0) {
    throw new Error('Không tải được danh sách phim cho trang chủ');
  }

  const hero = await getHeroSpotlight(feed.items);

  return (
    <>
      <main>
        {hero && (
          <HeroBillboard
            movie={hero.movie}
            images={hero.images}
            trailerUrl={hero.trailerUrl}
            synopsis={toPlainText(hero.content, SYNOPSIS_MAX)}
          />
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
            movies={homeFirstRow(feed.items, hero?.movie.slug).map(toCardMovie)}
            href={PATH.list}
            priority
          />

          <ExploreChips />

          {/* Thứ tự các row này do sở thích của người đang xem quyết định — xem `lib/taste.ts`. */}
          <PersonalizedRows rows={LAZY_ROWS} />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
