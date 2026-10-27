import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseYear } from '@/app/nam/[year]/parse-year';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'app');

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

/** Mọi thư mục cha của `dir`, tính tới `src/app` (gồm cả nó). */
function ancestors(dir: string): string[] {
  const out: string[] = [];
  for (let d = dirname(dir); d.length >= APP.length; d = dirname(d)) out.push(d);
  return out;
}

const layouts = walk(APP).filter((file) => file.endsWith(`${sep}layout.tsx`));
const guards = layouts.filter((file) => readFileSync(file, 'utf8').includes('notFound()'));

/**
 * Next 14.2 chỉ trả HTTP 404 khi `notFound()` ném ra NGOÀI mọi Suspense. Một
 * `loading.tsx` ở segment cha bọc layout kiểm slug trong Suspense → shell 200
 * gửi đi trước, route lạ ra 200 kèm UI not-found (xem `app/phim/[slug]/layout.tsx`).
 *
 * Test status thật cần server — `scripts/debug-screens.mjs` lo phần đó trên
 * build prod. Ở đây giữ cái bất biến về cấu trúc để không ai vô tình đặt lại
 * `app/loading.tsx` rồi làm hỏng cả loạt route mà không thấy.
 */
describe('route lạ trả 404 thật', () => {
  it('không có loading.tsx ở gốc app', () => {
    expect(existsSync(join(APP, 'loading.tsx'))).toBe(false);
  });

  it('có layout kiểm slug cho các route động', () => {
    const names = guards.map((file) => relative(APP, dirname(file)).split(sep).join('/'));
    expect(names).toEqual(
      expect.arrayContaining([
        'phim/[slug]',
        'xem/[slug]/[ep]',
        'the-loai/[slug]',
        'quoc-gia/[slug]',
        'nam/[year]',
        'danh-sach/[type]',
      ]),
    );
  });

  it.each(guards.map((file) => [relative(APP, file), file]))(
    '%s không nằm trong loading.tsx của segment cha',
    (_, file) => {
      const offenders = ancestors(dirname(file)).filter((d) => existsSync(join(d, 'loading.tsx')));
      expect(offenders.map((d) => relative(APP, d) || '.')).toEqual([]);
    },
  );

  it('route kiểm slug vẫn giữ skeleton cho điều hướng phía client', () => {
    for (const file of guards) expect(existsSync(join(dirname(file), 'loading.tsx'))).toBe(true);
  });
});

describe('parseYear', () => {
  it('nhận năm trong khoảng 1911 → hiện tại + 2', () => {
    expect(parseYear('2024')).toBe(2024);
    expect(parseYear('1911')).toBe(1911);
  });

  it('từ chối năm ngoài khoảng hoặc không phải số', () => {
    expect(parseYear('1800')).toBeNull();
    expect(parseYear(String(new Date().getFullYear() + 3))).toBeNull();
    expect(parseYear('abc')).toBeNull();
  });
});
