/**
 * Dữ liệu trang chủ: bốn section, và hình dạng card đi qua `/api/home/*`.
 *
 *   Mới cập nhật   RSC, nằm sẵn trong HTML      `/danh-sach/phim-moi-cap-nhat-v3`
 *   Phim bộ        lazy, `/api/home/phim-bo`     `/v1/api/danh-sach/phim-bo?limit=33`
 *   Phim lẻ        lazy, `/api/home/phim-le`     `/v1/api/danh-sach/phim-le?limit=33`
 *   Hoạt hình      lazy, `/api/home/hoat-hinh`   `/v1/api/danh-sach/hoat-hinh?limit=33`
 *
 * Mỗi section trả đúng 16 phim, KHÔNG trùng phim nào đã có ở hero hay "Mới cập
 * nhật" — xin 33 là để còn đủ 16 sau khi loại trùng (`SECTION_FETCH_LIMIT`).
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
 * 12 phim trùng với row đầu, cả 6 card nhìn thấy đầu tiên đều trùng. Tệ nhất là
 * trùng hết `HOME_SHOWN` phim, nên xin thêm đúng chừng đó là luôn còn đủ.
 */
export const SECTION_FETCH_LIMIT = ROW_LIMIT + HOME_SHOWN;

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
 * Bỏ khỏi một section mọi phim đã có ở màn đầu (hero + "Mới cập nhật").
 *
 * Loại theo `HOME_SHOWN` phim đầu của nguồn chứ không theo đúng phim hero: route
 * không biết phim nào được chọn làm hero (bộ chọn còn xét backdrop và trailer),
 * nhưng biết chắc hero nằm trong khoảng đó — nên loại cả khoảng là vừa đủ.
 */
export function excludeShown<T extends { slug: string }>(
  items: readonly T[],
  feed: readonly { slug: string }[],
): T[] {
  const shown = new Set(feed.slice(0, HOME_SHOWN).map((movie) => movie.slug));
  return items.filter((movie) => !shown.has(movie.slug)).slice(0, ROW_LIMIT);
}

/**
 * Ba section lazy, lọc theo loại phim ngay ở API (`/v1/api/danh-sach/{type}`) chứ
 * không kéo một danh sách chung về rồi lọc ở client.
 *
 * Đồng thời là WHITELIST của `/api/home/[section]`: route đó chỉ nhận đúng ba giá
 * trị này, nên nó không thành một proxy mở tới KKPhim mà ai cũng nhét được cache
 * key tuỳ ý vào.
 */
export const HOME_SECTIONS = [
  'phim-bo',
  'phim-le',
  'hoat-hinh',
] as const satisfies readonly TypeList[];

export type HomeSection = (typeof HOME_SECTIONS)[number];

export function isHomeSection(value: string): value is HomeSection {
  return (HOME_SECTIONS as readonly string[]).includes(value);
}

/** Section trang chủ ứng với một nguồn danh sách, `null` nếu nguồn đó không phải section. */
export function homeSectionOf(source: ListSource): HomeSection | null {
  return source.kind === 'type' && isHomeSection(source.type) ? source.type : null;
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
