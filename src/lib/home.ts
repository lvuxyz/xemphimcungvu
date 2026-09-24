/**
 * Dữ liệu trang chủ: bốn section, và hình dạng card đi qua `/api/home/*`.
 *
 *   Mới cập nhật   RSC, nằm sẵn trong HTML      `/danh-sach/phim-moi-cap-nhat-v3`
 *   Phim bộ        lazy, `/api/home/phim-bo`     `/v1/api/danh-sach/phim-bo?limit=16`
 *   Phim lẻ        lazy, `/api/home/phim-le`     `/v1/api/danh-sach/phim-le?limit=16`
 *   Hoạt hình      lazy, `/api/home/hoat-hinh`   `/v1/api/danh-sach/hoat-hinh?limit=16`
 *
 * Dùng ở cả ba nơi — RSC trang chủ, route handler, và `LazyRow` trên trình duyệt —
 * nên file này KHÔNG được import thứ gì chỉ chạy ở server.
 */

import type { TypeList } from '@/types/filters';
import type { CardMovie } from '@/types/movie';
import { ApiError } from './api';
import type { ListSource } from './list-source';

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
