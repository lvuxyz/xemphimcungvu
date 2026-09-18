import type { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import { IMAGE_CDN, SITE_NAME } from '@/lib/constants';
import type { ReactNode } from 'react';
import { Navbar } from '@/components/feature/Navbar/Navbar';
import { ToastViewport } from '@/components/ui/Toast';
import { NetworkBanner } from '@/components/ui/NetworkBanner';
import { Providers } from '@/providers';
import { getTaxonomies } from '@/lib/endpoints';
import '@/styles/globals.css';

/**
 * §7.2 — Be Vietnam Pro, kiểm tra kỹ dấu tiếng Việt ở weight 800
 * với các ký tự `ế ộ ữ ỡ ẳ` (Phụ lục A).
 *
 * Chỉ ba weight thay vì bốn: mỗi weight là 2 file (vietnamese + latin) được
 * preload trước khi trang vẽ xong. Bỏ 500 tiết kiệm 2 request và ~30KB ngay ở
 * đường găng của lần tải đầu — trên 3G là gần nửa giây. `font-medium` rơi về
 * 400, khác biệt gần như không nhận ra ở cỡ chữ 12–15px của UI.
 *
 * ⚠️ BUILD TRÊN WINDOWS THÌ KHÔNG CÓ PRELOAD FONT NÀO CẢ.
 *
 * Kiểm tra thật: HTML sinh ra có 0 thẻ `<link rel="preload" as="font">`, dù
 * `.next/static/media` có đủ 6 file `-s.p.woff2` (hậu tố `.p.` = Next đã đánh
 * dấu để preload). `server/next-font-manifest.json` rỗng: `{"app":{},...}`,
 * và `appUsingSizeAdjust` là `false` trong khi CSS rõ ràng có `size-adjust`.
 *
 * Nguyên nhân nằm trong `NextFontManifestPlugin` của Next 14.2:
 *
 *     mod.request?.includes('/next-font-loader/index.js?')
 *
 * Trên Windows, `mod.request` của webpack dùng dấu `\`. Soi trong
 * `.next/cache/webpack/client-production/0.pack` ra đúng chuỗi
 * `next-font-loader\index.js?` — điều kiện trên không bao giờ khớp, manifest
 * rỗng, và không thẻ preload nào được phát. Plugin cũng không rơi về preconnect
 * vì nó chỉ làm thế khi entry CÓ mặt nhưng rỗng, còn ở đây entry không tồn tại.
 *
 * Hệ quả thực tế: build trên Linux (Vercel, Docker, CI) thì preload chạy bình
 * thường và không cần làm gì. Chỉ bản build ra từ máy Windows mới thiếu — nên
 * đây là chuyện của chỗ build, KHÔNG phải chỗ để vá bằng thẻ preload viết tay:
 * tên file có hash đổi theo mỗi lần build.
 */
const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['vietnamese', 'latin'],
  weight: ['400', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
  fallback: ['system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
  /** Ghép metric với font hệ thống → chữ không nhảy khi font thật về (CLS). */
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: 'Xem phim trực tuyến — phim bộ, phim lẻ, hoạt hình, TV shows.',
  metadataBase: new URL('https://xemphimcungvu.local'),
};

export const viewport: Viewport = {
  themeColor: '#08080B',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  /** Cho nội dung tràn ra vùng tai thỏ; mép an toàn xử lý bằng env() trong CSS. */
  viewportFit: 'cover',
  /** KHÔNG khoá zoom: người dùng phải được phóng to (§13 khả dụng). */
  maximumScale: 5,
  userScalable: true,
};

/**
 * `modal` là parallel route slot của `app/@modal` — nền tảng của intercepting
 * route tạo trải nghiệm mở modal mà không rời trang (§6.1).
 *
 * ⚠️ Slot này bao trùm MỌI route, kể cả `/xem`. Thử tách nó xuống một nested
 * layout `(browse)` để trang phát nằm ngoài tầm: KHÔNG được — Next 14 vẫn khớp
 * `(.)phim/[slug]` khi điều hướng mềm từ `/xem` (log dev in đúng dòng
 * `Compiling /(.)phim/[slug]`), và vì `children` của group không khớp gì nên
 * trang ra 404. Route group trong suốt với bộ khớp interception.
 *
 * Cách chặn thật sự là ở phía nơi gọi: điều hướng từ trang phát sang
 * `/phim/{slug}` phải là điều hướng CỨNG. Xem `useLeavesPlayer()`.
 */
export default async function RootLayout({
  children,
  modal,
}: {
  children: ReactNode;
  modal: ReactNode;
}) {
  /**
   * §3.4 — ba danh mục cho Navbar, cache 24 giờ nên gần như không tốn gì ở các
   * lần render sau. Fail thì `getTaxonomies` trả rỗng và menu tự ẩn nhánh đó,
   * layout vẫn dựng bình thường (§14.1).
   */
  const { categories, countries, years } = await getTaxonomies();

  return (
    <html lang="vi" className={beVietnamPro.variable}>
      <head>
        {/*
          Bắt tay TLS với CDN ảnh tốn 2 vòng round-trip. Mở sẵn ngay khi HTML về
          thì ảnh hero (chính là LCP) bắt đầu tải sớm hơn ~200–400ms trên 4G,
          nhiều hơn nữa trên 3G.
        */}
        <link rel="preconnect" href={IMAGE_CDN} crossOrigin="" />
        <link rel="dns-prefetch" href={IMAGE_CDN} />
        {/* Trailer là tuỳ chọn nên chỉ dns-prefetch, không giữ kết nối. */}
        <link rel="dns-prefetch" href="https://www.youtube.com" />
      </head>
      <body>
        <Providers>
          <Navbar categories={categories} countries={countries} years={years} />
          {children}
          {modal}
          <ToastViewport />
          <NetworkBanner />
        </Providers>
      </body>
    </html>
  );
}
