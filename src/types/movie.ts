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

/**
 * Phần của `Movie` mà một CARD thật sự đọc — MovieCard, HoverPreview, và nút
 * "Danh sách của tôi" (lưu cả loại phim + slug taxonomy để tính sở thích).
 *
 * Đây là hình dạng đi qua `/api/home/*` và vào HTML của row đầu trang chủ. Khai
 * bằng type chứ không chỉ bằng hàm cắt (`toCardMovie`) để TypeScript chặn được
 * chiều ngược lại: card mà đọc thêm một field ngoài danh sách này là lỗi biên
 * dịch, không phải một ô trống lặng lẽ trên trang chủ.
 *
 * Mọi `Movie` đều gán được vào đây, nên nơi khác (grid, modal) vẫn truyền thẳng.
 */
export type CardMovie = Pick<
  Movie,
  | 'id'
  | 'slug'
  | 'name'
  | 'originName'
  | 'type'
  | 'poster'
  | 'thumb'
  | 'year'
  | 'episodeCurrent'
  | 'quality'
  | 'duration'
> & {
  /** Chỉ đủ để tính "% phù hợp" (`matchScore`). */
  tmdb: Pick<RatingSource, 'vote_average' | 'vote_count'>;
  imdb: Pick<RatingSource, 'vote_average' | 'vote_count'>;
  /** Chip thể loại ở HoverPreview + tín hiệu sở thích. Không cần `id`. */
  categories: Pick<Taxonomy, 'name' | 'slug'>[];
  countries: Pick<Taxonomy, 'name' | 'slug'>[];
};

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

/**
 * Gói dữ liệu đầy đủ của màn chi tiết — §11.3 gọi song song 4 endpoint:
 * `/phim/{slug}` (cốt lõi) + `/images` + `/peoples` + `/keywords` (bổ trợ).
 * Ba phần bổ trợ fail thì về rỗng, KHÔNG làm hỏng cả màn (§14.1).
 */
export interface MovieDetailBundle extends MovieDetailResult {
  images: MovieImages;
  peoples: Person[];
  keywords: Keyword[];
}
