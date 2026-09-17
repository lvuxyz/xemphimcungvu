import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Movie } from '@/types/movie';

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
}

function toEntry(movie: Movie): MyListEntry {
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
  };
}

interface MyListState {
  entries: MyListEntry[];

  add: (movie: Movie) => void;
  remove: (slug: string) => void;
  toggle: (movie: Movie) => boolean;
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
  // Lượt render đầu luôn là `false` để khớp HTML server (§13 tránh mismatch).
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (useMyListStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }

    const unsubscribe = useMyListStore.persist.onFinishHydration(() => setHydrated(true));

    /**
     * Storage không dùng được (Safari private mode, cookie bị chặn) → persist bỏ
     * qua hydrate và KHÔNG bao giờ báo xong. Vẫn phải cho trang hiện ra, với
     * danh sách rỗng, thay vì để skeleton chạy mãi.
     */
    const timer = setTimeout(() => setHydrated(true), 1_000);

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  return hydrated;
}
