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
  search: '/tim-kiem',
  detail: '/phim',
  watch: '/xem',
  category: '/the-loai',
  country: '/quoc-gia',
  year: '/nam',
} as const;

/** Tham số từ khoá trên `/tim-kiem`. Khai báo một chỗ để parse và build không lệch nhau. */
export const SEARCH_PARAM = 'keyword';

export const routes = {
  home: () => PATH.home,

  /** Trang/modal chi tiết phim. */
  detail: (slug: string) => `${PATH.detail}/${slug}`,

  /**
   * Trang phát.
   *
   * `episodeSlug` bỏ trống thì rơi về sentinel `1` và trang phát tự phân giải về
   * tập đầu (`resolveEpisode`) — cần cho hero và card, nơi chưa fetch tập nào.
   */
  watch: (slug: string, episodeSlug?: string) =>
    `${PATH.watch}/${slug}/${episodeSlug ?? FIRST_EPISODE}`,

  /** Kết quả tìm kiếm. Từ khoá rỗng → trang tìm kiếm trống, không kèm query thừa. */
  search: (keyword: string) => {
    const trimmed = keyword.trim();
    return trimmed
      ? `${PATH.search}?${SEARCH_PARAM}=${encodeURIComponent(trimmed)}`
      : PATH.search;
  },

  list: () => PATH.list,
  listByType: (type: TypeList | string) => `${PATH.list}/${type}`,
  category: (slug: string) => `${PATH.category}/${slug}`,
  country: (slug: string) => `${PATH.country}/${slug}`,
  year: (year: number | string) => `${PATH.year}/${year}`,
  myList: () => PATH.myList,
} as const;

/**
 * Trang để quay về khi không có lịch sử trong app để lùi lại (mở thẳng link chia
 * sẻ, hoặc tab mới). §2.3 — "nếu vào thẳng thì về /browse".
 */
export const FALLBACK_ROUTE = PATH.home;
