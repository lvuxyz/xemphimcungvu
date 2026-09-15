/**
 * Model SAU chuẩn hoá (§5.1). Đây là type duy nhất mà component được phép dùng.
 * Mọi dữ liệu tới đây đều đã đi qua `lib/normalize.ts` (§2.2 nguyên tắc 1).
 */

export type MovieType = 'single' | 'series' | 'hoathinh' | 'tvshows';

export interface Taxonomy {
  id: string;
  name: string;
  slug: string;
}

export interface RatingSource {
  id: string | null;
  vote_average: number;
  vote_count: number;
}

export interface Movie {
  id: string;
  name: string;
  slug: string;
  originName: string;
  type: MovieType;
  /** Đã resolve tuyệt đối, tỉ lệ dọc 2:3 */
  poster: string;
  /** Đã resolve tuyệt đối, tỉ lệ ngang 16:9 */
  thumb: string;
  /** "23 phút/tập" | "100 phút" */
  duration: string;
  /** "Tập 33" | "Hoàn Tất (24/24)" | "Full" */
  episodeCurrent: string;
  quality: string;
  lang: string;
  year: number;
  subExclusive: boolean;
  /** ISO string */
  modifiedAt: string;
  tmdb: RatingSource & { type: 'tv' | 'movie' | null; season: number | null };
  imdb: RatingSource;
  categories: Taxonomy[];
  countries: Taxonomy[];
}

export interface MovieDetail extends Movie {
  /** HTML thô từ API — PHẢI đi qua `lib/sanitize.ts` trước khi render (§14.4) */
  content: string;
  status: string;
  trailerUrl: string;
  episodeTotal: string;
  view: number;
  isCopyright: boolean;
  /** `chieurap` */
  inTheater: boolean;
  actors: string[];
  directors: string[];
  createdAt: string;
}

export interface EpisodeItem {
  name: string;
  slug: string;
  filename: string;
  linkEmbed: string;
  linkM3u8: string;
}

export interface EpisodeServer {
  serverName: string;
  episodes: EpisodeItem[];
}

export interface Pagination {
  totalItems: number;
  itemsPerPage: number;
  currentPage: number;
  totalPages: number;
}

export interface MovieListResult {
  items: Movie[];
  pagination: Pagination;
}

export interface MovieDetailResult {
  movie: MovieDetail;
  episodes: EpisodeServer[];
}

/** §5.2 — dữ liệu bổ trợ */
export interface MovieImages {
  backdrops: string[];
  posters: string[];
  /** Dùng làm title hero nếu có (§8.2) */
  logos: string[];
}

export interface Person {
  id: string;
  name: string;
  /** Vai diễn */
  character?: string;
  /** "Director" | "Writer"... */
  job?: string;
  /** Ảnh chân dung, có thể rỗng */
  profile?: string;
}

export type Keyword = string;
