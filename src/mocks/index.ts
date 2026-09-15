/**
 * Dữ liệu mock TĨNH cho giai đoạn dựng giao diện.
 *
 * KHÔNG gọi mạng. Fixture trong `./fixtures` là response thật đã chụp lại từ
 * phimapi.com (15/09/2026), chạy qua đúng adapter ở `lib/normalize.ts` nên UI
 * nhận được model y hệt lúc nối API thật.
 *
 * Khi chuyển sang dữ liệu thật: thay lời gọi `getMock*()` trong `app/**` bằng
 * hàm tương ứng ở `lib/endpoints.ts` — component không phải sửa gì.
 */

import {
  normalizeDetail,
  normalizeImages,
  normalizeKeywords,
  normalizeList,
  normalizePeoples,
  normalizeTaxonomyList,
  normalizeYears,
} from '@/lib/normalize';
import { matchesSearch, searchKey } from '@/lib/text';
import type {
  EpisodeServer,
  Keyword,
  Movie,
  MovieDetail,
  MovieImages,
  Person,
  Taxonomy,
} from '@/types/movie';

import rowsRaw from './fixtures/rows.json';
import heroImagesRaw from './fixtures/hero-images.json';
import detailRaw from './fixtures/detail.json';
import detailImagesRaw from './fixtures/detail-images.json';
import detailPeoplesRaw from './fixtures/detail-peoples.json';
import detailKeywordsRaw from './fixtures/detail-keywords.json';
import theLoaiRaw from './fixtures/the-loai.json';
import quocGiaRaw from './fixtures/quoc-gia.json';
import namRaw from './fixtures/nam-phat-hanh.json';

export interface MockRow {
  title: string;
  movies: Movie[];
}

const CDN = (rowsRaw as { cdn: string }).cdn;

/** Fixture lưu dạng phẳng; bọc lại thành Shape B để đi qua đúng nhánh adapter. */
function toRow(entry: { title: string; items: unknown[] }): MockRow {
  const { items } = normalizeList({
    data: { items: entry.items, APP_DOMAIN_CDN_IMAGE: CDN },
  });
  return { title: entry.title, movies: items };
}

export const mockRows: MockRow[] = (rowsRaw as { rows: { title: string; items: unknown[] }[] }).rows.map(
  toRow,
);

/** Mọi phim có trong mock, đã khử trùng theo slug. */
export const mockMovies: Movie[] = Array.from(
  new Map(mockRows.flatMap((row) => row.movies).map((m) => [m.slug, m])).values(),
);

export function findMockMovie(slug: string): Movie | undefined {
  return mockMovies.find((m) => m.slug === slug);
}

/* ------------------------------ hero ------------------------------ */

const heroEntries = (heroImagesRaw as { slug: string; images: unknown; trailerUrl?: string }[])
  .map((entry) => ({
    slug: entry.slug,
    images: normalizeImages(entry.images),
    trailerUrl: entry.trailerUrl ?? '',
  }))
  .filter((entry) => entry.images.backdrops.length > 0);

export interface MockHero {
  movie: Movie;
  images: MovieImages;
  /** Link YouTube; rỗng là chuyện thường — 3/5 phim trong mock không có (§17 rủi ro #5). */
  trailerUrl: string;
}

/** Danh sách phim đủ điều kiện làm hero — có backdrop độ phân giải cao (§8.2). */
export const mockHeroes: MockHero[] = heroEntries
  .map((entry) => {
    const movie = findMockMovie(entry.slug);
    return movie ? { movie, images: entry.images, trailerUrl: entry.trailerUrl } : null;
  })
  .filter((entry): entry is MockHero => entry !== null);

/**
 * Hero của trang chủ — ưu tiên phim có CẢ backdrop lẫn trailer.
 * Đây cũng là quy tắc hợp lý khi nối API thật: billboard nên chọn phim dựng được
 * đầy đủ hiệu ứng, thay vì phim chỉ có ảnh tĩnh.
 */
export const mockHero: MockHero =
  mockHeroes.find((h) => h.trailerUrl !== '') ??
  mockHeroes[0] ?? {
    movie: mockMovies[0]!,
    images: { backdrops: [], posters: [], logos: [] },
    trailerUrl: '',
  };

/* ----------------------------- detail ----------------------------- */

const detail = normalizeDetail(detailRaw);

export interface MockDetail {
  movie: MovieDetail;
  episodes: EpisodeServer[];
  images: MovieImages;
  peoples: Person[];
  keywords: Keyword[];
}

export const mockDetail: MockDetail = {
  movie: detail.movie,
  episodes: detail.episodes,
  images: normalizeImages(detailImagesRaw),
  peoples: normalizePeoples(detailPeoplesRaw),
  keywords: normalizeKeywords(detailKeywordsRaw),
};

/**
 * Chi tiết cho một slug bất kỳ.
 * Mock chỉ có episodes/cast thật của đúng một phim; các slug khác mượn lại phần
 * đó và giữ nguyên metadata của chính nó, đủ để dựng và xem giao diện.
 */
export function getMockDetail(slug: string): MockDetail {
  if (slug === mockDetail.movie.slug) return mockDetail;

  const movie = findMockMovie(slug);
  if (!movie) return mockDetail;

  const hero = mockHeroes.find((h) => h.movie.slug === slug);

  return {
    movie: {
      ...movie,
      content: mockDetail.movie.content,
      status: mockDetail.movie.status,
      trailerUrl: mockDetail.movie.trailerUrl,
      episodeTotal: mockDetail.movie.episodeTotal,
      view: mockDetail.movie.view,
      isCopyright: false,
      inTheater: false,
      actors: mockDetail.movie.actors,
      directors: mockDetail.movie.directors,
      createdAt: movie.modifiedAt,
    },
    episodes: mockDetail.episodes,
    images: hero?.images ?? mockDetail.images,
    peoples: mockDetail.peoples,
    keywords: mockDetail.keywords,
  };
}

/* ---------------------------- danh mục ---------------------------- */

export const mockCategories: Taxonomy[] = normalizeTaxonomyList(theLoaiRaw);
export const mockCountries: Taxonomy[] = normalizeTaxonomyList(quocGiaRaw);
export const mockYears: number[] = normalizeYears(namRaw);

/* ------------------------ tiện ích cho trang ------------------------ */

/** Lưới cho trang danh sách / tìm kiếm — lặp lại mock cho đủ số lượng. */
export function getMockGrid(count = 24, offset = 0): Movie[] {
  const out: Movie[] = [];
  for (let i = 0; i < count; i++) {
    const movie = mockMovies[(i + offset) % mockMovies.length];
    if (movie) out.push(movie);
  }
  return out;
}

/**
 * Chỉ mục tìm kiếm rút gọn cho client.
 *
 * SearchBox là client component; nếu nó import thẳng `mockMovies` thì toàn bộ
 * mock (~195KB JSON) lọt vào bundle initial và phá ngân sách 180KB của §12.1.
 * Bản rút gọn này chỉ mang field cần để vẽ dropdown.
 * Khi nối API thật, thay bằng truy vấn `/v1/api/tim-kiem` và bỏ hẳn chỉ mục.
 */
export interface SearchIndexItem {
  slug: string;
  name: string;
  originName: string;
  poster: string;
  year: number;
  quality: string;
}

export const mockSearchIndex: SearchIndexItem[] = mockMovies.map((m) => ({
  slug: m.slug,
  name: m.name,
  originName: m.originName,
  poster: m.poster,
  year: m.year,
  quality: m.quality,
}));

/** Lọc thô theo từ khoá — chỉ để trang tìm kiếm có gì đó hiển thị. */
export function searchMock(keyword: string): Movie[] {
  const needle = searchKey(keyword);
  if (!needle) return [];
  return mockMovies.filter(
    (m) => matchesSearch(m.name, needle) || matchesSearch(m.originName, needle),
  );
}

/** "Có thể bạn thích" — cùng thể loại, bỏ chính nó (§8.5). */
export function relatedMock(movie: Movie, limit = 12): Movie[] {
  const slug = movie.categories[0]?.slug;
  const pool = slug
    ? mockMovies.filter((m) => m.slug !== movie.slug && m.categories.some((c) => c.slug === slug))
    : [];
  return (pool.length >= 6 ? pool : mockMovies.filter((m) => m.slug !== movie.slug)).slice(0, limit);
}
