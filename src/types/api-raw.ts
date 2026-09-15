/**
 * Type mô tả RAW response của KKPhim (§3, §4.1).
 *
 * ⚠️ File này CHỈ được import bởi `src/lib/normalize.ts`.
 * ESLint chặn import từ mọi nơi khác (xem .eslintrc.json, §15).
 *
 * Mọi field đều optional: API không cam kết SLA và thường thiếu field (§17 rủi ro #9).
 * Adapter phải đọc bằng optional chaining và có giá trị mặc định an toàn.
 */

export interface RawTaxonomy {
  id?: string;
  name?: string;
  slug?: string;
}

export interface RawTmdb {
  type?: string | null;
  id?: string | null;
  season?: number | null;
  vote_average?: number;
  vote_count?: number;
}

export interface RawImdb {
  id?: string | null;
  vote_average?: number;
  vote_count?: number;
}

export interface RawTimestamp {
  time?: string;
}

/** Phần tử trong `items[]` của mọi endpoint danh sách. */
export interface RawMovieItem {
  _id?: string;
  name?: string;
  slug?: string;
  origin_name?: string;
  type?: string;
  /** Shape A: URL tuyệt đối · Shape B: path tương đối (§4.1) */
  poster_url?: string;
  thumb_url?: string;
  sub_docquyen?: boolean;
  chieurap?: boolean;
  time?: string;
  episode_current?: string;
  episode_total?: string;
  quality?: string;
  lang?: string;
  year?: number;
  view?: number;
  status?: string;
  content?: string;
  trailer_url?: string;
  is_copyright?: boolean;
  actor?: string[];
  director?: string[];
  category?: RawTaxonomy[];
  country?: RawTaxonomy[];
  modified?: RawTimestamp;
  created?: RawTimestamp;
  tmdb?: RawTmdb;
  imdb?: RawImdb;
  /** Shape D: episodes nằm trong item */
  episodes?: RawEpisodeServer[];
}

export interface RawEpisodeItem {
  name?: string;
  slug?: string;
  filename?: string;
  link_embed?: string;
  link_m3u8?: string;
}

export interface RawEpisodeServer {
  server_name?: string;
  server_data?: RawEpisodeItem[];
}

export interface RawPagination {
  totalItems?: number;
  totalItemsPerPage?: number;
  currentPage?: number;
  totalPages?: number;
  updateToday?: number;
}

/** Shape A — `/danh-sach/*` : phẳng, ảnh URL tuyệt đối. */
export interface RawListShapeA {
  status?: boolean | string;
  msg?: string;
  items?: RawMovieItem[];
  pagination?: RawPagination;
}

/** Shape B — `/v1/api/*` (list) : bọc `data`, ảnh URL tương đối. */
export interface RawListShapeB {
  status?: boolean | string;
  msg?: string;
  data?: {
    seoOnPage?: unknown;
    breadCrumb?: unknown[];
    titlePage?: string;
    items?: RawMovieItem[];
    params?: { pagination?: RawPagination; [k: string]: unknown };
    APP_DOMAIN_CDN_IMAGE?: string;
    type_list?: string;
  };
}

/** Shape C — `/phim/{slug}` : `episodes` tách ngoài `movie`. */
export interface RawDetailShapeC {
  status?: boolean | string;
  msg?: string;
  movie?: RawMovieItem;
  episodes?: RawEpisodeServer[];
}

/** Shape D — `/v1/api/phim/{slug}` : `episodes` nằm trong `data.item`. */
export interface RawDetailShapeD {
  status?: boolean | string;
  msg?: string;
  data?: {
    seoOnPage?: unknown;
    breadCrumb?: unknown[];
    params?: unknown;
    item?: RawMovieItem;
    APP_DOMAIN_CDN_IMAGE?: string;
  };
}

export type RawListResponse = RawListShapeA & RawListShapeB;
export type RawDetailResponse = RawDetailShapeC & RawDetailShapeD;

/**
 * §3.3 — `/images`, `/peoples`, `/keywords`.
 *
 * Shape này ĐÃ VERIFY bằng lời gọi thật ngày 15/09/2026 (Phụ lục A) và khác
 * với giả định trong §5.2: cả ba đều là dữ liệu TMDB, dùng envelope
 * `{ success, message, status_code, data }` chứ không phải `{ status, msg }`,
 * và đường dẫn ảnh là path TMDB phải ghép với base trong `image_sizes` /
 * `profile_sizes` — KHÔNG phải CDN phimimg.com.
 *
 * Xem tests/fixtures/{images,peoples,keywords}.json.
 */

/** Base URL theo từng kích thước, ví dụ `{ original: "https://image.tmdb.org/t/p/original", w780: ... }` */
export type RawImageSizeMap = Record<string, string | undefined>;

export interface RawImageEntry {
  width?: number;
  height?: number;
  aspect_ratio?: number;
  /** Đã quan sát: "backdrop" | "poster". "logo" KHÔNG xuất hiện trên API này. */
  type?: string;
  /** Path TMDB, ví dụ "/tBxBchbTsi801LWzyutNqCAACis.jpg" */
  file_path?: string;
}

export interface RawImagesResponse {
  success?: boolean;
  message?: string;
  status_code?: number;
  data?: {
    tmdb_id?: number | null;
    tmdb_type?: string | null;
    slug?: string;
    image_sizes?: Record<string, RawImageSizeMap | undefined>;
    images?: RawImageEntry[];
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

export interface RawPerson {
  tmdb_people_id?: number | string | null;
  id?: string | number;
  _id?: string;
  name?: string;
  original_name?: string;
  character?: string;
  job?: string;
  known_for_department?: string;
  gender_name?: string;
  /** Path TMDB, ghép với `profile_sizes` */
  profile_path?: string | null;
  profile?: string;
  [k: string]: unknown;
}

export interface RawPeoplesResponse {
  success?: boolean;
  message?: string;
  status_code?: number;
  data?: {
    profile_sizes?: RawImageSizeMap;
    peoples?: RawPerson[];
    cast?: RawPerson[];
    crew?: RawPerson[];
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

export interface RawKeywordEntry {
  tmdb_keyword_id?: number | string | null;
  name?: string;
  /** Bản tiếng Việt khi có — ưu tiên hiển thị field này */
  name_vn?: string;
}

export interface RawKeywordsResponse {
  success?: boolean;
  message?: string;
  status_code?: number;
  data?: {
    keywords?: RawKeywordEntry[] | string;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

/** `/the-loai`, `/quoc-gia` — có thể trả mảng trần hoặc bọc `data.items`. */
export type RawTaxonomyResponse =
  | RawTaxonomy[]
  | {
      status?: boolean | string;
      data?: { items?: RawTaxonomy[] };
      items?: RawTaxonomy[];
    };

/** `/nam-phat-hanh` — mảng số hoặc mảng object `{ year }`. */
export type RawYearsResponse =
  | Array<number | string | { year?: number | string; name?: number | string }>
  | { data?: { items?: unknown[] }; items?: unknown[] };
