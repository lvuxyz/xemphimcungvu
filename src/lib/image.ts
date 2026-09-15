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
  hero: '100vw',
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
