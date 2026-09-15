/**
 * Cấu hình hls.js theo chất lượng mạng (§10.1 mở rộng).
 *
 * Một cấu hình cố định KHÔNG thể phục vụ tốt cả 5G lẫn 3G:
 *   · buffer 30s trên 3G  → mở phim mất 15s mới chạy, đổi tập càng lâu
 *   · buffer 10s trên 5G  → phí băng thông, tua tới là khựng
 *   · timeout 10s mặc định trên 2G → fragment nào cũng "lỗi mạng" oan
 *
 * Nên ba tier có ba ngân sách buffer / timeout / ABR riêng. Ngoài ra luôn bật
 * `capLevelToPlayerSize`: không có lý do gì tải 1080p vào khung 360px trên điện thoại.
 */

import type { HlsConfig } from 'hls.js';
import type { NetworkTier } from './network';

type RetryConfig = NonNullable<HlsConfig['fragLoadPolicy']['default']['errorRetry']>;

interface LoadBudget {
  /** ms chờ byte đầu tiên trước khi coi là timeout. */
  firstByteMs: number;
  /** ms cho toàn bộ fragment. */
  loadMs: number;
  retries: number;
}

function policy({ firstByteMs, loadMs, retries }: LoadBudget): HlsConfig['fragLoadPolicy'] {
  const retry: RetryConfig = {
    maxNumRetry: retries,
    retryDelayMs: 500,
    maxRetryDelayMs: 8_000,
    backoff: 'exponential',
  };

  return {
    default: {
      maxTimeToFirstByteMs: firstByteMs,
      maxLoadTimeMs: loadMs,
      timeoutRetry: { ...retry },
      errorRetry: { ...retry },
    },
  };
}

interface TierProfile {
  /** Level bắt đầu: 0 = thấp nhất (mở nhanh), -1 = để ABR tự chọn. */
  startLevel: number;
  /** Ước lượng băng thông ban đầu (bit/s) — quyết định chất lượng ~10s đầu. */
  initialBandwidth: number;
  /** Giây video giữ sẵn phía trước. */
  buffer: number;
  maxBuffer: number;
  /** MB tối đa cho buffer — chặn tràn RAM trên máy yếu. */
  bufferSizeMb: number;
  /** Giây video giữ lại phía sau (tua lùi không phải tải lại). */
  backBuffer: number;
  load: LoadBudget;
  /** Trần chiều cao video khi ABR tự chọn. Infinity = không chặn. */
  maxHeight: number;
}

const PROFILES: Record<NetworkTier, TierProfile> = {
  /** 2G/3G yếu hoặc bật tiết kiệm dữ liệu: ưu tiên CHẠY ĐƯỢC hơn là nét. */
  low: {
    startLevel: 0,
    initialBandwidth: 300_000,
    buffer: 10,
    maxBuffer: 30,
    bufferSizeMb: 15,
    backBuffer: 10,
    load: { firstByteMs: 20_000, loadMs: 90_000, retries: 6 },
    maxHeight: 480,
  },
  /** 3G khá / 4G yếu / máy 2GB RAM. */
  medium: {
    startLevel: -1,
    initialBandwidth: 1_000_000,
    buffer: 20,
    maxBuffer: 60,
    bufferSizeMb: 30,
    backBuffer: 30,
    load: { firstByteMs: 12_000, loadMs: 60_000, retries: 4 },
    maxHeight: 720,
  },
  /** 4G/5G/WiFi. */
  high: {
    startLevel: -1,
    initialBandwidth: 3_000_000,
    buffer: 30,
    maxBuffer: 120,
    bufferSizeMb: 60,
    backBuffer: 60,
    load: { firstByteMs: 10_000, loadMs: 45_000, retries: 3 },
    maxHeight: Number.POSITIVE_INFINITY,
  },
};

/** Trần chất lượng theo tier — dùng cho `hls.autoLevelCapping`. */
export const maxHeightForTier = (tier: NetworkTier): number => PROFILES[tier].maxHeight;

/**
 * Cấu hình hoàn chỉnh cho `new Hls(...)`.
 *
 * `capLevelToPlayerSize` + `autoLevelCapping` (đặt sau MANIFEST_PARSED) là hai
 * lớp chặn khác nhau: một theo kích thước khung hình, một theo chất lượng mạng.
 */
export function hlsConfigFor(tier: NetworkTier): Partial<HlsConfig> {
  const p = PROFILES[tier];

  return {
    // Demux/remux chạy ở worker → main thread rảnh để giữ 60fps cho UI.
    enableWorker: true,
    lowLatencyMode: false,

    // ---- buffer ----
    maxBufferLength: p.buffer,
    maxMaxBufferLength: p.maxBuffer,
    maxBufferSize: p.bufferSizeMb * 1000 * 1000,
    backBufferLength: p.backBuffer,
    /** Tải sẵn fragment đầu ngay khi parse xong manifest — bấm Phát là chạy. */
    startFragPrefetch: true,

    // ---- ABR ----
    startLevel: p.startLevel,
    abrEwmaDefaultEstimate: p.initialBandwidth,
    capLevelToPlayerSize: true,
    /** Chỉ nâng chất lượng khi băng thông dư rõ rệt; hạ thì hạ ngay. */
    abrBandWidthFactor: tier === 'high' ? 0.95 : 0.8,
    abrBandWidthUpFactor: tier === 'high' ? 0.7 : 0.5,
    /** Mạng yếu được phép "đói" lâu hơn trước khi ABR hoảng và tụt hạng. */
    maxStarvationDelay: tier === 'low' ? 8 : 4,
    maxLoadingDelay: tier === 'low' ? 8 : 4,

    // ---- retry: nguồn phim public hay chập chờn, đừng bỏ cuộc sớm ----
    fragLoadPolicy: policy(p.load),
    manifestLoadPolicy: policy({ ...p.load, loadMs: Math.min(p.load.loadMs, 30_000) }),
    playlistLoadPolicy: policy({ ...p.load, loadMs: Math.min(p.load.loadMs, 30_000) }),
  };
}
