import type { ImageLoaderProps } from 'next/image';
import { API_BASE_URL } from './constants';

/**
 * Custom loader theo §3.5 / §12.3: `GET /image.php?url={absoluteImageUrl}` → WEBP.
 *
 * ⚠️ CHƯA DÙNG. Kiểm tra thật ngày 15/09/2026 cho thấy `/image.php` trả 404
 * `{"status":false,"msg":"hmmm!"}` với mọi dạng tham số đã thử (url thô,
 * url đã encode, có/không w & q; cả ảnh phimimg.com lẫn image.tmdb.org).
 * Trong khi đó CDN gốc đã phục vụ `image/webp` trực tiếp.
 *
 * next.config.mjs vì thế đang dùng optimizer sẵn có của Next. Giữ file này để
 * bật lại ngay khi endpoint sống lại: đặt NEXT_PUBLIC_USE_IMAGE_PROXY=true rồi
 * bỏ comment `loader`/`loaderFile` trong next.config.mjs.
 */

const USE_PROXY = process.env.NEXT_PUBLIC_USE_IMAGE_PROXY === 'true';

export default function phimImageLoader({ src, width, quality }: ImageLoaderProps): string {
  // Ảnh nội bộ (placeholder trong /public) luôn đi thẳng.
  if (!src.startsWith('http')) return src;

  // Proxy tắt → trả URL gốc; CDN đã phục vụ WEBP sẵn.
  if (!USE_PROXY) return src;

  const url = new URL(`${API_BASE_URL}/image.php`);
  url.searchParams.set('url', src);
  url.searchParams.set('w', String(width));
  url.searchParams.set('q', String(quality ?? 75));
  return url.toString();
}
