import { describe, expect, it } from 'vitest';
import {
  parseListFilters,
  parseStartTime,
  serializeListFilters,
  startTimeFrom,
  withFilters,
} from '@/lib/search-params';
import { routes } from '@/lib/routes';
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


describe('parseStartTime — §2.4 `?t=` trên trang phát', () => {
  it('đọc số giây hợp lệ', () => {
    expect(parseStartTime({ t: '754' })).toBe(754);
  });

  it('không có `t` thì trả undefined', () => {
    expect(parseStartTime({})).toBeUndefined();
  });

  /**
   * undefined chứ KHÔNG phải 0: 0 là mốc hợp lệ về kiểu dữ liệu nhưng trùng
   * đúng với "phát từ đầu", lẫn hai thứ là `?t=abc` âm thầm ghi đè tiến độ đã lưu.
   */
  it.each([['abc'], ['-5'], ['0'], [''], ['99999999']])('bỏ qua giá trị vô nghĩa %s', (raw) => {
    expect(parseStartTime({ t: raw })).toBeUndefined();
  });

  it('lấy giá trị đầu khi `t` bị lặp', () => {
    expect(parseStartTime({ t: ['120', '900'] })).toBe(120);
  });
});

describe('startTimeFrom — `?t=` từ `useSearchParams()` phía client', () => {
  it('đọc cùng quy tắc với parseStartTime', () => {
    expect(startTimeFrom(new URLSearchParams('t=754'))).toBe(754);
    expect(startTimeFrom(new URLSearchParams('t=abc'))).toBeUndefined();
    expect(startTimeFrom(new URLSearchParams(''))).toBeUndefined();
  });

  it('lấy giá trị đầu khi `t` bị lặp', () => {
    expect(startTimeFrom(new URLSearchParams('t=120&t=900'))).toBe(120);
  });
});

describe('routes.watch — dựng URL trang phát', () => {
  it('không có tập thì rơi về sentinel tập đầu', () => {
    expect(routes.watch('abc')).toBe('/xem/abc/1');
  });

  it('gắn `?t=` khi có mốc thời gian', () => {
    expect(routes.watch('abc', 'tap-02', { startAt: 754 })).toBe('/xem/abc/tap-02?t=754');
  });

  it('làm tròn xuống, và bỏ mốc không dương', () => {
    expect(routes.watch('abc', 'tap-02', { startAt: 12.9 })).toBe('/xem/abc/tap-02?t=12');
    expect(routes.watch('abc', 'tap-02', { startAt: 0 })).toBe('/xem/abc/tap-02');
    expect(routes.watch('abc', 'tap-02', { startAt: -3 })).toBe('/xem/abc/tap-02');
  });
});

describe('routes.search — §8.1', () => {
  it('encode từ khoá tiếng Việt có dấu', () => {
    expect(routes.search('phim hàn')).toBe('/tim-kiem?keyword=phim%20h%C3%A0n');
  });

  it('từ khoá rỗng không kèm query thừa', () => {
    expect(routes.search('   ')).toBe('/tim-kiem');
  });
});
