/**
 * Bản đồ endpoint (§3) → hàm đã typed, đã chuẩn hoá.
 *
 * Đây là bề mặt DUY NHẤT mà tầng trên (RSC, hook, store) được dùng để lấy dữ liệu.
 * Mọi hàm ở đây đã trả về type sau chuẩn hoá, không còn raw response.
 */

import { ApiError, request, requestOptional, type QueryParams } from './api';
import { REVALIDATE, TIMEOUT } from './constants';
import {
  normalizeDetail,
  normalizeImages,
  normalizeKeywords,
  normalizeList,
  normalizePeoples,
  normalizeTaxonomyList,
  normalizeYears,
} from './normalize';
import { DEFAULT_LIMIT, MAX_LIMIT, type ListFilters, type TypeList } from '@/types/filters';
import type {
  Keyword,
  Movie,
  MovieDetailBundle,
  MovieDetailResult,
  MovieImages,
  MovieListResult,
  Person,
  Taxonomy,
} from '@/types/movie';

/**
 * Mỗi endpoint tự khai ngân sách mặc định của nó, nhưng NƠI GỌI mới biết lời gọi
 * này cốt lõi hay chỉ là trang trí — cùng một `/phim/{slug}` là xương sống của
 * trang chi tiết mà lại chỉ để lấy link trailer khi đứng trong bộ chọn hero.
 */
type Fetchable = {
  signal?: AbortSignal;
  /**
   * Ghi đè `revalidate` mặc định của endpoint.
   *
   * Cần thiết vì `revalidate` của MỘT lời gọi quyết định `s-maxage` của CẢ trang:
   * Next lấy giá trị NHỎ NHẤT trong toàn bộ fetch của lượt render. Xem
   * `getRelated` — một danh sách phụ 300s từng kéo trang chi tiết 1800s xuống
   * theo nó.
   */
  revalidate?: number;
  /** ms. Mặc định theo `TIMEOUT` của từng endpoint. */
  timeout?: number;
  /** Số lần thử lại, không tính lần đầu. Mặc định 2 (§14.2). */
  retries?: number;
};

/** Ép `limit` về trần 64 mà API chấp nhận (§3.1, §17 rủi ro #11). */
function toParams(filters: ListFilters = {}): QueryParams {
  const { limit, ...rest } = filters;
  return {
    ...rest,
    ...(limit === undefined ? {} : { limit: Math.min(limit, MAX_LIMIT) }),
  };
}

const listOptions = (filters: ListFilters, opts: Fetchable) => ({
  params: toParams(filters),
  timeout: TIMEOUT.list,
  revalidate: REVALIDATE.list,
  ...opts,
});

/* -------------------------------- §3.1 danh sách ------------------------------- */

/** `/v1/api/home` — gọi ĐẦU TIÊN khi dựng trang chủ (§11.2). */
export async function getHome(opts: Fetchable = {}): Promise<MovieListResult> {
  const raw = await request('/v1/api/home', {
    timeout: TIMEOUT.list,
    revalidate: REVALIDATE.home,
    ...opts,
  });
  return normalizeList(raw);
}

export type NewlyUpdatedVersion = 'v1' | 'v2' | 'v3';

/** `/danh-sach/phim-moi-cap-nhat[-v2|-v3]` — Shape A. */
export async function getNewlyUpdated(
  page = 1,
  version: NewlyUpdatedVersion = 'v3',
  opts: Fetchable = {},
): Promise<MovieListResult> {
  const suffix = version === 'v1' ? '' : `-${version}`;
  const raw = await request(`/danh-sach/phim-moi-cap-nhat${suffix}`, listOptions({ page }, opts));
  return normalizeList(raw);
}

/** `/v1/api/danh-sach/{type_list}` — bản đủ filter. */
export async function getListByType(
  type: TypeList,
  filters: ListFilters = {},
  opts: Fetchable = {},
): Promise<MovieListResult> {
  const raw = await request(`/v1/api/danh-sach/${type}`, listOptions(filters, opts));
  return normalizeList(raw);
}

/** `/v1/api/danh-sach` — danh sách tổng hợp, không cần slug. */
export async function getList(
  filters: ListFilters = {},
  opts: Fetchable = {},
): Promise<MovieListResult> {
  const raw = await request('/v1/api/danh-sach', listOptions(filters, opts));
  return normalizeList(raw);
}

export async function getByCategory(
  slug: string,
  filters: ListFilters = {},
  opts: Fetchable = {},
): Promise<MovieListResult> {
  const raw = await request(`/v1/api/the-loai/${slug}`, listOptions(filters, opts));
  return normalizeList(raw);
}

export async function getByCountry(
  slug: string,
  filters: ListFilters = {},
  opts: Fetchable = {},
): Promise<MovieListResult> {
  const raw = await request(`/v1/api/quoc-gia/${slug}`, listOptions(filters, opts));
  return normalizeList(raw);
}

export async function getByYear(
  year: number,
  filters: ListFilters = {},
  opts: Fetchable = {},
): Promise<MovieListResult> {
  const raw = await request(`/v1/api/nam/${year}`, listOptions(filters, opts));
  return normalizeList(raw);
}

/** `/v1/api/tim-kiem?keyword=` */
export async function search(
  keyword: string,
  filters: ListFilters = {},
  opts: Fetchable = {},
): Promise<MovieListResult> {
  const raw = await request('/v1/api/tim-kiem', {
    params: { keyword, ...toParams(filters) },
    timeout: TIMEOUT.list,
    revalidate: REVALIDATE.search,
    ...opts,
  });
  return normalizeList(raw);
}

/* ------------------------------ §3.2 chi tiết phim ----------------------------- */

/** `/phim/{slug}` — Shape C (episodes tách ngoài `movie`). */
export async function getMovieDetail(
  slug: string,
  opts: Fetchable = {},
): Promise<MovieDetailResult> {
  const raw = await request(`/phim/${slug}`, {
    timeout: TIMEOUT.detail,
    revalidate: REVALIDATE.detail,
    ...opts,
  });
  return normalizeDetail(raw);
}

/** `/v1/api/phim/{slug}` — Shape D (episodes trong `data.item`). */
export async function getMovieDetailV1(
  slug: string,
  opts: Fetchable = {},
): Promise<MovieDetailResult> {
  const raw = await request(`/v1/api/phim/${slug}`, {
    timeout: TIMEOUT.detail,
    revalidate: REVALIDATE.detail,
    ...opts,
  });
  return normalizeDetail(raw);
}

export async function getMovieById(id: string, opts: Fetchable = {}): Promise<MovieDetailResult> {
  const raw = await request(`/phim/id/${id}`, {
    timeout: TIMEOUT.detail,
    revalidate: REVALIDATE.detail,
    ...opts,
  });
  return normalizeDetail(raw);
}

export async function getMovieByTmdb(
  type: 'movie' | 'tv',
  id: string | number,
  opts: Fetchable = {},
): Promise<MovieDetailResult> {
  const raw = await request(`/tmdb/${type}/${id}`, {
    timeout: TIMEOUT.detail,
    revalidate: REVALIDATE.detail,
    ...opts,
  });
  return normalizeDetail(raw);
}

export async function getMovieByImdb(ttid: string, opts: Fetchable = {}): Promise<MovieDetailResult> {
  const raw = await request(`/imdb/title/${ttid}`, {
    timeout: TIMEOUT.detail,
    revalidate: REVALIDATE.detail,
    ...opts,
  });
  return normalizeDetail(raw);
}

/* ---------------------------- §3.3 bổ trợ chi tiết ----------------------------- */
/* Ba endpoint này quyết định chất lượng thị giác nhưng KHÔNG cốt lõi:
   fail thì trả rỗng để UI ẩn im lặng (§14.1).

   `retries: 0` — KHÔNG thử lại, và đây là chỗ khác biệt so với endpoint cốt lõi.

   Cả ba nằm trong `Promise.all` của `getMovieBundle`, nghĩa là trang chi tiết
   không render được cho tới khi cả ba xong. Với `retries: 1` cũ, một endpoint
   chết lặng lẽ tốn:

       timeout 5s  +  backoff 1s  +  timeout 5s  =  11 giây

   mười một giây chờ để rồi hiện đúng cái giao diện mà `requestOptional` vốn đã
   sẵn sàng hiện ngay từ giây thứ năm. Không thử lại thì trần rơi về 5s.

   Cái giá: một cú chớp mạng làm mất dàn diễn viên trong suốt `REVALIDATE.detail`
   (30 phút, vì trang đã được cache). Đổi lại là phần cốt lõi — `getDetail` —
   vẫn giữ nguyên 2 lần thử; thứ đáng chờ thì vẫn được chờ.                      */

export async function getMovieImages(slug: string, opts: Fetchable = {}): Promise<MovieImages> {
  return requestOptional(
    async () =>
      normalizeImages(
        await request(`/v1/api/phim/${slug}/images`, {
          timeout: TIMEOUT.supplementary,
          revalidate: REVALIDATE.detail,
          retries: 0,
          ...opts,
        }),
      ),
    { backdrops: [], posters: [], logos: [] },
  );
}

export async function getMoviePeoples(slug: string, opts: Fetchable = {}): Promise<Person[]> {
  return requestOptional(
    async () =>
      normalizePeoples(
        await request(`/v1/api/phim/${slug}/peoples`, {
          timeout: TIMEOUT.supplementary,
          revalidate: REVALIDATE.detail,
          retries: 0,
          ...opts,
        }),
      ),
    [],
  );
}

export async function getMovieKeywords(slug: string, opts: Fetchable = {}): Promise<Keyword[]> {
  return requestOptional(
    async () =>
      normalizeKeywords(
        await request(`/v1/api/phim/${slug}/keywords`, {
          timeout: TIMEOUT.supplementary,
          revalidate: REVALIDATE.detail,
          retries: 0,
          ...opts,
        }),
      ),
    [],
  );
}

/* -------------------------------- §3.4 danh mục -------------------------------- */

export async function getCategories(opts: Fetchable = {}): Promise<Taxonomy[]> {
  const raw = await request('/the-loai', {
    timeout: TIMEOUT.taxonomy,
    revalidate: REVALIDATE.taxonomy,
    ...opts,
  });
  return normalizeTaxonomyList(raw);
}

export async function getCountries(opts: Fetchable = {}): Promise<Taxonomy[]> {
  const raw = await request('/quoc-gia', {
    timeout: TIMEOUT.taxonomy,
    revalidate: REVALIDATE.taxonomy,
    ...opts,
  });
  return normalizeTaxonomyList(raw);
}

export async function getYears(opts: Fetchable = {}): Promise<number[]> {
  const raw = await request('/nam-phat-hanh', {
    timeout: TIMEOUT.taxonomy,
    revalidate: REVALIDATE.taxonomy,
    ...opts,
  });
  return normalizeYears(raw);
}

/* ---------------------- gói dữ liệu dùng chung cho màn --------------------- */

/** Kết quả rỗng an toàn — dùng khi một danh sách phụ fail và UI chỉ cần ẩn đi (§14.1). */
export const EMPTY_LIST: MovieListResult = {
  items: [],
  pagination: { totalItems: 0, itemsPerPage: DEFAULT_LIMIT, currentPage: 1, totalPages: 1 },
};

/**
 * Chạy một lời gọi CỐT LÕI, trả `null` khi API nói 404.
 * Để page phân biệt được "phim không tồn tại" (→ `notFound()`) với "API hỏng"
 * (→ ném tiếp cho `error.tsx` hiện nút Thử lại) — §14.1, §14.2.
 */
export async function nullOn404<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) return null;
    throw error;
  }
}

/**
 * §3.2 — chi tiết phim, có phao dự phòng.
 *
 * `/phim/{slug}` (Format 1) và `/v1/api/phim/{slug}` (Format 2) trả CÙNG nội
 * dung qua hai shape khác nhau, mà adapter đọc được cả hai. API không cam kết
 * SLA (§17 rủi ro #9) nên khi đường thứ nhất hỏng vì lý do KHÔNG PHẢI 404 —
 * hoặc trả 200 với body rỗng — thử nốt đường thứ hai trước khi bỏ cuộc.
 *
 * 404 vẫn ném ngay: phim không tồn tại thì hỏi cách khác cũng không có.
 */
export async function getDetail(slug: string, opts: Fetchable = {}): Promise<MovieDetailResult> {
  try {
    const result = await getMovieDetail(slug, opts);
    if (result.movie.slug) return result;
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) throw error;
    // Caller chủ động huỷ thì đừng bắt đầu lời gọi thứ hai.
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
  }

  return getMovieDetailV1(slug, opts);
}

/**
 * §11.3 — màn chi tiết gọi SONG SONG 4 endpoint.
 *
 * Phần chi tiết là cốt lõi: fail thì ném lên để page xử lý. Ba endpoint bổ trợ
 * đã tự nuốt lỗi trong `getMovie*` nên chỉ làm nghèo giao diện chứ không chặn.
 */
export async function getMovieBundle(
  slug: string,
  opts: Fetchable = {},
): Promise<MovieDetailBundle> {
  const [detail, images, peoples, keywords] = await Promise.all([
    getDetail(slug, opts),
    getMovieImages(slug, opts),
    getMoviePeoples(slug, opts),
    getMovieKeywords(slug, opts),
  ]);

  return { ...detail, images, peoples, keywords };
}

/**
 * §8.5 mục 8 — "Có thể bạn thích": cùng thể loại chính, bỏ chính nó.
 * Phim không có thể loại, hoặc API fail → mảng rỗng, UI ẩn hẳn section (§14.1).
 */
export async function getRelated(
  movie: Pick<Movie, 'slug' | 'categories'>,
  limit = 12,
  opts: Fetchable = {},
): Promise<Movie[]> {
  const slug = movie.categories[0]?.slug;
  if (!slug) return [];

  const { items } = await requestOptional(
    () =>
      getByCategory(
        slug,
        { limit: Math.min(limit + 4, MAX_LIMIT) },
        /**
         * `REVALIDATE.detail` chứ không phải `.list` mặc định của endpoint danh sách.
         *
         * Không phải vì dữ liệu này tươi lâu hơn, mà vì nó là fetch NGẮN HẠN NHẤT
         * của trang chi tiết: để nguyên 300s thì cả trang chỉ sống được 300s ở CDN
         * dù phần cốt lõi khai 1800s. Một hàng "Có thể bạn thích" cũ hơn nửa tiếng
         * là thứ không ai nhận ra.
         */
        { revalidate: REVALIDATE.detail, ...opts },
      ),
    EMPTY_LIST,
  );

  return items.filter((item) => item.slug !== movie.slug).slice(0, limit);
}

export interface Taxonomies {
  categories: Taxonomy[];
  countries: Taxonomy[];
  years: number[];
}

/**
 * §3.4 — ba danh mục cho Navbar và FilterBar, gọi song song, cache 24h.
 *
 * Fail thì trả rỗng: menu thiếu một nhánh vẫn hơn là sập cả layout. Ba lời gọi
 * này đi qua fetch cache của Next nên gọi lại ở từng page gần như không tốn gì.
 */
export async function getTaxonomies(opts: Fetchable = {}): Promise<Taxonomies> {
  const [categories, countries, years] = await Promise.all([
    requestOptional(() => getCategories(opts), [] as Taxonomy[]),
    requestOptional(() => getCountries(opts), [] as Taxonomy[]),
    requestOptional(() => getYears(opts), [] as number[]),
  ]);

  return { categories, countries, years };
}

/**
 * Nguồn của màn đầu trang chủ — hero và row "Mới cập nhật" — kèm phao dự phòng.
 *
 * `/v1/api/home` trả cùng nội dung theo cùng thứ tự nhưng thiếu `thumb_url`, nên nó
 * chỉ là phao khi v3 hỏng. Một hàm dùng chung vì HAI nơi phải thấy cùng một danh
 * sách: RSC trang chủ dựng row từ nó, còn `/api/home/*` loại khỏi section những
 * phim đã có trong đó. Cùng URL, cùng `revalidate` → cùng một mục data cache của
 * Next, nên lời gọi thứ hai không chạm tới KKPhim.
 */
export async function getHomeFeed(opts: Fetchable = {}): Promise<MovieListResult> {
  return getNewlyUpdated(1, 'v3', opts).catch(() => getHome(opts).catch(() => EMPTY_LIST));
}

export interface HeroSpotlight {
  movie: Movie;
  images: MovieImages;
  /** §8.2 — link YouTube; rỗng là chuyện thường, hero giữ ảnh tĩnh (§17 rủi ro #5). */
  trailerUrl: string;
  /**
   * Mô tả phim, HTML THÔ từ API — nơi dùng phải tự đưa qua `lib/sanitize.ts`.
   * Rỗng khi `/phim/{slug}` hỏng; hero khi đó chỉ thiếu dòng tóm tắt.
   */
  content: string;
}

/** Số phim đầu danh sách được đem ra cân nhắc làm hero. */
export const HERO_CANDIDATES = 3;

/**
 * Chọn phim cho HeroBillboard (§8.2).
 *
 * Hero là ảnh LCP nên chất lượng ảnh quyết định cảm nhận cả trang: phim không có
 * backdrop trong `/images` buộc phải dùng `thumb_url` độ phân giải thấp (§17 rủi
 * ro #4). Vì vậy cân nhắc vài ứng viên đầu danh sách thay vì lấy bừa phim đầu
 * tiên — ưu tiên phim có CẢ backdrop lẫn trailer.
 *
 * Toàn bộ lời gọi nằm trong MỘT lượt song song (không phải chuỗi waterfall) và
 * đều đi qua fetch cache 30 phút, nên không vi phạm tinh thần §11.2.
 */
export async function getHeroSpotlight(
  candidates: Movie[],
  opts: Fetchable = {},
): Promise<HeroSpotlight | null> {
  const pool = candidates.slice(0, HERO_CANDIDATES);
  if (pool.length === 0) return null;

  const enriched = await Promise.all(
    pool.map(async (movie): Promise<HeroSpotlight> => {
      const [images, detail] = await Promise.all([
        getMovieImages(movie.slug, opts),
        /**
         * Ngân sách BỔ TRỢ, không phải ngân sách chi tiết — đây là chỗ duy nhất
         * gọi `getDetail` mà không cần chi tiết: thứ lấy ra chỉ là `trailerUrl`
         * (trang trí, chỉ chạy sau 2500ms và chỉ ở tier cao) và dòng tóm tắt dưới
         * tên phim — cả hai mất đi thì hero vẫn đủ dùng.
         *
         * Mặc định của nó (`timeout` 8s, `retries` 2) cộng thêm việc `getDetail`
         * còn có phao `/v1/api/phim/{slug}` đứng sau, cho ra đuôi xấu nhất
         * (8+1+8+2+8) × 2 ≈ 54 giây — chặn ngay giữa lượt dựng trang chủ, tức là
         * chặn cả `next build`. Một link YouTube không đáng chỗ đó.
         */
        requestOptional(
          () =>
            getDetail(movie.slug, {
              timeout: TIMEOUT.supplementary,
              retries: 0,
              ...opts,
            }),
          null,
        ),
      ]);

      return {
        movie,
        images,
        trailerUrl: detail?.movie.trailerUrl ?? '',
        content: detail?.movie.content ?? '',
      };
    }),
  );

  return (
    enriched.find((entry) => entry.images.backdrops.length > 0 && entry.trailerUrl !== '') ??
    enriched.find((entry) => entry.images.backdrops.length > 0) ??
    enriched[0] ??
    null
  );
}
