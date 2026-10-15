/**
 * Dữ liệu trang chủ: năm section, và hình dạng card đi qua `/api/home/*`.
 *
 *   Mới cập nhật     RSC, nằm sẵn trong HTML          `/danh-sach/phim-moi-cap-nhat-v3`
 *   Phim bộ          lazy, `/api/home/phim-bo`         `/v1/api/danh-sach/phim-bo?limit=49`
 *   Phim chiếu rạp   lazy, `/api/home/phim-chieu-rap`  `/v1/api/danh-sach/phim-chieu-rap?limit=49`
 *   Phim lẻ          lazy, `/api/home/phim-le`         `/v1/api/danh-sach/phim-le?limit=49`
 *   Hoạt hình        lazy, `/api/home/hoat-hinh`       `/v1/api/danh-sach/hoat-hinh?limit=49`
 *
 * Mỗi section trả đúng 16 phim, KHÔNG trùng phim nào đã có ở hero, ở "Mới cập
 * nhật", hay (với ba section theo loại phim) ở "Phim chiếu rạp" — xin 49 là để
 * còn đủ 16 sau khi loại trùng (`SECTION_FETCH_LIMIT`).
 *
 * Dùng ở cả ba nơi — RSC trang chủ, route handler, và `LazyRow` trên trình duyệt —
 * nên file này KHÔNG được import thứ gì chỉ chạy ở server.
 */

import type { TypeList } from '@/types/filters';
import type { CardMovie } from '@/types/movie';
import { ApiError } from './api';
import { ROW_LIMIT } from './constants';
import type { ListSource } from './list-source';

/**
 * Số phim ĐẦU của nguồn "Mới cập nhật" đã có mặt ở màn đầu trang chủ: hero (luôn
 * là một trong `HERO_CANDIDATES` phim đầu) + `ROW_LIMIT` phim của row "Mới cập
 * nhật" (đã bỏ phim hero ra). Hai chỗ phải cùng đếm như nhau — RSC dựng row, route
 * `/api/home/*` loại trùng — nên đếm ở đây.
 */
export const HOME_SHOWN = ROW_LIMIT + 1;

/**
 * Số phim mỗi section xin API, để còn đủ `ROW_LIMIT` phim sau khi loại trùng.
 *
 * Nguồn "Mới cập nhật" gần như là phim bộ (17/24 phim, đo 25/09/2026), và cả hai
 * nguồn cùng xếp theo thời gian cập nhật — nên section "Phim bộ" xin 16 phim thì
 * 12 phim trùng với row đầu, cả 6 card nhìn thấy đầu tiên đều trùng. Tệ nhất một
 * section mất `HOME_SHOWN` phim cho màn đầu và `ROW_LIMIT` phim cho "Phim chiếu
 * rạp", nên xin thêm đúng chừng đó là luôn còn đủ. Vẫn dưới trần 64 của API.
 */
export const SECTION_FETCH_LIMIT = ROW_LIMIT + HOME_SHOWN + ROW_LIMIT;

/**
 * Row "Mới cập nhật": `ROW_LIMIT` phim đầu của nguồn, BỎ phim đang nằm trên hero —
 * card đầu tiên ngay dưới hero lặp lại đúng phim trên hero là phí mất một chỗ.
 */
export function homeFirstRow<T extends { slug: string }>(
  feed: readonly T[],
  heroSlug?: string,
): T[] {
  return feed
    .slice(0, HOME_SHOWN)
    .filter((movie) => movie.slug !== heroSlug)
    .slice(0, ROW_LIMIT);
}

/**
 * Một section sau khi loại trùng: bỏ mọi phim đã có ở màn đầu (hero + "Mới cập
 * nhật"), và mọi phim trong `claimed` — phim mà section khác đã giữ.
 *
 * Loại theo `HOME_SHOWN` phim đầu của nguồn chứ không theo đúng phim hero: route
 * không biết phim nào được chọn làm hero (bộ chọn còn xét backdrop và trailer),
 * nhưng biết chắc hero nằm trong khoảng đó — nên loại cả khoảng là vừa đủ.
 */
export function excludeShown<T extends { slug: string }>(
  items: readonly T[],
  feed: readonly { slug: string }[],
  claimed: readonly { slug: string }[] = [],
): T[] {
  const shown = new Set([...feed.slice(0, HOME_SHOWN), ...claimed].map((movie) => movie.slug));
  return items.filter((movie) => !shown.has(movie.slug)).slice(0, ROW_LIMIT);
}

/**
 * Bốn section lazy, lọc ngay ở API (`/v1/api/danh-sach/{type}`) chứ không kéo một
 * danh sách chung về rồi lọc ở client.
 *
 * Đồng thời là WHITELIST của `/api/home/[section]`: route đó chỉ nhận đúng các giá
 * trị này, nên nó không thành một proxy mở tới KKPhim mà ai cũng nhét được cache
 * key tuỳ ý vào.
 */
export const HOME_SECTIONS = [
  'phim-bo',
  'phim-chieu-rap',
  'phim-le',
  'hoat-hinh',
] as const satisfies readonly TypeList[];

export type HomeSection = (typeof HOME_SECTIONS)[number];

/**
 * Section duy nhất KHÔNG phải một loại phim: nó cắt ngang phim lẻ và hoạt hình
 * (đo 25/09/2026: 2/16 phim trùng "Phim lẻ", và có cả hoạt hình chiếu rạp). Ba
 * section theo loại phim thì vốn rời nhau, nên chỉ cần một luật: phim nào "Phim
 * chiếu rạp" đã giữ thì section khác bỏ ra — nó là danh sách đặc thù hơn, phim
 * đứng ở đó có lý do hơn.
 */
export const THEATRICAL_SECTION = 'phim-chieu-rap' satisfies HomeSection;

export function isHomeSection(value: string): value is HomeSection {
  return (HOME_SECTIONS as readonly string[]).includes(value);
}

/** Section trang chủ ứng với một nguồn danh sách, `null` nếu nguồn đó không phải section. */
export function homeSectionOf(source: ListSource): HomeSection | null {
  return source.kind === 'type' && isHomeSection(source.type) ? source.type : null;
}

/**
 * Kiểu card của một section. "Phim chiếu rạp" dùng poster 2:3 — một row khác nhịp
 * giữa bốn row ảnh ngang giống hệt nhau, và poster rạp vốn là ảnh được thiết kế
 * để đứng một mình.
 */
export function homeSectionLayout(section: HomeSection): 'backdrop' | 'poster' {
  return section === THEATRICAL_SECTION ? 'poster' : 'backdrop';
}

export const homeSectionUrl = (section: HomeSection) => `/api/home/${section}`;

/**
 * Cắt một phim về đúng những field card đọc (`CardMovie`).
 *
 * Liệt kê TỪNG field thay vì `{ ...movie }` rồi xoá bớt: cách sau để lọt mọi field
 * mới thêm vào `Movie` về sau, tức là payload trang chủ phình dần mà không ai thấy.
 *
 * Nhận `CardMovie` (mọi `Movie` đều gán vào được) nên gọi hai lần cũng vô hại.
 */
export function toCardMovie(movie: CardMovie): CardMovie {
  return {
    id: movie.id,
    slug: movie.slug,
    name: movie.name,
    originName: movie.originName,
    type: movie.type,
    poster: movie.poster,
    thumb: movie.thumb,
    year: movie.year,
    episodeCurrent: movie.episodeCurrent,
    quality: movie.quality,
    duration: movie.duration,
    tmdb: { vote_average: movie.tmdb.vote_average, vote_count: movie.tmdb.vote_count },
    imdb: { vote_average: movie.imdb.vote_average, vote_count: movie.imdb.vote_count },
    categories: movie.categories.map(({ name, slug }) => ({ name, slug })),
    countries: movie.countries.map(({ name, slug }) => ({ name, slug })),
  };
}

/**
 * Một section lazy, gọi từ trình duyệt.
 *
 * Không đi qua `request()` của `lib/api.ts`: hàm đó ghép `API_BASE_URL` vào mọi
 * đường dẫn tương đối, và tự thử lại 2 lần — cộng với lượt thử lại của TanStack
 * Query là tới 9 lời gọi cho một section hỏng. Ở đây mỗi lượt là đúng MỘT fetch,
 * việc thử lại để `LazyRow` quyết.
 *
 * `signal` do TanStack Query cấp: component unmount giữa chừng thì request bị huỷ.
 */
export async function fetchHomeSection(
  section: HomeSection,
  { signal }: { signal?: AbortSignal } = {},
): Promise<CardMovie[]> {
  const url = homeSectionUrl(section);
  const res = await fetch(url, { signal, headers: { accept: 'application/json' } });

  if (!res.ok) throw new ApiError(`HTTP ${res.status} ${res.statusText}`, res.status, url);

  const body = (await res.json()) as { items?: unknown };
  return Array.isArray(body.items) ? (body.items as CardMovie[]) : [];
}
