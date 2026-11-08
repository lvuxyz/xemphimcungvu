'use client';

import { useEffect, useLayoutEffect, useSyncExternalStore } from 'react';

/**
 * Cờ "lưới đang chờ RSC mới" dùng chung giữa FilterBar, SearchBox và InfiniteGrid.
 *
 * Vì sao cần: đổi filter (hay tìm từ khoá mới khi đang ở `/tim-kiem`) chỉ đổi
 * `searchParams`. Next 14.2 đặt key cho boundary `loading.tsx` theo segment ĐÃ BỎ
 * search params, nên skeleton không hiện lại; còn `router.push` chạy trong
 * transition nên React giữ nguyên lưới cũ suốt một vòng RSC. Không có tín hiệu
 * nào thì người dùng tưởng click hỏng và bấm thêm lần nữa.
 *
 * Vì sao là store module chứ không phải context: SearchBox nằm trong Navbar ở
 * root layout, không cùng nhánh với lưới của trang — context đặt ở layout danh
 * sách không với tới được. Store ngoài React thì cả hai phía cùng đọc/ghi.
 *
 * Đếm theo nguồn (Set) chứ không phải một boolean: FilterBar xong trước mà
 * SearchBox vẫn đang chờ thì lưới vẫn phải mờ.
 */
const sources = new Set<string>();
const listeners = new Set<() => void>();

export function setListPending(source: string, pending: boolean): void {
  const had = sources.has(source);
  if (pending === had) return;
  if (pending) sources.add(source);
  else sources.delete(source);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => sources.size > 0;
/** Server và lượt render đầu ở client đều là `false` — không lệch hydration. */
const getServerSnapshot = () => false;

export function useListPending(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** `useLayoutEffect` ở client, `useEffect` lúc SSR — React 18 cảnh báo layout effect trên server. */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Báo `isPending` của một transition ra store. Phải là layout effect: commit của
 * transition là commit không đồng bộ, passive effect chạy SAU khi paint — cây mới
 * (InfiniteGrid remount theo searchParams) sẽ được vẽ một frame còn `data-pending`
 * rồi mới mờ dần lên, trông như kết quả mới bị làm mờ. Layout effect (và cleanup
 * lúc unmount) gỡ cờ trước paint; uSES re-render đồng bộ ngay trong commit đó.
 */
export function useReportListPending(source: string, isPending: boolean): void {
  useIsomorphicLayoutEffect(() => {
    setListPending(source, isPending);
  }, [source, isPending]);
  useIsomorphicLayoutEffect(() => () => setListPending(source, false), [source]);
}
