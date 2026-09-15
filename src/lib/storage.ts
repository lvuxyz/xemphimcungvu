/**
 * Wrapper localStorage (§10.5, §15).
 *
 * Mọi truy cập đều bọc try/catch: Safari private mode và một số cấu hình trình duyệt
 * ném exception ngay khi đọc. Lưu trữ hỏng không được làm sập app (§2.2 nguyên tắc 4).
 */

import { WATCH_PROGRESS_TTL_DAYS } from './constants';

const PREFIX = {
  watch: 'watch:',
  myList: 'my-list',
  settings: 'settings',
} as const;

function safeStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    const probe = '__probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readJson<T>(key: string, fallback: T): T {
  const store = safeStorage();
  if (!store) return fallback;
  try {
    const raw = store.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  const store = safeStorage();
  if (!store) return false;
  try {
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Hết quota — dọn tiến độ cũ rồi thử lại đúng một lần.
    pruneWatchProgress();
    try {
      store.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
}

export function removeKey(key: string): void {
  try {
    safeStorage()?.removeItem(key);
  } catch {
    /* im lặng */
  }
}

/* ------------------------- §10.5 tiến độ xem ------------------------- */

export interface WatchProgress {
  position: number;
  duration: number;
  updatedAt: number;
}

export const watchKey = (slug: string, ep: string): string => `${PREFIX.watch}${slug}:${ep}`;

export function getWatchProgress(slug: string, ep: string): WatchProgress | null {
  const value = readJson<WatchProgress | null>(watchKey(slug, ep), null);
  if (!value || typeof value.position !== 'number' || typeof value.duration !== 'number') {
    return null;
  }
  return value;
}

export function setWatchProgress(
  slug: string,
  ep: string,
  position: number,
  duration: number,
): void {
  writeJson(watchKey(slug, ep), {
    position,
    duration,
    updatedAt: Date.now(),
  } satisfies WatchProgress);
}

export function clearWatchProgress(slug: string, ep: string): void {
  removeKey(watchKey(slug, ep));
}

/** Dọn key tiến độ cũ hơn 90 ngày — gọi một lần khi khởi động app (§10.5). */
export function pruneWatchProgress(ttlDays: number = WATCH_PROGRESS_TTL_DAYS): number {
  const store = safeStorage();
  if (!store) return 0;

  const cutoff = Date.now() - ttlDays * 24 * 60 * 60 * 1000;
  const stale: string[] = [];

  try {
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (!key?.startsWith(PREFIX.watch)) continue;

      const value = readJson<WatchProgress | null>(key, null);
      if (!value || typeof value.updatedAt !== 'number' || value.updatedAt < cutoff) {
        stale.push(key);
      }
    }
  } catch {
    return 0;
  }

  stale.forEach(removeKey);
  return stale.length;
}

export const STORAGE_KEYS = PREFIX;

/* ------------------------- tuỳ chọn trình phát ------------------------- */

/**
 * Người xem phim bộ mở lại trình phát hàng chục lần một tuần. Bắt họ chỉnh lại
 * âm lượng / chất lượng mỗi tập là lỗi trải nghiệm, không phải tính năng thiếu.
 */
export interface PlayerSettings {
  volume: number;
  muted: boolean;
  rate: number;
  /** Chiều cao video ưa thích (480, 720…). 0 = tự động theo mạng. */
  qualityHeight: number;
}

const DEFAULT_PLAYER_SETTINGS: PlayerSettings = {
  volume: 1,
  muted: false,
  rate: 1,
  qualityHeight: 0,
};

export function getPlayerSettings(): PlayerSettings {
  const raw = readJson<Partial<PlayerSettings>>(PREFIX.settings, {});
  return {
    volume: typeof raw.volume === 'number' ? Math.min(1, Math.max(0, raw.volume)) : 1,
    muted: typeof raw.muted === 'boolean' ? raw.muted : false,
    rate: typeof raw.rate === 'number' && raw.rate > 0 ? raw.rate : 1,
    qualityHeight: typeof raw.qualityHeight === 'number' ? raw.qualityHeight : 0,
  };
}

export function savePlayerSettings(patch: Partial<PlayerSettings>): void {
  writeJson(PREFIX.settings, { ...getPlayerSettings(), ...patch } satisfies PlayerSettings);
}

export { DEFAULT_PLAYER_SETTINGS };
