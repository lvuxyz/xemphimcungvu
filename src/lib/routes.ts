/**
 * Nguồn sự thật duy nhất cho mọi đường dẫn trong app.
 *
 * Trước đây URL được ghép thẳng trong component — `/phim/${slug}` xuất hiện ở 9
 * chỗ, `/xem/${slug}/${ep}` ở 6 chỗ. Đổi một tiền tố là phải đi lùng từng file,
 * và chỉ cần sót một chỗ là có link chết mà không ai biết cho tới lúc người dùng
 * bấm phải.
 *
 * Quy ước:
 *   · `PATH`   — đoạn tĩnh, dùng để SO SÁNH (`pathname === PATH.myList`)
 *   · `routes` — hàm dựng đường dẫn, dùng để ĐIỀU HƯỚNG
 *
 * URL giữ nguyên tiếng Việt: site tiếng Việt, đã được index, và đổi sang
 * `/browse` `/title` `/watch` chỉ đổi cái vỏ chứ không sửa được lỗi nào ở §1.4.
 */

import type { TypeList } from '@/types/filters';

/** Sentinel cho "tập đầu tiên" khi nơi gọi chưa có danh sách tập trong tay. */
export const FIRST_EPISODE = '1';

export const PATH = {
  home: '/',
  list: '/danh-sach',
  myList: '/danh-sach-cua-toi',
  history: '/lich-su',
  search: '/tim-kiem',
  detail: '/phim',
  watch: '/xem',
  category: '/the-loai',
  country: '/quoc-gia',
  year: '/nam',
} as const;

/** Tham số từ khoá trên `/tim-kiem`. Khai báo một chỗ để parse và build không lệch nhau. */
export const SEARCH_PARAM = 'keyword';

/** Mốc thời gian (giây) trên `/xem/:slug/:ep` — `?t=754`. */
export const TIME_PARAM = 't';

export const routes = {
  home: () => PATH.home,

  /** Trang/modal chi tiết phim. */
  detail: (slug: string) => `${PATH.detail}/${slug}`,

  /**
   * Trang phát.
   *
   * `episodeSlug` bỏ trống thì rơi về sentinel `1` và trang phát tự phân giải về
   * tập đầu (`resolveEpisode`) — cần cho hero và card, nơi chưa fetch tập nào.
   *
   * `startAt` (giây) sinh ra `?t=` — mốc thời gian nằm TRONG URL nên F5 không
   * mất chỗ đang xem và link gửi cho người khác mở đúng ngay phút đó. Số 0 và
   * số âm bị bỏ qua: `?t=0` chỉ làm bẩn URL chứ không nói thêm điều gì.
   */
  watch: (slug: string, episodeSlug?: string, options?: { startAt?: number }) => {
    const base = `${PATH.watch}/${slug}/${episodeSlug ?? FIRST_EPISODE}`;
    const t = options?.startAt;
    return t !== undefined && Number.isFinite(t) && t > 0
      ? `${base}?${TIME_PARAM}=${Math.floor(t)}`
      : base;
  },

  /** Kết quả tìm kiếm. Từ khoá rỗng → trang tìm kiếm trống, không kèm query thừa. */
  search: (keyword: string) => {
    const trimmed = keyword.trim();
    return trimmed ? `${PATH.search}?${SEARCH_PARAM}=${encodeURIComponent(trimmed)}` : PATH.search;
  },

  list: () => PATH.list,
  listByType: (type: TypeList | string) => `${PATH.list}/${type}`,
  category: (slug: string) => `${PATH.category}/${slug}`,
  country: (slug: string) => `${PATH.country}/${slug}`,
  year: (year: number | string) => `${PATH.year}/${year}`,
  myList: () => PATH.myList,
  history: () => PATH.history,
} as const;

/**
 * URL này có đang đứng ở trang chi tiết một phim không?
 *
 * Chặt hơn `startsWith('/phim/')` một bậc: đúng MỘT đoạn sau `/phim`.
 * `/phim/id/{id}`, `/phim/{slug}/gì-đó` cũng khớp tiền tố nhưng không phải
 * trang chi tiết — cái đầu là route tra cứu rồi redirect.
 *
 * Dùng để modal chi tiết tự biết lúc nào mình hết phần (xem `DetailModal`).
 */
export function isDetailPath(pathname: string): boolean {
  const prefix = `${PATH.detail}/`;
  if (!pathname.startsWith(prefix)) return false;
  const rest = pathname.slice(prefix.length);
  return rest.length > 0 && !rest.includes('/');
}

/**
 * Trang để quay về khi không có lịch sử trong app để lùi lại (mở thẳng link chia
 * sẻ, hoặc tab mới). §2.3 — "nếu vào thẳng thì về /browse".
 */
export const FALLBACK_ROUTE = PATH.home;
