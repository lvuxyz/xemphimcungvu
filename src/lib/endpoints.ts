/**
 * Bản đồ endpoint (§3) → hàm đã typed, đã chuẩn hoá.
 *
 * Đây là bề mặt DUY NHẤT mà tầng trên (RSC, hook, store) được dùng để lấy dữ liệu.
 * Mọi hàm ở đây đã trả về type sau chuẩn hoá, không còn raw response.
 */

import { request, requestOptional, type QueryParams } from './api';
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
import { MAX_LIMIT, type ListFilters, type TypeList } from '@/types/filters';
import type {
  Keyword,
  MovieDetailResult,
  MovieImages,
  MovieListResult,
  Person,
  Taxonomy,
} from '@/types/movie';

type Fetchable = { signal?: AbortSignal };

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
   fail thì trả rỗng để UI ẩn im lặng (§14.1).                                    */

export async function getMovieImages(slug: string, opts: Fetchable = {}): Promise<MovieImages> {
  return requestOptional(
    async () =>
      normalizeImages(
        await request(`/v1/api/phim/${slug}/images`, {
          timeout: TIMEOUT.supplementary,
          revalidate: REVALIDATE.detail,
          retries: 1,
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
          retries: 1,
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
          retries: 1,
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
