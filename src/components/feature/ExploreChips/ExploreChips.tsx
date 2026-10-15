import Link from 'next/link';
import { routes } from '@/lib/routes';

/**
 * Chủ đề đứng trên dải chip — slug lấy từ `/quoc-gia` và `/the-loai` thật
 * (25/09/2026). Viết cứng thay vì gọi API: đây là lối vào hay dùng nhất chứ không
 * phải cả danh mục, và danh mục đầy đủ đã có ở menu Navbar (tải khi mở).
 */
const TOPICS = [
  { label: 'Hàn Quốc', href: routes.country('han-quoc') },
  { label: 'Trung Quốc', href: routes.country('trung-quoc') },
  { label: 'Âu Mỹ', href: routes.country('au-my') },
  { label: 'Nhật Bản', href: routes.country('nhat-ban') },
  { label: 'Thái Lan', href: routes.country('thai-lan') },
  { label: 'Việt Nam', href: routes.country('viet-nam') },
  { label: 'Hành động', href: routes.category('hanh-dong') },
  { label: 'Tình cảm', href: routes.category('tinh-cam') },
  { label: 'Cổ trang', href: routes.category('co-trang') },
  { label: 'Kinh dị', href: routes.category('kinh-di') },
  { label: 'Hài hước', href: routes.category('hai-huoc') },
  { label: 'Tâm lý', href: routes.category('tam-ly') },
  { label: 'Viễn tưởng', href: routes.category('vien-tuong') },
  { label: 'Võ thuật', href: routes.category('vo-thuat') },
  { label: 'TV Shows', href: routes.listByType('tv-shows') },
] as const;

/**
 * Dải "Khám phá" — lấy lại lối vào quốc gia / thể loại / TV Shows mà trang chủ đã
 * mất khi rút còn ít section, mà không tốn gì: Server Component, không JS, không
 * request. Chữ nằm sẵn trong HTML nên cũng không có lần dịch nào sau hydrate.
 *
 * Điện thoại: một hàng cuộn ngang, như mọi row khác. Từ `sm`: xuống dòng, vì chuột
 * không cuộn ngang được nếu không có trackpad — chip nằm ngoài mép là chip không
 * ai thấy.
 *
 * `prefetch={false}`: dải này có thể nằm trong màn hình đầu, và mặc định Next
 * prefetch mọi `<Link>` lọt vào viewport — 15 request RSC ngay lúc mở trang.
 */
export function ExploreChips() {
  return (
    <nav aria-labelledby="explore-heading" className="py-3">
      <h2
        id="explore-heading"
        className="mb-2 px-row text-base font-bold tracking-[-0.01em] text-text-primary md:text-lg"
      >
        Khám phá
      </h2>
      <ul className="scroll-x gap-2 px-row sm:flex-wrap sm:overflow-visible">
        {TOPICS.map((topic) => (
          <li key={topic.href} className="shrink-0">
            <Link
              href={topic.href}
              prefetch={false}
              className="inline-flex h-11 items-center whitespace-nowrap rounded-pill bg-bg-elevated px-4 text-sm font-medium text-text-secondary ring-1 ring-white/10 transition-colors duration-micro ease-standard hover:bg-bg-hover hover:text-text-primary sm:h-9"
            >
              {topic.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
