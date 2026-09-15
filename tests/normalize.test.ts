import { describe, expect, it } from 'vitest';
import {
  normalizeDetail,
  normalizeImages,
  normalizeKeywords,
  normalizeList,
  normalizePeoples,
  normalizeTaxonomyList,
  normalizeYears,
} from '@/lib/normalize';

import shapeA from './fixtures/shape-a-danh-sach.json';
import shapeB from './fixtures/shape-b-v1-danh-sach.json';
import shapeC from './fixtures/shape-c-phim-slug.json';
import shapeD from './fixtures/shape-d-v1-phim-slug.json';
import home from './fixtures/home.json';
import images from './fixtures/images.json';
import peoples from './fixtures/peoples.json';
import keywords from './fixtures/keywords.json';
import theLoai from './fixtures/the-loai.json';
import quocGia from './fixtures/quoc-gia.json';
import namPhatHanh from './fixtures/nam-phat-hanh.json';

/**
 * §4.2 — "Viết unit test cho cả 4 shape với fixture JSON thật."
 * Fixture trong tests/fixtures được lấy từ phimapi.com ngày 15/09/2026.
 */

describe('normalizeList — Shape A (/danh-sach/*, phẳng, URL tuyệt đối)', () => {
  const result = normalizeList(shapeA);

  it('đọc được items ở cấp cao nhất', () => {
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0]?.name).toBeTruthy();
    expect(result.items[0]?.slug).toBeTruthy();
  });

  it('giữ nguyên URL ảnh đã tuyệt đối, không nối thêm CDN', () => {
    for (const item of result.items) {
      expect(item.poster).toMatch(/^https?:\/\//);
      expect(item.poster).not.toMatch(/phimimg\.com\/https/);
    }
  });

  it('đọc pagination ở cấp cao nhất', () => {
    expect(result.pagination.totalPages).toBeGreaterThan(0);
    expect(result.pagination.currentPage).toBe(1);
  });
});

describe('normalizeList — Shape B (/v1/api/*, bọc data, URL tương đối)', () => {
  const result = normalizeList(shapeB);

  it('đọc được items bên trong data', () => {
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('ghép URL tương đối với APP_DOMAIN_CDN_IMAGE (§17 rủi ro #2)', () => {
    // Fixture xác nhận poster_url dạng "uploads/movies/..." — không có scheme.
    const rawPath = (shapeB as { data: { items: { poster_url: string }[] } }).data.items[0]
      ?.poster_url;
    expect(rawPath).not.toMatch(/^https?:\/\//);

    expect(result.items[0]?.poster).toBe(`https://phimimg.com/${rawPath}`);
    expect(result.items[0]?.poster).toMatch(/^https:\/\/phimimg\.com\//);
  });

  it('đọc pagination trong data.params.pagination', () => {
    expect(result.pagination.totalPages).toBeGreaterThan(0);
    expect(result.pagination.itemsPerPage).toBeGreaterThan(0);
  });
});

describe('normalizeList — /v1/api/home', () => {
  it('dùng chung nhánh Shape B, ra đúng model', () => {
    const result = normalizeList(home);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0]?.poster).toMatch(/^https?:\/\//);
  });
});

describe('normalizeDetail — Shape C (/phim/{slug}, episodes tách ngoài)', () => {
  const result = normalizeDetail(shapeC);

  it('đọc movie và giữ field chi tiết', () => {
    expect(result.movie.slug).toBeTruthy();
    expect(result.movie.name).toBeTruthy();
    expect(typeof result.movie.content).toBe('string');
    expect(Array.isArray(result.movie.actors)).toBe(true);
  });

  it('đọc episodes nằm NGANG HÀNG movie', () => {
    expect(result.episodes.length).toBeGreaterThan(0);
    expect(result.episodes[0]?.serverName).toBeTruthy();
    expect(result.episodes[0]?.episodes.length).toBeGreaterThan(0);
  });

  it('mọi tập đều có ít nhất một nguồn phát (§10.1)', () => {
    for (const server of result.episodes) {
      for (const ep of server.episodes) {
        expect(ep.linkM3u8 !== '' || ep.linkEmbed !== '').toBe(true);
      }
    }
  });
});

describe('normalizeDetail — Shape D (/v1/api/phim/{slug}, episodes trong item)', () => {
  const result = normalizeDetail(shapeD);

  it('đọc được data.item', () => {
    expect(result.movie.slug).toBeTruthy();
    expect(result.movie.name).toBeTruthy();
  });

  it('đọc episodes nằm BÊN TRONG item', () => {
    expect(result.episodes.length).toBeGreaterThan(0);
    expect(result.episodes[0]?.episodes.length).toBeGreaterThan(0);
  });

  it('ra cùng một phim với Shape C', () => {
    expect(result.movie.slug).toBe(normalizeDetail(shapeC).movie.slug);
  });
});

describe('normalizeImages — §3.3, shape đã verify', () => {
  const result = normalizeImages(images);

  it('phân loại được backdrop và poster từ mảng images[] phẳng', () => {
    expect(result.backdrops.length).toBeGreaterThan(0);
    expect(result.posters.length).toBeGreaterThan(0);
  });

  it('ghép file_path với base trong image_sizes, không dùng CDN phimimg', () => {
    for (const url of [...result.backdrops, ...result.posters]) {
      expect(url).toMatch(/^https:\/\/image\.tmdb\.org\/t\/p\//);
      expect(url).not.toContain('//t/p'); // không double slash khi join
    }
  });

  it('logos rỗng — API không trả type "logo" (§8.2 phải fallback title chữ)', () => {
    expect(result.logos).toEqual([]);
  });
});

describe('normalizePeoples — §3.3', () => {
  const result = normalizePeoples(peoples);

  it('đọc data.peoples và giữ tên', () => {
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.name).toBeTruthy();
  });

  it('ghép profile_path với profile_sizes', () => {
    const withProfile = result.filter((p) => p.profile);
    expect(withProfile.length).toBeGreaterThan(0);
    for (const person of withProfile) {
      expect(person.profile).toMatch(/^https:\/\/image\.tmdb\.org\/t\/p\//);
    }
  });

  it('map known_for_department sang job', () => {
    expect(result.some((p) => p.job)).toBe(true);
  });
});

describe('normalizeKeywords — §3.3', () => {
  it('đọc data.keywords[].name_vn', () => {
    const result = normalizeKeywords(keywords);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((k) => typeof k === 'string' && k.length > 0)).toBe(true);
  });

  it('chấp nhận mảng string và chuỗi CSV', () => {
    expect(normalizeKeywords({ data: { keywords: 'a, b ,c' } })).toEqual(['a', 'b', 'c']);
    expect(normalizeKeywords({ keywords: ['x', 'y'] })).toEqual(['x', 'y']);
  });

  it('loại trùng lặp', () => {
    expect(normalizeKeywords({ data: { keywords: [{ name: 'a' }, { name: 'a' }] } })).toEqual(['a']);
  });
});

describe('normalizeTaxonomyList / normalizeYears — §3.4', () => {
  it('đọc /the-loai (bọc data.items)', () => {
    const result = normalizeTaxonomyList(theLoai);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.slug).toBeTruthy();
    expect(result[0]?.name).toBeTruthy();
  });

  it('đọc /quoc-gia', () => {
    expect(normalizeTaxonomyList(quocGia).length).toBeGreaterThan(0);
  });

  it('đọc /nam-phat-hanh và sắp xếp giảm dần', () => {
    const years = normalizeYears(namPhatHanh);
    expect(years.length).toBeGreaterThan(0);
    expect(years).toEqual([...years].sort((a, b) => b - a));
    expect(years.every((y) => y >= 1911)).toBe(true);
  });

  it('chấp nhận mảng trần', () => {
    expect(normalizeTaxonomyList([{ _id: '1', name: 'Hành Động', slug: 'hanh-dong' }])).toHaveLength(
      1,
    );
    expect(normalizeYears([2024, '2023'])).toEqual([2024, 2023]);
  });
});

describe('fail mềm — §4.2 "field thiếu → mặc định an toàn, KHÔNG throw"', () => {
  const garbage = [null, undefined, 0, '', 'text', [], {}, { data: null }, { items: 'not-array' }];

  it('normalizeList không throw với input rác', () => {
    for (const input of garbage) {
      expect(() => normalizeList(input)).not.toThrow();
      expect(normalizeList(input).items).toEqual([]);
      expect(normalizeList(input).pagination.currentPage).toBe(1);
    }
  });

  it('normalizeDetail không throw với input rác', () => {
    for (const input of garbage) {
      expect(() => normalizeDetail(input)).not.toThrow();
      expect(normalizeDetail(input).episodes).toEqual([]);
    }
  });

  it('các adapter bổ trợ trả rỗng thay vì throw', () => {
    for (const input of garbage) {
      expect(normalizeImages(input)).toEqual({ backdrops: [], posters: [], logos: [] });
      expect(normalizePeoples(input)).toEqual([]);
      expect(normalizeKeywords(input)).toEqual([]);
      expect(normalizeTaxonomyList(input)).toEqual([]);
      expect(normalizeYears(input)).toEqual([]);
    }
  });

  it('item thiếu field vẫn ra Movie hợp lệ, ảnh rơi về placeholder', () => {
    const { items } = normalizeList({ items: [{}] });
    expect(items).toHaveLength(1);
    expect(items[0]?.name).toBe('');
    expect(items[0]?.year).toBe(0);
    expect(items[0]?.type).toBe('single');
    expect(items[0]?.poster).toBe('/placeholder-poster.svg');
    expect(items[0]?.categories).toEqual([]);
  });
});
