'use client';

import { useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FALLBACK_ROUTE, routes } from '@/lib/routes';
import { canGoBack } from '@/lib/history-depth';

/**
 * Mọi điều hướng có logic đi qua đây.
 *
 * Lý do gom lại: trước đây "mở chi tiết phim" được làm bằng HAI cách khác nhau
 * ngay trong cùng một component (`<Link href>` ở ảnh card, `router.push()` ở nút
 * ⌄ của HoverPreview), còn "mở modal phim liên quan" thì lại `push` nên bấm ESC
 * chỉ lùi được một nấc. Cùng một ý định mà ba nơi làm ba kiểu.
 *
 * `<Link>` vẫn được ưu tiên ở đâu có thể — nó cho ctrl/cmd + bấm mở tab mới, và
 * cho trình duyệt thấy đích đến. Hook này dành cho những chỗ điều hướng là hệ quả
 * của một hành động chứ không phải một cái link: đóng modal, đổi nội dung modal,
 * auto-next hết tập.
 */
export function useAppNavigation() {
  const router = useRouter();

  /**
   * §2.4 — chống double-click cho Play.
   *
   * Cú bấm thứ hai vào nút Phát trong lúc route đang tải sẽ đẩy thêm một entry
   * y hệt vào lịch sử: người dùng thoát player rồi phải bấm Back hai lần mới ra
   * khỏi được. Khoá 600ms là đủ dài để nuốt cú bấm lặp mà vẫn cho bấm lại thật
   * sự nếu route không đi.
   */
  const lockRef = useRef(0);

  const guard = useCallback((): boolean => {
    const now = Date.now();
    if (now - lockRef.current < 600) return false;
    lockRef.current = now;
    return true;
  }, []);

  /** Mở chi tiết phim — intercepting route biến nó thành modal khi đang ở nhánh browse. */
  const openTitle = useCallback(
    (slug: string) => {
      if (!guard()) return;
      router.push(routes.detail(slug));
    },
    [router, guard],
  );

  /**
   * Đổi phim đang xem trong modal ("Có thể bạn thích") mà KHÔNG chồng lịch sử.
   *
   * `replace` chứ không `push`: modal thay nội dung tại chỗ, nên nó phải chiếm
   * đúng một entry. Bản cũ dùng `push` — xem 5 phim liên quan rồi bấm ESC là
   * phải bấm 5 lần mới thoát được ra trang nền.
   */
  const swapTitle = useCallback(
    (slug: string) => {
      if (!guard()) return;
      router.replace(routes.detail(slug));
    },
    [router, guard],
  );

  /** Mở trình phát. `replace` dành cho auto-next: hết tập không phải một điểm dừng. */
  const playTitle = useCallback(
    (slug: string, options?: { episodeSlug?: string; replace?: boolean }) => {
      if (!guard()) return;
      const href = routes.watch(slug, options?.episodeSlug);

      if (options?.replace) {
        router.replace(href);
        return;
      }
      router.push(href);
    },
    [router, guard],
  );

  /**
   * Lùi về nơi vừa đi ra, hoặc về trang chủ nếu không có chỗ nào để lùi.
   *
   * §2.3 — "Thoát player → quay về đúng trang trước; nếu vào thẳng thì về
   * /browse". `router.back()` trần sẽ ném người mở link chia sẻ ra khỏi site.
   */
  const goBackOrHome = useCallback(() => {
    if (canGoBack()) {
      router.back();
      return;
    }
    router.replace(FALLBACK_ROUTE);
  }, [router]);

  return { openTitle, swapTitle, playTitle, goBackOrHome };
}
