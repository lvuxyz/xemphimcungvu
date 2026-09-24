'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { useScrollLock } from '@/hooks/useScrollLock';
import { usePresence } from '@/hooks/usePresence';
import { useTaxonomyLinks, type TaxonomyKind } from '@/hooks/useTaxonomyLinks';
import { CloseIcon } from '@/components/ui/icons';
import { PATH } from '@/lib/routes';
import { PersonalizationToggle } from './PersonalizationToggle';

interface MobileMenuProps {
  menu: ReadonlyArray<{ label: string; href: string }>;
}

/**
 * Điều hướng cho màn hẹp (§8.1 mở rộng).
 *
 * Bản cũ ẩn toàn bộ menu ở dưới `lg` và không có gì thay thế: trên điện thoại,
 * người dùng chỉ còn logo và ô tìm kiếm — không có đường nào tới thể loại,
 * quốc gia, năm hay danh sách của tôi. Đây là chỗ hổng lớn nhất về "đa dụng".
 *
 * Mọi mục chạm được đều cao tối thiểu 44px theo khuyến nghị vùng chạm.
 */
export function MobileMenu({ menu }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  /** Giữ panel lại đủ 300ms để nó trượt ra khỏi màn hình rồi mới tháo. */
  const { mounted, visible } = usePresence(open, 300);

  useScrollLock(open);

  // Điều hướng xong thì đóng — nếu không, quay lại trang mới vẫn thấy menu che kín.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    panelRef.current?.focus();
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Mở menu"
        aria-expanded={open}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card text-text-primary transition-colors duration-micro ease-standard hover:bg-bg-hover lg:hidden"
      >
        <span aria-hidden="true" className="space-y-[5px]">
          <span className="block h-[2px] w-5 rounded-pill bg-current" />
          <span className="block h-[2px] w-5 rounded-pill bg-current" />
          <span className="block h-[2px] w-5 rounded-pill bg-current" />
        </span>
      </button>

      {mounted && (
        <div className="fixed inset-0 z-modal lg:hidden">
          <div
            data-motion="fade"
            className={cn(
              'absolute inset-0 bg-bg-base/80 backdrop-blur-sm',
              'transition-opacity duration-standard ease-standard',
              visible ? 'opacity-100' : 'opacity-0',
            )}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          <div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Điều hướng"
            className={cn(
              'absolute inset-y-0 right-0 flex w-[min(20rem,88vw)] flex-col bg-bg-elevated shadow-elev-3 outline-none',
              'pb-[max(1rem,var(--safe-bottom))] pt-[max(0.75rem,var(--safe-top))]',
              /**
               * Trượt từ mép phải vào. Cả tấm menu che 88% màn hình mà hiện ra
               * tức thì thì người dùng mất dấu: không biết nó từ đâu tới, đóng
               * lại thì trang cũ nhảy về cũng đột ngột y hệt. Trượt ngang kể
               * đúng câu chuyện "menu nằm ngoài mép màn hình" và cho mắt bám theo.
               */
              'transition-transform duration-standard ease-standard',
              visible ? 'translate-x-0' : 'translate-x-full',
            )}
          >
            <div className="flex items-center justify-between px-4 pb-2">
              <span className="text-sm font-semibold text-text-secondary">Danh mục</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Đóng menu"
                className="flex h-11 w-11 items-center justify-center rounded-card text-text-primary transition-colors duration-micro ease-standard hover:bg-bg-hover"
              >
                <CloseIcon />
              </button>
            </div>

            <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4">
              <ul className="mb-2">
                {menu.map((item) => (
                  <li key={item.href}>
                    <MenuLink href={item.href} active={pathname === item.href}>
                      {item.label}
                    </MenuLink>
                  </li>
                ))}
                <li>
                  <MenuLink href={PATH.myList} active={pathname === PATH.myList}>
                    Danh sách của tôi
                  </MenuLink>
                </li>
              </ul>

              <Section title="Thể loại" kind="categories" />
              <Section title="Quốc gia" kind="countries" />
              <Section title="Năm phát hành" kind="years" limit={16} />
            </nav>

            {/*
              Công tắc nằm NGOÀI vùng cuộn, dính đáy panel.
              Để nó trong `nav` thì muốn tắt cá nhân hoá phải cuộn qua hết danh sách
              thể loại, quốc gia và năm — một tuỳ chọn về sự riêng tư không nên là
              thứ khó tìm nhất trong menu.
            */}
            <div className="shrink-0 border-t border-white/10 px-2 pt-1">
              <PersonalizationToggle />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MenuLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex min-h-[44px] items-center rounded-card px-3 text-[15px] transition-colors duration-micro ease-standard',
        active ? 'bg-bg-hover font-medium text-text-primary' : 'text-text-secondary',
      )}
    >
      {children}
    </Link>
  );
}

/**
 * Một nhánh danh mục, gập sẵn. Danh sách chỉ tải khi nhánh được MỞ — mở menu điện
 * thoại để tìm "Danh sách của tôi" không kéo theo ba danh mục chẳng ai nhìn tới.
 */
function Section({ title, kind, limit }: { title: string; kind: TaxonomyKind; limit?: number }) {
  const [expanded, setExpanded] = useState(false);
  const { data, isError } = useTaxonomyLinks(kind, expanded);
  const items = data && limit !== undefined ? data.slice(0, limit) : data;

  return (
    <details
      className="group border-t border-white/5 py-1"
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between px-3 text-sm font-medium text-text-primary">
        {title}
        <span
          aria-hidden="true"
          className="text-text-muted transition-transform duration-micro ease-standard group-open:rotate-180"
        >
          ⌄
        </span>
      </summary>
      <div className="flex flex-wrap gap-1.5 px-3 pb-3 pt-1">
        {items && items.length > 0 ? (
          items.map((item) => (
            <TagLink key={item.href} href={item.href}>
              {item.label}
            </TagLink>
          ))
        ) : isError || items ? (
          <p className="py-2 text-[13px] text-text-muted">Không tải được danh mục.</p>
        ) : (
          // Đang tải — ô cùng cỡ với TagLink thật.
          Array.from({ length: 8 }).map((_, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="skeleton inline-flex min-h-[36px] w-20 rounded-pill"
            />
          ))
        )}
      </div>
    </details>
  );
}

function TagLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-[36px] items-center rounded-pill bg-bg-hover px-3 text-[13px] text-text-secondary transition-colors duration-micro ease-standard active:bg-[color:var(--accent-soft)] active:text-accent-hover"
    >
      {children}
    </Link>
  );
}
