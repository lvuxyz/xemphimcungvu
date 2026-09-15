import { describe, expect, it, vi } from 'vitest';
import { resolveImage } from '@/lib/image';
import phimImageLoader from '@/lib/image-loader';

describe('resolveImage — §4.2, §17 rủi ro #2', () => {
  it('path rỗng/undefined → placeholder nội bộ', () => {
    expect(resolveImage(undefined)).toBe('/placeholder-poster.svg');
    expect(resolveImage('')).toBe('/placeholder-poster.svg');
    expect(resolveImage('   ')).toBe('/placeholder-poster.svg');
    expect(resolveImage(null)).toBe('/placeholder-poster.svg');
  });

  it('path bắt đầu bằng http → giữ nguyên', () => {
    const abs = 'https://phimimg.com/upload/vod/a.jpg';
    expect(resolveImage(abs)).toBe(abs);
    expect(resolveImage(abs, 'https://other-cdn.com')).toBe(abs);
  });

  it('path tương đối → join với cdnBase', () => {
    expect(resolveImage('uploads/movies/a.webp', 'https://phimimg.com')).toBe(
      'https://phimimg.com/uploads/movies/a.webp',
    );
  });

  it('không sinh double slash dù base/path có slash thừa', () => {
    expect(resolveImage('/uploads/a.webp', 'https://phimimg.com/')).toBe(
      'https://phimimg.com/uploads/a.webp',
    );
  });

  it('thiếu cdnBase → dùng CDN mặc định', () => {
    expect(resolveImage('uploads/a.webp')).toBe('https://phimimg.com/uploads/a.webp');
  });

  it('cho phép đổi placeholder theo ngữ cảnh', () => {
    expect(resolveImage('', undefined, '')).toBe('');
  });
});

describe('phimImageLoader — §3.5, §12.3 (proxy đang TẮT)', () => {
  it('proxy tắt → trả URL gốc, vì /image.php hiện trả 404', () => {
    const src = 'https://phimimg.com/uploads/a.jpg';
    expect(phimImageLoader({ src, width: 640, quality: 75 })).toBe(src);
  });

  it('ảnh nội bộ luôn đi thẳng', () => {
    expect(phimImageLoader({ src: '/placeholder-poster.svg', width: 400 })).toBe(
      '/placeholder-poster.svg',
    );
  });

  it('bật NEXT_PUBLIC_USE_IMAGE_PROXY thì dựng đúng URL /image.php', async () => {
    vi.stubEnv('NEXT_PUBLIC_USE_IMAGE_PROXY', 'true');
    vi.resetModules();
    const { default: loader } = await import('@/lib/image-loader');

    const url = new URL(loader({ src: 'https://phimimg.com/uploads/a.jpg', width: 640, quality: 75 }));
    expect(url.origin + url.pathname).toBe('https://phimapi.com/image.php');
    expect(url.searchParams.get('url')).toBe('https://phimimg.com/uploads/a.jpg');
    expect(url.searchParams.get('w')).toBe('640');
    expect(url.searchParams.get('q')).toBe('75');

    vi.unstubAllEnvs();
  });
});
