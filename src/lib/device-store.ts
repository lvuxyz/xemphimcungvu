/**
 * Một nguồn sự thật duy nhất về "hoàn cảnh chạy": mạng, kiểu con trỏ, reduced motion.
 *
 * Vì sao là store ngoài React chứ không phải hook thường:
 *   · 11 ContentRow × mỗi row một `resize` listener là cách chắc chắn làm giật
 *     khi xoay máy. Ở đây chỉ có ĐÚNG MỘT bộ listener cho cả app.
 *   · `useSyncExternalStore` cho snapshot ổn định, không lệch hydration:
 *     server luôn trả DEFAULT, client cập nhật ngay sau khi mount.
 */

import {
  DEFAULT_NETWORK,
  FEATURE_BUDGET,
  IMAGE_QUALITY,
  getConnection,
  readNetworkInfo,
  type FeatureBudget,
  type NetworkInfo,
  type NetworkTier,
} from './network';

export interface DeviceSnapshot {
  network: NetworkInfo;
  tier: NetworkTier;
  /** Chuột thật: có hover và con trỏ chính xác. Quyết định hover preview, mũi tên row. */
  canHover: boolean;
  /** Ngón tay: cần vùng chạm ≥ 44px, không có hover. */
  coarsePointer: boolean;
  reducedMotion: boolean;
  budget: FeatureBudget;
  /** `quality` truyền vào next/image. */
  imageQuality: number;
  /**
   * Số card nhìn thấy cùng lúc trong một ContentRow, khớp với breakpoint của
   * `.row-item` trong ContentRow.tsx. Tính một lần ở đây thay vì để mỗi row tự
   * gắn một listener `resize` — trang chủ có 11 row.
   */
  cols: number;
}

const QUERIES = {
  hover: '(hover: hover) and (pointer: fine)',
  coarse: '(pointer: coarse)',
  reducedMotion: '(prefers-reduced-motion: reduce)',
  sm: '(min-width: 640px)',
  lg: '(min-width: 1024px)',
  xxl: '(min-width: 1536px)',
} as const;

/** Snapshot lúc SSR — phải là hằng số tham chiếu, nếu không React sẽ loop vô hạn. */
const SERVER_SNAPSHOT: DeviceSnapshot = {
  network: DEFAULT_NETWORK,
  tier: 'high',
  canHover: true,
  coarsePointer: false,
  reducedMotion: false,
  budget: FEATURE_BUDGET.high,
  imageQuality: IMAGE_QUALITY.high,
  cols: 6,
};

let snapshot: DeviceSnapshot = SERVER_SNAPSHOT;
const listeners = new Set<() => void>();
let teardown: (() => void) | null = null;

function matches(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(query).matches;
}

function columns(): number {
  if (matches(QUERIES.xxl)) return 6;
  if (matches(QUERIES.lg)) return 5;
  if (matches(QUERIES.sm)) return 3;
  return 2;
}

function build(): DeviceSnapshot {
  const network = readNetworkInfo();
  return {
    network,
    tier: network.tier,
    canHover: matches(QUERIES.hover),
    coarsePointer: matches(QUERIES.coarse),
    reducedMotion: matches(QUERIES.reducedMotion),
    budget: FEATURE_BUDGET[network.tier],
    imageQuality: IMAGE_QUALITY[network.tier],
    cols: columns(),
  };
}

function same(a: DeviceSnapshot, b: DeviceSnapshot): boolean {
  return (
    a.tier === b.tier &&
    a.canHover === b.canHover &&
    a.coarsePointer === b.coarsePointer &&
    a.reducedMotion === b.reducedMotion &&
    a.cols === b.cols &&
    a.network.online === b.network.online &&
    a.network.saveData === b.network.saveData &&
    a.network.effectiveType === b.network.effectiveType
  );
}

function refresh(): void {
  const next = build();
  // Giữ nguyên tham chiếu cũ khi không có gì đổi — tránh render lại cả cây.
  if (same(snapshot, next)) return;
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function start(): void {
  if (typeof window === 'undefined' || teardown) return;

  snapshot = build();

  const mediaLists = Object.values(QUERIES).map((query) => window.matchMedia(query));
  mediaLists.forEach((list) => list.addEventListener('change', refresh));

  window.addEventListener('online', refresh);
  window.addEventListener('offline', refresh);

  const connection = getConnection();
  connection?.addEventListener?.('change', refresh);

  teardown = () => {
    mediaLists.forEach((list) => list.removeEventListener('change', refresh));
    window.removeEventListener('online', refresh);
    window.removeEventListener('offline', refresh);
    connection?.removeEventListener?.('change', refresh);
    teardown = null;
  };
}

export function subscribeDevice(listener: () => void): () => void {
  start();
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      teardown?.();
      // Lần subscribe sau sẽ dựng lại từ đầu; snapshot cũ vẫn dùng được tạm.
    }
  };
}

export const getDeviceSnapshot = (): DeviceSnapshot => snapshot;
export const getServerDeviceSnapshot = (): DeviceSnapshot => SERVER_SNAPSHOT;

/** Cho phép nơi ngoài React (ví dụ cấu hình hls.js) đọc tier hiện tại. */
export const currentTier = (): NetworkTier =>
  typeof window === 'undefined' ? 'high' : readNetworkInfo().tier;
