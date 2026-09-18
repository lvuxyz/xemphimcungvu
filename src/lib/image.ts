import { IMAGE_CDN, PLACEHOLDER_BACKDROP, PLACEHOLDER_POSTER } from './constants';

/**
 * §4.2 — quy tắc resolve ảnh. Đây là nơi DUY NHẤT được phép ghép URL ảnh;
 * không nối chuỗi thủ công ở bất kỳ chỗ nào khác (§17 rủi ro #2).
 *
 *   path rỗng/undefined      → placeholder nội bộ
 *   path bắt đầu bằng "http" → giữ nguyên
 *   ngược lại                → join(cdnBase ?? IMAGE_CDN, path)
 */
export function resolveImage(
  path?: string | null,
  cdnBase?: string | null,
  placeholder: string = PLACEHOLDER_POSTER,
): string {
  const trimmed = path?.trim();
  if (!trimmed) return placeholder;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/placeholder-')) return trimmed;

  const base = (cdnBase?.trim() || IMAGE_CDN).replace(/\/+$/, '');
  return `${base}/${trimmed.replace(/^\/+/, '')}`;
}

export function resolveBackdrop(path?: string | null, cdnBase?: string | null): string {
  return resolveImage(path, cdnBase, PLACEHOLDER_BACKDROP);
}

export function isPlaceholder(src: string): boolean {
  return src === PLACEHOLDER_POSTER || src === PLACEHOLDER_BACKDROP;
}

/**
 * Host được phép đi qua optimizer của Next — PHẢI khớp `images.remotePatterns`
 * trong `next.config.mjs`.
 *
 * KKPhim để nguyên `poster_url` mà nguồn phim tự nhập, nên ngoài `phimimg.com`
 * thỉnh thoảng có cả host lạ (gặp thật: `i.ex-cdn.com/danviet.vn/...`). Gặp host
 * không khai báo, `next/image` NÉM LỖI ngay lúc render — nghĩa là một phim có
 * ảnh lạ đủ sức thổi bay cả trang danh sách (§14.1 chỉ cho phép ảnh đó rơi về
 * placeholder, không cho phép sập trang).
 */
const OPTIMIZABLE_HOSTS = new Set([
  'phimimg.com',
  'phimapi.com',
  'img.phimapi.com',
  'image.tmdb.org',
]);

/**
 * Ảnh này có được đưa qua optimizer không.
 *
 * `false` → SmartImage đặt `unoptimized`, trình duyệt tải thẳng từ nguồn: mất
 * phần resize nhưng ảnh vẫn hiện, và server của mình KHÔNG đi fetch hộ một URL
 * bên thứ ba tuỳ ý (đó là lý do không mở `hostname: '**'`).
 */
export function isOptimizable(src: string): boolean {
  if (!src) return false;
  if (!/^https?:\/\//i.test(src)) return true; // đường dẫn nội bộ

  try {
    return OPTIMIZABLE_HOSTS.has(new URL(src).hostname);
  } catch {
    return false;
  }
}

/** §7.5 — tỉ lệ ảnh theo vị trí hiển thị. */
export const ASPECT = {
  /** Carousel ngang — dùng `thumb` */
  row: 16 / 9,
  /** Grid trang danh sách — dùng `poster` */
  grid: 2 / 3,
  /** Hero — backdrop từ /images */
  hero: 16 / 9,
  /** Avatar cast */
  avatar: 1,
} as const;

/**
 * `sizes` chính xác cho next/image (§12.2). Sai `sizes` là nguyên nhân
 * phổ biến nhất khiến trình duyệt tải ảnh lớn gấp 2–3 lần cần thiết.
 */
export const IMAGE_SIZES = {
  /**
   * `66vw` ở khổ điện thoại KHÔNG phải mô tả sai bố cục — hero vẫn tràn 100vw.
   * Đó là cách duy nhất `sizes` cho phép chặn trần DPR.
   *
   * Trình duyệt nhân bề rộng khai báo với DPR để chọn trong srcset, nên máy
   * 414px DPR 3 đang xin 1242px và nhận bản **1280w** cho một khung rộng 414px —
   * ảnh nặng nhất của cả trang, lại chính là phần tử LCP. Khai 66vw đẩy nó về
   * bản 828w, tức khoảng 2x thay vì 3x: mức mà hầu hết ảnh chụp đều được coi là
   * đủ, và ở đây còn bị gradient trái + gradient đáy phủ lên quá nửa.
   *
   * Từ 640px trở lên giữ nguyên 100vw — desktop DPR 1–2 không có vấn đề này.
   */
  hero: '(max-width: 640px) 66vw, 100vw',
  rowCard: '(max-width: 640px) 45vw, (max-width: 1024px) 30vw, (max-width: 1536px) 22vw, 16vw',
  gridCard: '(max-width: 640px) 45vw, (max-width: 1024px) 30vw, (max-width: 1536px) 16vw, 12vw',
  searchThumb: '40px',
  castAvatar: '80px',
} as const;

/**
 * Blur placeholder dùng chung cho card (§12.2) — 1 pixel màu --bg-elevated,
 * nhúng inline để không tốn thêm request.
 */
export const BLUR_DATA_URL =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="12"><rect width="8" height="12" fill="#121216"/></svg>',
  ).toString('base64');
