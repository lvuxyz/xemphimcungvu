'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import type { Taxonomy } from '@/types/movie';
import { ChevronDownIcon } from '@/components/ui/icons';
import { PATH, routes } from '@/lib/routes';
import { usePresence } from '@/hooks/usePresence';
import { MobileMenu } from './MobileMenu';
import { SearchBox } from './SearchBox';

const MENU = [
  { label: 'Phim bộ', href: routes.listByType('phim-bo') },
  { label: 'Phim lẻ', href: routes.listByType('phim-le') },
  { label: 'Hoạt hình', href: routes.listByType('hoat-hinh') },
  { label: 'TV Shows', href: routes.listByType('tv-shows') },
] as const;

/**
 * §8.1 — Navbar.
 *
 *   trạng thái đầu   : nền trong suốt
 *   ngưỡng chuyển    : scrollY > 60
 *   trạng thái sau   : bg-base/95 + backdrop-blur(12px)
 *   transition       : 300ms
 */
interface NavbarProps {
  categories: Taxonomy[];
  countries: Taxonomy[];
  years: number[];
}

/**
 * Navbar là Client Component (§2.3 — cần scroll listener và search), nhưng dữ liệu
 * danh mục do RSC truyền xuống: import thẳng mock ở đây sẽ kéo cả bộ dữ liệu vào
 * bundle initial và phá ngân sách §12.1.
 */
export function Navbar({ categories, countries, years }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  /**
   * Đọc `scrollY` ngay trong listener là ép trình duyệt tính lại layout giữa lúc
   * đang cuộn. Dồn vào một rAF: mỗi khung hình đọc đúng một lần, và chỉ khi khung
   * hình trước đã xử lý xong.
   */
  useEffect(() => {
    let frame = 0;

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setScrolled(window.scrollY > 60);
      });
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-navbar pt-[var(--safe-top)]">
      {/**
       * Hai lớp nền CHỒNG nhau và mờ chéo, thay vì tháo lớp này ra lắp lớp kia.
       *
       * Bản cũ tháo hẳn lớp gradient ở ngưỡng scrollY = 60 trong khi màu nền lại
       * mờ dần 300ms: đúng lúc vượt ngưỡng, gradient biến mất tức thì còn nền
       * mới thì chưa kịp hiện → chữ nav nháy một cái trên nền hero sáng. Blur
       * cũng bật/tắt tức thì vì `transition-colors` không đụng tới backdrop-filter.
       *
       * Để cả hai lớp luôn có mặt và chỉ đổi `opacity` thì mọi thứ đi cùng một
       * nhịp, cả lúc cuộn xuống lẫn lúc cuộn ngược lên.
       */}
      <div
        aria-hidden="true"
        data-motion="fade"
        className={cn(
          'pointer-events-none absolute inset-0 bg-bg-base/95 backdrop-blur-[12px]',
          'transition-opacity duration-standard ease-standard',
          scrolled ? 'opacity-100' : 'opacity-0',
        )}
      />
      {/* Gradient mềm khi chưa scroll, để chữ nav đọc được trên nền hero sáng */}
      <div
        aria-hidden="true"
        data-motion="fade"
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-32',
          'bg-gradient-to-b from-bg-base/95 via-bg-base/55 to-transparent',
          'transition-opacity duration-standard ease-standard',
          scrolled ? 'opacity-0' : 'opacity-100',
        )}
      />

      <nav className="relative flex h-16 items-center gap-6 px-row" aria-label="Điều hướng chính">
        <Link
          href={routes.home()}
          className="shrink-0 text-lg font-extrabold tracking-[-0.03em] text-accent-hover"
        >
          xemphim<span className="text-text-primary">cùngvũ</span>
        </Link>

        <ul className="hidden items-center gap-5 lg:flex">
          {MENU.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  'text-sm transition-colors duration-micro ease-standard hover:text-text-primary',
                  pathname === item.href ? 'font-medium text-text-primary' : 'text-text-secondary',
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}

          <MegaMenu
            label="Thể loại"
            items={categories.map((c) => ({ label: c.name, href: routes.category(c.slug) }))}
          />
          <MegaMenu
            label="Quốc gia"
            items={countries.map((c) => ({ label: c.name, href: routes.country(c.slug) }))}
          />
          <MegaMenu
            label="Năm"
            items={years.slice(0, 24).map((y) => ({ label: String(y), href: routes.year(y) }))}
            columns={4}
          />
        </ul>

        <div className="ml-auto flex items-center gap-1 sm:gap-3">
          <SearchBox />
          <Link
            href={PATH.myList}
            className="hidden text-sm text-text-secondary transition-colors duration-micro ease-standard hover:text-text-primary lg:block"
          >
            Danh sách của tôi
          </Link>
          <MobileMenu menu={MENU} categories={categories} countries={countries} years={years} />
        </div>
      </nav>
    </header>
  );
}

/** §8.1 — mega dropdown cho Thể loại / Quốc gia / Năm. */
function MegaMenu({
  label,
  items,
  columns = 3,
}: {
  label: string;
  items: { label: string; href: string }[];
  columns?: number;
}) {
  const [open, setOpen] = useState(false);

  /**
   * Con trỏ có đang nằm trên mục này không.
   *
   * Thiếu cờ này thì click bằng chuột hoá ra là ĐÓNG: trình duyệt bắn
   * `mouseenter` (mở) NGAY TRƯỚC `click` (toggle → đóng), nên menu vừa bung ra
   * đã biến mất dưới chính con trỏ vừa bấm. Bàn phím không có `mouseenter` nên
   * `Enter`/`Space` vẫn mở/đóng như thường.
   */
  const hovering = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  /**
   * Giữ panel sống thêm 150ms để nó kịp mờ dần khi đóng. Không có nó thì menu
   * bung ra và tắt phụt như một cái đèn — chỗ duy nhất trong app còn đóng/mở
   * không có chuyển tiếp.
   */
  const { mounted, visible } = usePresence(open, 150);

  if (items.length === 0) return null;

  return (
    <li
      className="relative"
      onMouseEnter={() => {
        hovering.current = true;
        setOpen(true);
      }}
      onMouseLeave={() => {
        hovering.current = false;
        setOpen(false);
      }}
      // §13.1 — ESC đóng menu và trả focus về nút mở.
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !open) return;
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (hovering.current) return;
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        className="flex items-center gap-1 text-sm text-text-secondary transition-colors duration-micro ease-standard hover:text-text-primary"
      >
        {label}
        <ChevronDownIcon
          className={cn(
            'text-xs transition-transform duration-micro ease-standard',
            open && 'rotate-180',
          )}
        />
      </button>

      {mounted && (
        /**
         * `pt-2` là CẦU NỐI cho con trỏ. Panel phải hở ra khỏi chữ một chút mới
         * không dính vào nav, nhưng khoảng hở đó nếu nằm ngoài cây DOM của `li`
         * thì đi chuột qua nó là `mouseleave` bắn ra và menu sập ngay trước khi
         * tay kịp tới. Cho khoảng hở thành padding của chính panel thì nó vẫn là
         * con của `li`, chuột đi qua vẫn coi như đang ở trong menu.
         */
        <div
          className={cn(
            'absolute left-0 top-full pt-2',
            'transition-[opacity,transform] duration-micro ease-standard',
            visible ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-1 opacity-0',
          )}
          data-motion="fade"
        >
          <div
            className="w-max max-w-[min(90vw,44rem)] rounded-card bg-bg-elevated/95 p-4 shadow-elev-2 ring-1 ring-white/10 backdrop-blur-md"
            style={{ columnCount: columns, columnGap: '1.5rem' }}
          >
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block break-inside-avoid py-1 text-sm text-text-secondary transition-colors duration-micro ease-standard hover:text-accent-hover"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </li>
  );
}
