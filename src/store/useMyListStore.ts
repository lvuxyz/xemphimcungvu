import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CardMovie, Movie } from '@/types/movie';

/**
 * "Danh sách của tôi" — lưu localStorage, không có backend (§1.2).
 *
 * Chỉ giữ đúng những field cần để render card, tránh phình localStorage
 * khi danh sách dài.
 */
export interface MyListEntry {
  slug: string;
  name: string;
  originName: string;
  poster: string;
  thumb: string;
  year: number;
  quality: string;
  episodeCurrent: string;
  addedAt: number;
  /**
   * Ba field dưới đây KHÔNG để render card, mà để tính sở thích (`lib/taste.ts`):
   * lưu một phim là một lời nói rõ về sở thích, chỉ là không kèm thời gian đã xem.
   *
   * Cố ý để TUỲ CHỌN thay vì viết `migrate` cho persist: entry lưu từ trước bản này
   * KHÔNG biết loại phim của nó, và "không biết" là một trạng thái thật. Migrate mà
   * điền `single` cho chúng thì mọi phim cũ trong danh sách bỗng thành phiếu bầu cho
   * "Phim lẻ" — bịa dữ liệu còn tệ hơn thiếu dữ liệu.
   */
  type?: Movie['type'];
  /** Slug thể loại. */
  categories?: string[];
  /** Slug quốc gia. */
  countries?: string[];
}

function toEntry(movie: CardMovie): MyListEntry {
  return {
    slug: movie.slug,
    name: movie.name,
    originName: movie.originName,
    poster: movie.poster,
    thumb: movie.thumb,
    year: movie.year,
    quality: movie.quality,
    episodeCurrent: movie.episodeCurrent,
    addedAt: Date.now(),
    type: movie.type,
    categories: movie.categories.map((c) => c.slug),
    countries: movie.countries.map((c) => c.slug),
  };
}

interface MyListState {
  entries: MyListEntry[];

  add: (movie: CardMovie) => void;
  remove: (slug: string) => void;
  toggle: (movie: CardMovie) => boolean;
  has: (slug: string) => boolean;
  clear: () => void;
}

type PersistedMyList = Pick<MyListState, 'entries'>;

export const useMyListStore = create<MyListState>()(
  persist<MyListState, [], [], PersistedMyList>(
    (set, get) => ({
      entries: [],

      add: (movie) =>
        set((state) =>
          state.entries.some((e) => e.slug === movie.slug)
            ? state
            : { entries: [toEntry(movie), ...state.entries] },
        ),

      remove: (slug) => set((state) => ({ entries: state.entries.filter((e) => e.slug !== slug) })),

      toggle: (movie) => {
        const exists = get().entries.some((e) => e.slug === movie.slug);
        if (exists) get().remove(movie.slug);
        else get().add(movie);
        return !exists;
      },

      has: (slug) => get().entries.some((e) => e.slug === slug),

      clear: () => set({ entries: [] }),
    }),
    {
      name: 'my-list',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ entries: state.entries }),
    },
  ),
);

/**
 * Đã đọc xong localStorage chưa — để trang My List không nháy "danh sách rỗng"
 * rồi mới có dữ liệu, và để lượt render đầu ở client khớp với HTML từ server.
 *
 * ⚠️ KHÔNG dùng cờ `hydrated` tự đặt trong `onRehydrateStorage` như bản trước:
 * localStorage là API ĐỒNG BỘ nên callback đó chạy ngay giữa lúc `create()` còn
 * đang chạy — biến `useMyListStore` vẫn ở TDZ, `useMyListStore.setState` ném lỗi
 * và bị persist nuốt mất. Cờ mãi là `false`, trang My List kẹt ở skeleton vĩnh
 * viễn dù entries đã đọc về đủ. Hỏi thẳng API của persist thì không có cái bẫy đó.
 */
export function useMyListHydrated(): boolean {
  /**
   * `useSyncExternalStore` chứ không phải `useState(false)` + effect: bản đó bắt
   * đầu bằng `false` ở MỌI lần mount, kể cả khi điều hướng mềm về trang chủ lúc
   * store đã đọc xong từ lâu. Các row cá nhân hoá vì thế vẽ một lượt theo thứ tự
   * "chưa biết gì", rồi tráo chỗ ngay sau đó — một lần dựng lại cả trang, chồng
   * đúng lên lúc trang vừa hiện.
   *
   * Lượt hydrate vẫn nhận `getServerSnapshot` = `false` nên vẫn khớp HTML server
   * (§13 tránh mismatch); chỉ những lần mount sau mới đọc thẳng được `true`.
   */
  return useSyncExternalStore(subscribeHydration, isHydrated, () => false);
}

/**
 * Storage không dùng được (Safari private mode, cookie bị chặn) → persist bỏ
 * qua hydrate và KHÔNG bao giờ báo xong. Vẫn phải cho trang hiện ra, với danh
 * sách rỗng, thay vì để skeleton chạy mãi. Phạm vi module: hết hạn một lần là
 * xong cho cả phiên.
 */
let hydrationTimedOut = false;

function isHydrated(): boolean {
  return hydrationTimedOut || useMyListStore.persist.hasHydrated();
}

function subscribeHydration(onChange: () => void): () => void {
  if (isHydrated()) return () => {};

  const unsubscribe = useMyListStore.persist.onFinishHydration(onChange);
  const timer = setTimeout(() => {
    hydrationTimedOut = true;
    onChange();
  }, 1_000);

  return () => {
    unsubscribe();
    clearTimeout(timer);
  };
}
