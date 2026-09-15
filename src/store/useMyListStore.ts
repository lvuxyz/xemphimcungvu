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
  /** Hydrate xong chưa — dùng để tránh lệch server/client render. */
  hydrated: boolean;

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
      hydrated: false,

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
      onRehydrateStorage: () => () => {
        useMyListStore.setState({ hydrated: true });
      },
    },
  ),
);
