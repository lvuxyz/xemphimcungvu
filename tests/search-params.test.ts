import { describe, expect, it } from 'vitest';
import { parseListFilters, serializeListFilters, withFilters } from '@/lib/search-params';
import { DEFAULT_LIMIT, MAX_LIMIT } from '@/types/filters';
import { deaccent, matchesSearch, searchKey } from '@/lib/text';

describe('parseListFilters — §6.2 URL là nguồn sự thật', () => {
  it('mặc định về trang 1 và limit mặc định', () => {
    const filters = parseListFilters({});
    expect(filters.page).toBe(1);
    expect(filters.limit).toBe(DEFAULT_LIMIT);
  });

  it('đọc đủ bộ filter', () => {
    const filters = parseListFilters({
      country: 'han-quoc',
      year: '2024',
      sort_field: 'year',
      sort_type: 'desc',
      sort_lang: 'vietsub',
      page: '2',
    });
    expect(filters).toMatchObject({
      country: 'han-quoc',
      year: 2024,
      sort_field: 'year',
      sort_type: 'desc',
      sort_lang: 'vietsub',
      page: 2,
    });
  });

  it('bỏ qua giá trị không nằm trong whitelist thay vì gửi lên API', () => {
    const filters = parseListFilters({ sort_field: 'rm -rf', sort_type: 'sideways' });
    expect(filters.sort_field).toBeUndefined();
    expect(filters.sort_type).toBeUndefined();
  });

  it('chặn limit vượt trần 64 (§3.1)', () => {
    expect(parseListFilters({ limit: '500' }).limit).toBe(MAX_LIMIT);
  });

  it('bỏ năm ngoài khoảng hợp lệ', () => {
    expect(parseListFilters({ year: '1800' }).year).toBeUndefined();
    expect(parseListFilters({ year: 'abcd' }).year).toBeUndefined();
  });

  it('chấp nhận searchParams dạng mảng (?a=1&a=2)', () => {
    expect(parseListFilters({ page: ['3', '4'] }).page).toBe(3);
  });
});

describe('serializeListFilters / withFilters', () => {
  it('bỏ giá trị mặc định để URL gọn', () => {
    expect(serializeListFilters({ page: 1, limit: DEFAULT_LIMIT })).toBe('');
  });

  it('round-trip giữ nguyên filter', () => {
    const original = { country: 'han-quoc', year: 2024, sort_field: 'year', page: 2 } as const;
    const parsed = parseListFilters(
      Object.fromEntries(new URLSearchParams(serializeListFilters(original))),
    );
    expect(parsed).toMatchObject(original);
  });

  it('đổi filter thì quay về trang 1', () => {
    const href = withFilters('/danh-sach/phim-bo', { page: 5, country: 'han-quoc' }, { year: 2024 });
    expect(href).not.toContain('page=');
    expect(href).toContain('year=2024');
    expect(href).toContain('country=han-quoc');
  });

  it('đổi trang thì giữ nguyên các filter khác', () => {
    const href = withFilters('/danh-sach/phim-bo', { country: 'han-quoc' }, { page: 3 });
    expect(href).toBe('/danh-sach/phim-bo?country=han-quoc&page=3');
  });
});

describe('deaccent / searchKey — tìm kiếm tiếng Việt không dấu (§8.1)', () => {
  it('bỏ dấu để gõ không dấu vẫn ra kết quả', () => {
    expect(searchKey('Thiên')).toBe('thien');
    expect(searchKey('Độc Kiếm Cửu Thiên')).toBe('doc kiem cuu thien');
    expect(searchKey('Vạn Giới Độc Tôn')).toBe('van gioi doc ton');
  });

  it('xử lý riêng đ/Đ — NFD không tách được ký tự này', () => {
    expect(deaccent('đường')).toBe('duong');
    expect(deaccent('Đông')).toBe('Dong');
  });

  it('matchesSearch so khớp hai chiều có dấu / không dấu', () => {
    expect(matchesSearch('Độc Kiếm Cửu Thiên', searchKey('thien'))).toBe(true);
    expect(matchesSearch('Độc Kiếm Cửu Thiên', searchKey('Cửu'))).toBe(true);
    expect(matchesSearch('Độc Kiếm Cửu Thiên', searchKey('xyz'))).toBe(false);
  });

  it('từ khoá rỗng không khớp gì', () => {
    expect(matchesSearch('Bất kỳ', searchKey('   '))).toBe(false);
  });
});
