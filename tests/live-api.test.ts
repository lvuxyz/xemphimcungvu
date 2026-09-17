import { describe, expect, it } from 'vitest';
import {
  getByYear,
  getCategories,
  getCountries,
  getDetail,
  getHeroSpotlight,
  getHome,
  getList,
  getListByType,
  getMovieById,
  getMovieBundle,
  getMovieByImdb,
  getMovieByTmdb,
  getMovieDetail,
  getMovieDetailV1,
  getMovieImages,
  getMovieKeywords,
  getMoviePeoples,
  getNewlyUpdated,
  getRelated,
  getTaxonomies,
  getYears,
  search,
} from '@/lib/endpoints';

/**
 * Smoke test chạm API THẬT — mặc định bỏ qua để CI không phụ thuộc mạng.
 *
 *   LIVE_API=1 npx vitest run tests/live-api.test.ts
 *
 * Dùng khi nghi API đổi shape (§17 rủi ro #9 — không cam kết SLA).
 * Nếu test này đỏ mà test fixture vẫn xanh → API đã đổi, cần lấy fixture mới.
 */
const live = process.env['LIVE_API'] === '1';

describe.skipIf(!live)('KKPhim live API — hợp đồng endpoint', () => {
  it('GET /v1/api/home trả danh sách dùng được', { timeout: 20_000 }, async () => {
    const { items } = await getHome();
    expect(items.length).toBeGreaterThan(0);
    expect(items[0]?.slug).toBeTruthy();
    expect(items[0]?.poster).toMatch(/^https?:\/\//);
  });

  it('GET /danh-sach/phim-moi-cap-nhat-v3 (Shape A)', { timeout: 20_000 }, async () => {
    const { items, pagination } = await getNewlyUpdated(1);
    expect(items.length).toBeGreaterThan(0);
    expect(pagination.totalPages).toBeGreaterThan(1);
  });

  it('GET /v1/api/danh-sach/{type} (Shape B) resolve ảnh tuyệt đối', { timeout: 20_000 }, async () => {
    const { items } = await getListByType('phim-bo', { page: 1, limit: 10 });
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) expect(item.poster).toMatch(/^https:\/\//);
  });

  it('GET /phim/{slug} (Shape C) có episodes phát được', { timeout: 20_000 }, async () => {
    const { items } = await getListByType('phim-bo', { page: 1, limit: 5 });
    const slug = items[0]?.slug;
    expect(slug).toBeTruthy();

    const { movie, episodes } = await getMovieDetail(slug!);
    expect(movie.slug).toBe(slug);
    expect(episodes.length).toBeGreaterThan(0);
    expect(episodes[0]?.episodes[0]?.linkM3u8).toMatch(/^https?:\/\//);
  });

  it('nhóm bổ trợ §3.3 không throw dù shape đổi', { timeout: 20_000 }, async () => {
    const { items } = await getListByType('phim-le', { page: 1, limit: 5 });
    const slug = items[0]!.slug;

    const [images, peoples, keywords] = await Promise.all([
      getMovieImages(slug),
      getMoviePeoples(slug),
      getMovieKeywords(slug),
    ]);

    expect(Array.isArray(images.backdrops)).toBe(true);
    expect(Array.isArray(peoples)).toBe(true);
    expect(Array.isArray(keywords)).toBe(true);
    for (const url of images.backdrops) expect(url).toMatch(/^https:\/\//);
  });

  it('GET /v1/api/tim-kiem', { timeout: 20_000 }, async () => {
    const { items } = await search('phim', { limit: 8 });
    expect(items.length).toBeGreaterThan(0);
  });

  it('nhóm danh mục §3.4', { timeout: 20_000 }, async () => {
    const [categories, countries, years] = await Promise.all([
      getCategories(),
      getCountries(),
      getYears(),
    ]);
    expect(categories.length).toBeGreaterThan(0);
    expect(categories[0]?.slug).toBeTruthy();
    expect(countries.length).toBeGreaterThan(0);
    expect(years[0]).toBeGreaterThanOrEqual(new Date().getFullYear());
  });

  it('404 không retry và ném ApiError (§14.2)', { timeout: 20_000 }, async () => {
    await expect(getMovieDetail('slug-khong-ton-tai-xyz-123')).rejects.toMatchObject({
      name: 'ApiError',
    });
  });
});

/**
 * Nhóm thứ hai: các hàm được TRANG dùng trực tiếp (§11.2, §11.3) — chúng gộp
 * nhiều endpoint nên hỏng một mắt xích là cả màn hình trống.
 */
describe.skipIf(!live)('KKPhim live API — hàm gộp dùng ở tầng trang', () => {
  it('GET /v1/api/danh-sach (tổng hợp, không cần slug)', { timeout: 20_000 }, async () => {
    const { items, pagination } = await getList({ page: 1, limit: 8 });
    expect(items.length).toBeGreaterThan(0);
    expect(pagination.totalPages).toBeGreaterThan(1);
  });

  it('GET /v1/api/nam/{year}', { timeout: 20_000 }, async () => {
    const { items } = await getByYear(2024, { limit: 8 });
    expect(items.length).toBeGreaterThan(0);
  });

  it('getDetail — Shape C, và Shape D vẫn đọc được', { timeout: 30_000 }, async () => {
    const { items } = await getListByType('phim-bo', { page: 1, limit: 5 });
    const slug = items[0]!.slug;

    const [primary, fallback] = await Promise.all([getDetail(slug), getMovieDetailV1(slug)]);

    expect(primary.movie.slug).toBe(slug);
    // Hai format là hai shape của CÙNG một phim — phao thay được cho bản chính.
    expect(fallback.movie.slug).toBe(slug);
    expect(fallback.episodes.length).toBeGreaterThan(0);
  });

  it('getMovieBundle — 4 endpoint §11.3 về cùng một gói', { timeout: 30_000 }, async () => {
    const { items } = await getListByType('phim-le', { page: 1, limit: 5 });
    const slug = items[0]!.slug;

    const bundle = await getMovieBundle(slug);
    expect(bundle.movie.slug).toBe(slug);
    expect(Array.isArray(bundle.images.backdrops)).toBe(true);
    expect(Array.isArray(bundle.peoples)).toBe(true);
    expect(Array.isArray(bundle.keywords)).toBe(true);
  });

  it('getRelated — cùng thể loại, bỏ chính nó', { timeout: 30_000 }, async () => {
    const { items } = await getListByType('phim-bo', { page: 1, limit: 5 });
    const movie = items.find((item) => item.categories.length > 0);
    expect(movie).toBeTruthy();

    const related = await getRelated(movie!, 12);
    expect(related.every((item) => item.slug !== movie!.slug)).toBe(true);
  });

  it('getHeroSpotlight — hero luôn có phim để dựng', { timeout: 30_000 }, async () => {
    const { items } = await getHome();
    const hero = await getHeroSpotlight(items);

    expect(hero).not.toBeNull();
    expect(hero!.movie.slug).toBeTruthy();
    for (const url of hero!.images.backdrops) expect(url).toMatch(/^https:\/\//);
  });

  it('getTaxonomies — ba danh mục §3.4 trong một lượt', { timeout: 20_000 }, async () => {
    const { categories, countries, years } = await getTaxonomies();
    expect(categories.length).toBeGreaterThan(0);
    expect(countries.length).toBeGreaterThan(0);
    expect(years.length).toBeGreaterThan(0);
  });

  it('§3.2 — tra theo _id / TMDB / IMDB ra cùng một phim', { timeout: 30_000 }, async () => {
    const { items } = await getListByType('phim-bo', { page: 1, limit: 10 });
    const seed = items.find((item) => item.tmdb.id && item.tmdb.type);
    expect(seed).toBeTruthy();

    const byId = await getMovieById(seed!.id);
    expect(byId.movie.slug).toBe(seed!.slug);

    const byTmdb = await getMovieByTmdb(seed!.tmdb.type!, seed!.tmdb.id!);
    expect(byTmdb.movie.slug).toBe(seed!.slug);

    if (seed!.imdb.id) {
      const byImdb = await getMovieByImdb(seed!.imdb.id);
      expect(byImdb.movie.slug).toBe(seed!.slug);
    }
  });
});
