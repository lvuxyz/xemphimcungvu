/** Hằng số dùng chung cho tầng data access (§3, §11, §14). */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://phimapi.com';

/** CDN ảnh mặc định khi response không trả `APP_DOMAIN_CDN_IMAGE` (§4.2). */
export const IMAGE_CDN = process.env.NEXT_PUBLIC_IMAGE_CDN ?? 'https://phimimg.com';

/** Ảnh nội bộ dùng khi path rỗng hoặc CDN 404 (§14.1). */
export const PLACEHOLDER_POSTER = '/placeholder-poster.svg';
export const PLACEHOLDER_BACKDROP = '/placeholder-backdrop.svg';

/** §14.3 — timeout theo mức độ quan trọng của dữ liệu. */
export const TIMEOUT = {
  list: 8_000,
  detail: 8_000,
  /** Bổ trợ: images / peoples / keywords — không đáng chờ lâu. */
  supplementary: 5_000,
  taxonomy: 8_000,
} as const;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** §11.1 — staleTime / gcTime cho TanStack Query. */
export const CACHE = {
  taxonomy: { staleTime: 24 * HOUR, gcTime: 24 * HOUR },
  detail: { staleTime: 30 * MINUTE, gcTime: 1 * HOUR },
  list: { staleTime: 5 * MINUTE, gcTime: 15 * MINUTE },
  search: { staleTime: 2 * MINUTE, gcTime: 5 * MINUTE },
  home: { staleTime: 5 * MINUTE, gcTime: 15 * MINUTE },
} as const;

/** `revalidate` (giây) cho fetch phía RSC — khớp với staleTime ở trên. */
export const REVALIDATE = {
  taxonomy: 86_400,
  detail: 1_800,
  list: 300,
  search: 120,
  home: 300,
} as const;

/**
 * §8.3 — số phim mỗi ContentRow xin API.
 * 18 đủ để cuộn ngang vài trang mà vẫn dưới trần 64 của §3.1.
 */
export const ROW_LIMIT = 18;

/** §8.1 — số gợi ý tối đa trong dropdown tìm kiếm của navbar. */
export const SEARCH_SUGGESTIONS = 8;

/** §8.1 — dưới ngưỡng này thì chưa gọi API: gõ 1 ký tự trả về cả nghìn phim. */
export const SEARCH_MIN_LENGTH = 2;

/** §8.1 — debounce ô tìm kiếm. */
export const SEARCH_DEBOUNCE = 350;

/** §9.2 — bảng timing motion, để JS dùng chung số với CSS. */
export const MOTION = {
  micro: 0.15,
  standard: 0.3,
  modal: 0.45,
  kenBurns: 20,
  ease: [0.25, 0.46, 0.45, 0.94] as const,
  spring: { type: 'spring', stiffness: 300, damping: 30 } as const,
  staggerStep: 0.04,
  staggerMax: 8,
} as const;

/** §8.4 — độ trễ hover card, chống nhấp nháy khi rê chuột ngang qua row. */
export const HOVER_DELAY = { enter: 400, leave: 200, prefetch: 200 } as const;

/** §10 — video player. */
export const PLAYER = {
  seekStep: 10,
  volumeStep: 0.05,
  controlsAutoHide: 3_000,
  progressSaveInterval: 5_000,
  /** Xem đủ 95% coi như đã hoàn tất (§10.5). */
  completedThreshold: 0.95,
  autoNextCountdown: 10,
  playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2] as const,
} as const;

/** §10.5 — dọn key tiến độ cũ hơn 90 ngày khi khởi động app. */
export const WATCH_PROGRESS_TTL_DAYS = 90;
