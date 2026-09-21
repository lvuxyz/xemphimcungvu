import { create } from 'zustand';
import { PLAYER } from '@/lib/constants';
import {
  forgetMovie,
  getPersonalized,
  readWatchIndex,
  setPersonalized as savePersonalized,
  type WatchIndexEntry,
} from '@/lib/storage';

/**
 * Index tiến độ xem, phía React.
 *
 * Vì sao cần một store thay vì để mỗi chỗ tự gọi `readWatchIndex()`: trang chủ có
 * hơn trăm `MovieCard`, mỗi cái muốn biết "phim này xem tới đâu". Đọc riêng lẻ thì
 * mỗi card là một effect + một lượt tìm, và không card nào biết card khác vừa làm
 * gì. Ở đây index được nạp MỘT lần rồi mọi nơi cùng đọc một bản trong RAM.
 *
 * Lượt render đầu ở client luôn là `entries: []` — khớp HTML từ server, nên không
 * có hydration mismatch (§13). Dữ liệu thật vào ở effect, sau paint.
 */
interface WatchState {
  entries: WatchIndexEntry[];
  /** Đã đọc localStorage xong chưa — để khung chờ không nháy thành "rỗng". */
  loaded: boolean;
  /** Cá nhân hoá đang bật hay không (§ tuỳ chọn trong navbar). */
  personalized: boolean;

  /** Đọc lại index. Rẻ: index đã nằm trong RAM của `lib/storage.ts`. */
  refresh: () => void;
  /** Gỡ một phim khỏi "Tiếp tục xem", cả trong storage. */
  forget: (slug: string) => void;
  setPersonalized: (value: boolean) => void;
}

/**
 * Tắt cá nhân hoá được ép ở ĐÚNG MỘT CHỖ: `entries` về rỗng.
 *
 * Nhờ vậy mọi mặt hiển thị tự tắt theo mà không nơi nào phải tự kiểm cờ — row
 * "Tiếp tục xem", thứ tự row trang chủ, nút hero, vạch tiến độ trên card. Rải cờ ra
 * từng chỗ thì chỉ cần quên một chỗ là lịch sử của người ta vẫn lộ ở đó.
 *
 * KHÔNG tắt việc ghi tiến độ: trình phát vẫn nhớ chỗ đang xem của từng tập (§10.5),
 * và bật lại thì mọi thứ còn nguyên chứ không mất.
 */
const visibleEntries = (personalized: boolean): WatchIndexEntry[] =>
  personalized ? readWatchIndex() : [];

export const useWatchStore = create<WatchState>((set) => ({
  entries: [],
  loaded: false,
  // Lượt render đầu ở client phải khớp HTML server, mà server không đọc được cờ.
  personalized: true,

  refresh: () => {
    const personalized = getPersonalized();
    set({ personalized, entries: visibleEntries(personalized), loaded: true });
  },

  forget: (slug) => {
    forgetMovie(slug);
    set((state) => ({ entries: state.entries.filter((e) => e.slug !== slug) }));
  },

  setPersonalized: (value) => {
    savePersonalized(value);
    set({ personalized: value, entries: visibleEntries(value) });
  },
}));

/**
 * ⚠️ Mọi selector ở đây PHẢI trả về giá trị nguyên thuỷ hoặc đúng tham chiếu có
 * trong store. Trả về object dựng mới mỗi lượt gọi thì `useSyncExternalStore`
 * thấy snapshot đổi liên tục và render vô hạn — nên phần dẫn xuất nằm ở hàm
 * thuần bên dưới, gọi trong lúc render chứ không phải trong selector.
 */
export function useWatchEntry(slug: string): WatchIndexEntry | undefined {
  return useWatchStore((state) => state.entries.find((e) => e.slug === slug));
}

/** Tỉ lệ đã xem của tập gần nhất, `0` nếu chưa xem — dùng cho vạch trên card. */
export function useWatchRatio(slug: string): number {
  return useWatchStore((state) => {
    const entry = state.entries.find((e) => e.slug === slug);
    const tuple = entry?.eps[entry.lastEp];
    return tuple && tuple[1] > 0 ? Math.min(1, tuple[0] / tuple[1]) : 0;
  });
}

export interface ResumePoint {
  /** Slug tập đang xem dở. */
  ep: string;
  /** Giây — mốc để mở lại đúng chỗ. */
  position: number;
  /** Giây còn lại của tập. */
  remaining: number;
  ratio: number;
}

/**
 * Chỗ cần xem tiếp của một phim, `null` nếu chưa xem dở tập nào.
 *
 * Ngưỡng `PLAYER.resumeMinPosition` là ngưỡng dùng chung với prompt "Tiếp tục xem
 * từ…" của trình phát và với script chừa chỗ — xem chú thích ở `constants.ts`.
 */
export function resumePoint(entry: WatchIndexEntry | undefined): ResumePoint | null {
  const tuple = entry?.eps[entry.lastEp];
  if (!entry || !tuple || tuple[0] <= PLAYER.resumeMinPosition || tuple[1] <= 0) return null;

  return {
    ep: entry.lastEp,
    position: tuple[0],
    remaining: Math.max(0, tuple[1] - tuple[0]),
    ratio: Math.min(1, tuple[0] / tuple[1]),
  };
}
