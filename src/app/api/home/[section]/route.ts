import { NextResponse } from 'next/server';
import { TIMEOUT } from '@/lib/constants';
import { EMPTY_LIST, getHomeFeed, getListByType } from '@/lib/endpoints';
import {
  HOME_SECTIONS,
  SECTION_FETCH_LIMIT,
  THEATRICAL_SECTION,
  excludeShown,
  isHomeSection,
  toCardMovie,
} from '@/lib/home';

/** Ngân sách của hai lời gọi chỉ phục vụ loại trùng. */
const SUPPLEMENTARY = { timeout: TIMEOUT.supplementary, retries: 0 };

/**
 * `/api/home/{phim-bo|phim-chieu-rap|phim-le|hoat-hinh}` — một section lazy của trang chủ.
 *
 * Tồn tại vì ba thứ mà gọi thẳng KKPhim từ trình duyệt không làm được:
 *
 *   · CACHE DÙNG CHUNG. Gọi thẳng thì mỗi người xem cuộn trang chủ là một lượt
 *     gọi KKPhim cho mỗi section. Qua đây thì KKPhim thấy tối đa MỘT lượt mỗi
 *     section mỗi 5 phút, bất kể bao nhiêu người đang xem: route được dựng sẵn lúc
 *     build (ISR) và dựng lại ngầm khi quá hạn, còn `fetch` bên dưới đi qua data
 *     cache của Next với cùng thời hạn.
 *   · PAYLOAD CHỈ CÓ FIELD CARD. Response gốc mang theo `seoOnPage`, `breadCrumb`,
 *     `alternative_names`, `last_episodes`, id của từng thể loại… — card không đọc
 *     thứ nào trong đó. Cắt ở đây là cắt trước khi nó lên dây.
 *   · KHÔNG TRÙNG. Section bỏ mọi phim đã có ở hero và "Mới cập nhật", và ba
 *     section theo loại phim bỏ thêm phim "Phim chiếu rạp" đã giữ (`excludeShown`).
 *     Trước đây "Phim bộ" trùng 12/16 phim với row đầu — cả 6 card nhìn thấy đầu
 *     tiên — vì cả hai nguồn cùng xếp theo lần cập nhật cuối. Route và trang chủ
 *     dựng lại độc lập nên có thể lệch nhau tối đa một chu kỳ ISR; khi đó lọt vài
 *     phim trùng, không hơn.
 *
 * Lỗi thì NÉM, không trả rỗng: lúc dựng lại ngầm, ném là cách để Next giữ bản cũ
 * còn tốt thay vì cache một section rỗng suốt 5 phút. Người xem thì không thấy gì
 * khác — `LazyRow` ẩn đúng section đó, các section còn lại vẫn hiện (§14.1).
 */

/** = `REVALIDATE.list`. Phải là số viết thẳng: Next đọc segment config bằng phân tích tĩnh. */
export const revalidate = 300;

/** Section ngoài whitelist → 404 ngay ở tầng định tuyến, không chạm tới KKPhim. */
export const dynamicParams = false;

/**
 * Next KHÔNG tự đặt `Cache-Control` cho route handler ISR như nó làm với trang
 * (kiểm tra trên `next start`: trang có `s-maxage=300`, route thì không có gì) —
 * nó chỉ lưu nguyên header của response vào cache rồi phát lại. Nên phải đặt ở đây:
 *
 *   max-age       trình duyệt giữ 5 phút — tải lại trang chủ trong 5 phút là 0
 *                 request cho section đã xem (TanStack Query chỉ giữ trong phiên)
 *   s-maxage      CDN / proxy phía trước giữ đúng bằng chu kỳ ISR
 *   swr           CDN trả bản cũ ngay trong lúc tự lấy bản mới
 *
 * ⚠️ `next start` cũng KHÔNG nén response của route handler (nó ghi thẳng vào
 * response gốc, vòng qua lớp gzip — trang HTML thì vẫn được nén). Chạy sau CDN
 * hay reverse proxy thì chỗ đó nén; tự host trần thì mỗi section là ~11 kB thay
 * vì ~2.2 kB.
 */
const CACHE_CONTROL = `public, max-age=${revalidate}, s-maxage=${revalidate}, stale-while-revalidate=${revalidate * 2}`;

export function generateStaticParams() {
  return HOME_SECTIONS.map((section) => ({ section }));
}

export async function GET(_request: Request, { params }: { params: { section: string } }) {
  if (!isHomeSection(params.section)) {
    return NextResponse.json({ items: [] }, { status: 404 });
  }

  const section = params.section;

  /**
   * Hai nguồn phụ chỉ để loại trùng, cả hai đều trúng data cache của Next nên
   * thường KHÔNG tới KKPhim: `getHomeFeed` là đúng lời gọi của RSC trang chủ, còn
   * danh sách chiếu rạp là đúng lời gọi của chính section đó (cùng URL, cùng
   * `limit`).
   *
   * Ngân sách bổ trợ và KHÔNG ném: thiếu chúng thì section chỉ có thể trùng vài
   * phim, không đáng giữ section lại chờ, càng không đáng làm hỏng section.
   */
  const [{ items }, feed, theatrical] = await Promise.all([
    getListByType(section, { limit: SECTION_FETCH_LIMIT }),
    getHomeFeed(SUPPLEMENTARY),
    section === THEATRICAL_SECTION
      ? EMPTY_LIST
      : getListByType(THEATRICAL_SECTION, { limit: SECTION_FETCH_LIMIT }, SUPPLEMENTARY).catch(
          () => EMPTY_LIST,
        ),
  ]);

  // Đúng 16 phim mà section chiếu rạp đang hiện — tính lại bằng cùng một luật.
  const claimed = excludeShown(theatrical.items, feed.items);

  // `excludeShown` cắt về `ROW_LIMIT`: API có lờ `limit` đi (như
  // `/danh-sach/phim-moi-cap-nhat-v3` vẫn làm) thì trang chủ cũng không phình.
  return NextResponse.json(
    { items: excludeShown(items, feed.items, claimed).map(toCardMovie) },
    { headers: { 'Cache-Control': CACHE_CONTROL } },
  );
}
