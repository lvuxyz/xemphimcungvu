import { describe, expect, it } from 'vitest';
import {
  getCategories,
  getCountries,
  getHome,
  getListByType,
  getMovieDetail,
  getMovieImages,
  getMovieKeywords,
  getMoviePeoples,
  getNewlyUpdated,
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
