/**
 * ADAPTER — 4 shape response → 1 model duy nhất (§4).
 *
 * Đây là file DUY NHẤT được phép import `types/api-raw`.
 * Không component nào chạm trực tiếp vào raw response (§2.2 nguyên tắc 1).
 *
 * Quy tắc bắt buộc (§4.2):
 *   · mọi truy cập field dùng optional chaining
 *   · field thiếu → giá trị mặc định an toàn, KHÔNG throw
 *   · có unit test cho cả 4 shape với fixture JSON thật
 */

import type {
  RawDetailResponse,
  RawEpisodeItem,
  RawEpisodeServer,
  RawImageEntry,
  RawImageSizeMap,
  RawImagesResponse,
  RawKeywordsResponse,
  RawListResponse,
  RawMovieItem,
  RawPagination,
  RawPeoplesResponse,
  RawPerson,
  RawTaxonomy,
  RawTaxonomyResponse,
  RawYearsResponse,
} from '@/types/api-raw';
import type {
  EpisodeServer,
  Keyword,
  Movie,
  MovieDetail,
  MovieDetailResult,
  MovieImages,
  MovieListResult,
  MovieType,
  Pagination,
  Person,
  Taxonomy,
} from '@/types/movie';
import { DEFAULT_LIMIT } from '@/types/filters';
import { resolveBackdrop, resolveImage } from './image';

export { resolveImage } from './image';

/* ---------------------------- primitive guards ---------------------------- */

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const str = (v: unknown, fallback = ''): string =>
  typeof v === 'string' ? v : typeof v === 'number' ? String(v) : fallback;

const num = (v: unknown, fallback = 0): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const parsed = Number(v);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const bool = (v: unknown, fallback = false): boolean =>
  typeof v === 'boolean' ? v : v === 'true' ? true : v === 'false' ? false : fallback;

const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Dò nhiều tên field khả dĩ — shape bổ trợ chưa verify (§5.2, §17 rủi ro #3). */
function pick(source: unknown, keys: string[]): unknown {
  if (!isObject(source)) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

const MOVIE_TYPES: readonly MovieType[] = ['single', 'series', 'hoathinh', 'tvshows'];

function toMovieType(v: unknown): MovieType {
  const raw = str(v).toLowerCase();
  return (MOVIE_TYPES as readonly string[]).includes(raw) ? (raw as MovieType) : 'single';
}

function toTmdbType(v: unknown): 'tv' | 'movie' | null {
  const raw = str(v).toLowerCase();
  return raw === 'tv' || raw === 'movie' ? raw : null;
}

function normalizeTaxonomy(list: unknown): Taxonomy[] {
  return arr<RawTaxonomy>(list)
    .map((t) => ({ id: str(t?.id), name: str(t?.name), slug: str(t?.slug) }))
    .filter((t) => t.name !== '' || t.slug !== '');
}

/* ------------------------------- movie item ------------------------------- */

function normalizeMovie(raw: RawMovieItem | undefined, cdnBase?: string): Movie {
  /**
   * `/v1/api/home` chỉ trả `poster_url`, KHÔNG có `thumb_url` (kiểm tra thật
   * 17/09/2026) — card 16:9 của ContentRow sẽ rỗng nếu không mượn tạm ảnh còn
   * lại. Mượn chéo hai chiều: thà cắt ảnh sai tỉ lệ còn hơn hiện placeholder.
   */
  const posterPath = str(raw?.poster_url) || str(raw?.thumb_url);
  const thumbPath = str(raw?.thumb_url) || str(raw?.poster_url);

  return {
    id: str(raw?._id),
    name: str(raw?.name),
    slug: str(raw?.slug),
    originName: str(raw?.origin_name),
    type: toMovieType(raw?.type),
    poster: resolveImage(posterPath, cdnBase),
    thumb: resolveBackdrop(thumbPath, cdnBase),
    duration: str(raw?.time),
    episodeCurrent: str(raw?.episode_current),
    quality: str(raw?.quality),
    lang: str(raw?.lang),
    year: num(raw?.year),
    subExclusive: bool(raw?.sub_docquyen),
    modifiedAt: str(raw?.modified?.time),
    tmdb: {
      id: raw?.tmdb?.id ?? null,
      type: toTmdbType(raw?.tmdb?.type),
      season: typeof raw?.tmdb?.season === 'number' ? raw.tmdb.season : null,
      vote_average: num(raw?.tmdb?.vote_average),
      vote_count: num(raw?.tmdb?.vote_count),
    },
    imdb: {
      id: raw?.imdb?.id ?? null,
      vote_average: num(raw?.imdb?.vote_average),
      vote_count: num(raw?.imdb?.vote_count),
    },
    categories: normalizeTaxonomy(raw?.category),
    countries: normalizeTaxonomy(raw?.country),
  };
}

function normalizeMovieDetail(raw: RawMovieItem | undefined, cdnBase?: string): MovieDetail {
  return {
    ...normalizeMovie(raw, cdnBase),
    content: str(raw?.content),
    status: str(raw?.status),
    trailerUrl: str(raw?.trailer_url),
    episodeTotal: str(raw?.episode_total),
    view: num(raw?.view),
    isCopyright: bool(raw?.is_copyright),
    inTheater: bool(raw?.chieurap),
    actors: arr<unknown>(raw?.actor)
      .map((a) => str(a))
      .filter(Boolean),
    directors: arr<unknown>(raw?.director)
      .map((d) => str(d))
      .filter(Boolean),
    createdAt: str(raw?.created?.time),
  };
}

/* ------------------------------- pagination ------------------------------- */

function normalizePagination(raw: RawPagination | undefined, itemCount: number): Pagination {
  const itemsPerPage = num(raw?.totalItemsPerPage, itemCount || DEFAULT_LIMIT);
  const totalItems = num(raw?.totalItems, itemCount);
  const currentPage = Math.max(1, num(raw?.currentPage, 1));
  const totalPages = Math.max(
    1,
    num(raw?.totalPages, itemsPerPage > 0 ? Math.ceil(totalItems / itemsPerPage) : 1),
  );
  return { totalItems, itemsPerPage, currentPage, totalPages };
}

/* ----------------------------- public: list ------------------------------ */

/**
 * Nhận Shape A (`/danh-sach/*`, phẳng, URL tuyệt đối)
 * hoặc Shape B (`/v1/api/*`, bọc `data`, URL tương đối) — §4.1.
 */
export function normalizeList(raw: unknown): MovieListResult {
  const res = (isObject(raw) ? raw : {}) as RawListResponse;

  // Shape B đặt items trong `data` và kèm CDN base; Shape A để phẳng.
  const data = isObject(res.data) ? res.data : undefined;
  const cdnBase = str(data?.APP_DOMAIN_CDN_IMAGE) || undefined;

  const rawItems = arr<RawMovieItem>(data?.items ?? res.items);
  const rawPagination = data?.params?.pagination ?? res.pagination;

  const items = rawItems.map((item) => normalizeMovie(item, cdnBase));

  return { items, pagination: normalizePagination(rawPagination, items.length) };
}

/* ---------------------------- public: detail ----------------------------- */

function normalizeEpisodes(raw: unknown): EpisodeServer[] {
  return arr<RawEpisodeServer>(raw)
    .map((server) => ({
      serverName: str(server?.server_name, 'Server'),
      episodes: arr<RawEpisodeItem>(server?.server_data)
        .map((ep) => ({
          name: str(ep?.name),
          slug: str(ep?.slug),
          filename: str(ep?.filename),
          linkEmbed: str(ep?.link_embed),
          linkM3u8: str(ep?.link_m3u8),
        }))
        .filter((ep) => ep.linkM3u8 !== '' || ep.linkEmbed !== ''),
    }))
    .filter((server) => server.episodes.length > 0);
}

/**
 * Nhận Shape C (`/phim/{slug}`, episodes tách ngoài `movie`)
 * hoặc Shape D (`/v1/api/phim/{slug}`, episodes trong `data.item`) — §4.1.
 */
export function normalizeDetail(raw: unknown): MovieDetailResult {
  const res = (isObject(raw) ? raw : {}) as RawDetailResponse;

  const data = isObject(res.data) ? res.data : undefined;
  const cdnBase = str(data?.APP_DOMAIN_CDN_IMAGE) || undefined;

  const item = data?.item ?? res.movie;
  const episodes = normalizeEpisodes(res.episodes ?? item?.episodes);

  return { movie: normalizeMovieDetail(item, cdnBase), episodes };
}

/* ------------------------- public: dữ liệu bổ trợ ------------------------- */

/**
 * `/images`, `/peoples` trả path TMDB (`/abc.jpg`) kèm bảng base theo kích thước.
 * Chọn base theo thứ tự ưu tiên, rơi về `original` rồi về CDN TMDB mặc định.
 */
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/original';

function joinSized(path: unknown, sizes: RawImageSizeMap | undefined, prefer: string[]): string {
  if (typeof path !== 'string' || path.trim() === '') return '';
  if (/^https?:\/\//i.test(path)) return path;

  const base =
    prefer.map((key) => sizes?.[key]).find((value): value is string => Boolean(value)) ??
    sizes?.['original'] ??
    TMDB_IMAGE_BASE;

  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

/**
 * `/v1/api/phim/{slug}/images` (§3.3).
 *
 * Shape thật: `data.images[]` phẳng, phân loại bằng field `type`, path ghép với
 * `data.image_sizes[type]`. Vẫn giữ nhánh đọc `backdrops/posters/logos` của §5.2
 * phòng khi API đổi shape.
 *
 * ⚠️ `logos` luôn rỗng trên API này — khảo sát 10 phim chỉ thấy "backdrop" và
 * "poster" (§17 rủi ro #3). Hero PHẢI dựng title bằng chữ, coi logo là bonus.
 */
export function normalizeImages(raw: unknown): MovieImages {
  const res = (isObject(raw) ? raw : {}) as RawImagesResponse;
  const data = isObject(res.data) ? res.data : {};
  const sizes = isObject(data['image_sizes'])
    ? (data['image_sizes'] as Record<string, RawImageSizeMap | undefined>)
    : {};

  const result: MovieImages = { backdrops: [], posters: [], logos: [] };

  // Nhánh chính: mảng phẳng có `type`.
  for (const entry of arr<RawImageEntry>(data['images'])) {
    const type = str(entry?.type).toLowerCase();
    const bucket =
      type === 'backdrop'
        ? result.backdrops
        : type === 'poster'
          ? result.posters
          : type === 'logo'
            ? result.logos
            : null;
    if (!bucket) continue;

    // Backdrop cho hero cần bản lớn; poster/logo chỉ cần vừa đủ.
    const prefer = type === 'backdrop' ? ['original', 'w1280'] : ['w500', 'w780', 'original'];
    const url = joinSized(entry?.file_path, sizes[type], prefer);
    if (url) bucket.push(url);
  }

  // Nhánh dự phòng: shape `{ backdrops, posters, logos }` như §5.2 mô tả.
  const fallbackScope = { ...data, ...res };
  const collect = (keys: string[]): string[] =>
    arr<unknown>(pick(fallbackScope, keys))
      .map((entry) =>
        typeof entry === 'string'
          ? resolveImage(entry, undefined, '')
          : joinSized(pick(entry, ['file_path', 'url', 'link', 'path', 'src']), undefined, []),
      )
      .filter((url) => url !== '');

  if (result.backdrops.length === 0) result.backdrops = collect(['backdrops', 'backdrop']);
  if (result.posters.length === 0) result.posters = collect(['posters']);
  if (result.logos.length === 0) result.logos = collect(['logos', 'logo']);

  return result;
}

/**
 * `/v1/api/phim/{slug}/peoples` (§3.3, §8.6).
 * `profile_path` là path TMDB, ghép với `data.profile_sizes` — w185 vừa đủ
 * cho avatar 80px, không tải thừa (§12.2).
 */
export function normalizePeoples(raw: unknown): Person[] {
  const res = (isObject(raw) ? raw : {}) as RawPeoplesResponse;
  const data = isObject(res.data) ? res.data : {};
  const sizes = isObject(data['profile_sizes']) ? (data['profile_sizes'] as RawImageSizeMap) : undefined;

  const buckets = [
    ...arr<RawPerson>(pick(data, ['peoples', 'people', 'items', 'casts']) ?? pick(res, ['peoples'])),
    ...arr<RawPerson>(pick(data, ['cast'])),
    ...arr<RawPerson>(pick(data, ['crew'])),
  ];

  const seen = new Set<string>();
  const people: Person[] = [];

  for (const p of buckets) {
    const name = str(pick(p, ['name', 'original_name']));
    if (!name) continue;

    const id = str(pick(p, ['tmdb_people_id', 'id', '_id']), name);
    const key = `${id}:${str(pick(p, ['character', 'job']))}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const profile = joinSized(pick(p, ['profile_path', 'profile', 'avatar', 'image']), sizes, [
      'w185',
      'h632',
      'original',
    ]);

    people.push({
      id,
      name,
      character: str(pick(p, ['character'])) || undefined,
      job: str(pick(p, ['job', 'known_for_department'])) || undefined,
      profile: profile || undefined,
    });
  }

  return people;
}

/**
 * `/v1/api/phim/{slug}/keywords` (§3.3, §8.5).
 * Shape thật: `data.keywords[] = { tmdb_keyword_id, name, name_vn }`.
 * Ưu tiên `name_vn`. Vẫn chấp nhận mảng string và chuỗi CSV.
 */
export function normalizeKeywords(raw: unknown): Keyword[] {
  const res = (isObject(raw) ? raw : {}) as RawKeywordsResponse;
  const data = isObject(res.data) ? res.data : {};
  const source = pick(data, ['keywords', 'keyword', 'items', 'tags']) ?? pick(res, ['keywords']);

  if (typeof source === 'string') {
    return source
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
  }

  const seen = new Set<string>();
  const keywords: Keyword[] = [];

  for (const entry of arr<unknown>(source)) {
    const value = (
      typeof entry === 'string' ? entry : str(pick(entry, ['name_vn', 'name', 'title', 'slug']))
    ).trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    keywords.push(value);
  }

  return keywords;
}

/** `/the-loai`, `/quoc-gia` — mảng trần hoặc bọc `data.items` (§3.4). */
export function normalizeTaxonomyList(raw: unknown): Taxonomy[] {
  const res = raw as RawTaxonomyResponse;
  if (Array.isArray(res)) return normalizeTaxonomy(res);
  return normalizeTaxonomy(pick(res, ['items']) ?? pick(pick(res, ['data']), ['items']));
}

/** `/nam-phat-hanh` — mảng số, mảng chuỗi, hoặc mảng object `{ year }`. */
export function normalizeYears(raw: unknown): number[] {
  const res = raw as RawYearsResponse;
  const source = Array.isArray(res)
    ? res
    : arr<unknown>(pick(res, ['items']) ?? pick(pick(res, ['data']), ['items']));

  const years = arr<unknown>(source)
    .map((y) => (isObject(y) ? num(pick(y, ['year', 'name', 'slug'])) : num(y)))
    .filter((y) => y >= 1911 && y <= new Date().getFullYear() + 2);

  return [...new Set(years)].sort((a, b) => b - a);
}
