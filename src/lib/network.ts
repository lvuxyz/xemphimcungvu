/**
 * Nhận biết chất lượng mạng + năng lực thiết bị, để mọi thứ nặng trong app
 * (ảnh, trailer, buffer video, hiệu ứng) tự co giãn theo hoàn cảnh thật.
 *
 * Đây là module THUẦN: không hook, không state — dùng được cả trong hls config
 * lẫn trong React. Phần React nằm ở `providers/DeviceProvider.tsx`.
 *
 * Nguồn dữ liệu:
 *   · navigator.connection  — Chrome/Edge/Android (saveData, effectiveType, downlink, rtt)
 *   · navigator.deviceMemory / hardwareConcurrency — ước lượng sức máy
 *   · Safari/Firefox không có Network Information API → coi như 'high' nhưng
 *     vẫn tôn trọng prefers-reduced-data nếu trình duyệt hỗ trợ.
 */

/** Ba mức để quyết định mọi thứ. Không chia nhỏ hơn: khó test, khó suy luận. */
export type NetworkTier = 'low' | 'medium' | 'high';

export type EffectiveType = 'slow-2g' | '2g' | '3g' | '4g' | 'unknown';

export interface NetworkInfo {
  online: boolean;
  /** Người dùng bật "Tiết kiệm dữ liệu" trong trình duyệt/hệ điều hành. */
  saveData: boolean;
  effectiveType: EffectiveType;
  /** Mbps ước lượng. 0 = không biết. */
  downlink: number;
  /** ms round-trip ước lượng. 0 = không biết. */
  rtt: number;
  /** GB RAM ước lượng (chỉ Chromium). 0 = không biết. */
  deviceMemory: number;
  /** Số luồng CPU. 0 = không biết. */
  cores: number;
  tier: NetworkTier;
}

interface NavigatorConnection {
  saveData?: boolean;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  addEventListener?: (type: 'change', listener: () => void) => void;
  removeEventListener?: (type: 'change', listener: () => void) => void;
}

type ExtendedNavigator = Navigator & {
  connection?: NavigatorConnection;
  mozConnection?: NavigatorConnection;
  webkitConnection?: NavigatorConnection;
  deviceMemory?: number;
};

/** Giá trị an toàn khi chạy phía server hoặc trình duyệt không khai báo gì. */
export const DEFAULT_NETWORK: NetworkInfo = {
  online: true,
  saveData: false,
  effectiveType: 'unknown',
  downlink: 0,
  rtt: 0,
  deviceMemory: 0,
  cores: 0,
  tier: 'high',
};

export function getConnection(): NavigatorConnection | undefined {
  if (typeof navigator === 'undefined') return undefined;
  const nav = navigator as ExtendedNavigator;
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
}

/**
 * Quy tắc xếp hạng — cố ý bi quan: thà phục vụ 480p cho máy khoẻ trong vài giây
 * đầu còn hơn để máy yếu quay vòng tròn buffer.
 *
 *   low     saveData, 2g/slow-2g, downlink < 1.2 Mbps, rtt > 500ms, RAM ≤ 1GB
 *   medium  3g, downlink < 4 Mbps, rtt > 270ms, RAM ≤ 2GB hoặc ≤ 2 nhân CPU
 *   high    còn lại
 */
export function computeTier(info: Omit<NetworkInfo, 'tier'>): NetworkTier {
  const { saveData, effectiveType, downlink, rtt, deviceMemory, cores } = info;

  if (saveData) return 'low';
  if (effectiveType === '2g' || effectiveType === 'slow-2g') return 'low';
  if (downlink > 0 && downlink < 1.2) return 'low';
  if (rtt > 500) return 'low';
  if (deviceMemory > 0 && deviceMemory <= 1) return 'low';

  if (effectiveType === '3g') return 'medium';
  if (downlink > 0 && downlink < 4) return 'medium';
  if (rtt > 270) return 'medium';
  if (deviceMemory > 0 && deviceMemory <= 2) return 'medium';
  if (cores > 0 && cores <= 2) return 'medium';

  return 'high';
}

export function readNetworkInfo(): NetworkInfo {
  if (typeof navigator === 'undefined') return DEFAULT_NETWORK;

  const nav = navigator as ExtendedNavigator;
  const connection = getConnection();

  // prefers-reduced-data: người dùng khai báo qua OS/trình duyệt, ngang hàng saveData.
  const reducedData =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-data: reduce)').matches;

  const base: Omit<NetworkInfo, 'tier'> = {
    online: nav.onLine !== false,
    saveData: Boolean(connection?.saveData) || reducedData,
    effectiveType: (connection?.effectiveType as EffectiveType) ?? 'unknown',
    downlink: connection?.downlink ?? 0,
    rtt: connection?.rtt ?? 0,
    deviceMemory: nav.deviceMemory ?? 0,
    cores: nav.hardwareConcurrency ?? 0,
  };

  return { ...base, tier: computeTier(base) };
}

/* ------------------------- ngân sách theo tier ------------------------- */

/**
 * Chất lượng ảnh cho next/image. Mặc định của Next là 75; ở mạng yếu 45 vẫn
 * chấp nhận được với poster nhỏ mà giảm ~50% dung lượng.
 */
export const IMAGE_QUALITY: Record<NetworkTier, number> = {
  low: 45,
  medium: 60,
  high: 75,
};

/** Timeout API co giãn: mạng 2G cần nhiều hơn 8s mới công bằng (§14.3). */
export const TIMEOUT_MULTIPLIER: Record<NetworkTier, number> = {
  low: 2.5,
  medium: 1.5,
  high: 1,
};

/**
 * Những thứ "xa xỉ" chỉ bật khi mạng và máy đủ khoẻ.
 *   trailer   — iframe YouTube ~1MB, chỉ cho tier high
 *   preview   — hover preview tải thêm ảnh, cho medium trở lên
 *   kenBurns  — animation 20s chiếm compositor, tắt ở tier low
 */
export interface FeatureBudget {
  heroTrailer: boolean;
  hoverPreview: boolean;
  kenBurns: boolean;
  /** Số ảnh đặt `priority` (preload) ở màn đầu. */
  priorityImages: number;
  /** Số item mỗi trang khi cuộn vô hạn. */
  pageSize: number;
}

export const FEATURE_BUDGET: Record<NetworkTier, FeatureBudget> = {
  low: {
    heroTrailer: false,
    hoverPreview: false,
    kenBurns: false,
    priorityImages: 1,
    pageSize: 12,
  },
  medium: {
    heroTrailer: false,
    hoverPreview: true,
    kenBurns: true,
    priorityImages: 2,
    pageSize: 18,
  },
  high: { heroTrailer: true, hoverPreview: true, kenBurns: true, priorityImages: 4, pageSize: 24 },
};
