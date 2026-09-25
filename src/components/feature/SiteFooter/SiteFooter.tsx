import Link from 'next/link';
import { routes } from '@/lib/routes';

const COLUMNS = [
  {
    title: 'Duyệt phim',
    links: [
      { label: 'Phim bộ', href: routes.listByType('phim-bo') },
      { label: 'Phim lẻ', href: routes.listByType('phim-le') },
      { label: 'Hoạt hình', href: routes.listByType('hoat-hinh') },
      { label: 'TV Shows', href: routes.listByType('tv-shows') },
      { label: 'Tất cả phim', href: routes.list() },
    ],
  },
  {
    title: 'Của bạn',
    links: [
      { label: 'Danh sách của tôi', href: routes.myList() },
      { label: 'Tìm kiếm', href: routes.search('') },
    ],
  },
] as const;

/**
 * Chân trang — Server Component, không JS, không request.
 *
 * Trước đây trang chủ dừng ngay sau row cuối: cuộn hết là rơi vào một khoảng đen
 * không có gì báo đã tới đáy, cũng không có lối đi tiếp nào ngoài cuộn ngược lên
 * navbar. Ở đây là các lối đó, cộng một dòng nói rõ phim đến từ đâu.
 *
 * Chữ dùng `text-secondary`, không dùng `text-muted`: muted trên nền base chỉ
 * khoảng 3:1, dưới mức AA cho chữ cỡ này (§13.4).
 *
 * `prefetch={false}`: mặc định Next prefetch mọi `<Link>` lọt vào viewport, tức
 * là cuộn tới đáy trang chủ là bảy request RSC cho những trang ít ai bấm từ đây.
 */
export function SiteFooter() {
  return (
    <footer className="px-row pb-[calc(2.5rem+var(--safe-bottom))] text-sm text-text-secondary">
      <div className="flex flex-col gap-8 border-t border-white/10 pt-8 sm:flex-row sm:justify-between">
        <div className="max-w-sm space-y-2">
          <Link
            href={routes.home()}
            className="text-lg font-extrabold tracking-[-0.03em] text-accent-hover"
          >
            xemphim<span className="text-text-primary">cùngvũ</span>
          </Link>
          <p className="text-xs leading-relaxed">
            Dữ liệu phim lấy từ API công khai của KKPhim. Trang không lưu trữ video trên máy chủ của
            mình.
          </p>
        </div>

        <nav aria-label="Chân trang" className="flex gap-12">
          {COLUMNS.map((column) => (
            <div key={column.title} className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-text-primary">
                {column.title}
              </h2>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      prefetch={false}
                      className="transition-colors duration-micro ease-standard hover:text-text-primary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </footer>
  );
}
