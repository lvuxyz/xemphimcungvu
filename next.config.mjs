import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  /**
   * §12.3 đề xuất custom loader trỏ vào `/image.php?url=` để lấy WEBP.
   *
   * ⚠️ Kiểm tra thật ngày 15/09/2026: endpoint đó trả 404 `{"status":false,"msg":"hmmm!"}`
   * với mọi dạng tham số (xem README mục "Sai lệch so với tài liệu"). Vì vậy dùng
   * optimizer sẵn có của Next: vẫn ra WEBP/AVIF, lại có resize theo `sizes` thật —
   * đúng tinh thần §12.2 hơn là proxy pass-through.
   *
   * Muốn bật lại proxy khi nó sống lại: đặt NEXT_PUBLIC_USE_IMAGE_PROXY=true
   * và bỏ comment hai dòng loader bên dưới.
   */
  images: {
    /**
     * Bật unoptimized: true để trình duyệt tải ảnh trực tiếp từ CDN của KKPhim (phimimg.com).
     * CDN này đã phục vụ định dạng WebP tối ưu sẵn qua Cloudflare Edge.
     * Việc này giải phóng 100% tải xử lý nén/resize ảnh khỏi CPU Node.js của server,
     * ngăn chặn hiện tượng tắc nghẽn Event Loop làm chậm các request API và SSR.
     */
    unoptimized: true,

    /**
     * ⚠️ Danh sách này được soi lại ở `src/lib/image.ts` (`OPTIMIZABLE_HOSTS`):
     * `poster_url` của KKPhim đôi khi trỏ sang host lạ, mà `next/image` NÉM LỖI
     * render với hostname chưa khai báo. SmartImage đọc danh sách kia để cho ảnh
     * lạ đi thẳng (`unoptimized`) thay vì làm sập trang. Sửa chỗ này thì sửa cả
     * chỗ đó.
     */
    remotePatterns: [
      { protocol: 'https', hostname: 'phimimg.com' },
      { protocol: 'https', hostname: 'phimapi.com' },
      { protocol: 'https', hostname: 'img.phimapi.com' },
      // §3.3 — /images và /peoples trả ảnh TMDB
      { protocol: 'https', hostname: 'image.tmdb.org' },
    ],

    /**
     * AVIF trước, WEBP sau. AVIF nhỏ hơn WEBP ~20–30% ở cùng chất lượng cảm nhận —
     * với một trang toàn poster thì đó là khác biệt thấy được trên 3G. Đổi lại:
     * lần encode đầu tiên của mỗi kích thước chậm hơn, nên `minimumCacheTTL` dài
     * bên dưới là bắt buộc chứ không phải tuỳ chọn.
     */
    formats: ['image/avif', 'image/webp'],

    /**
     * Mặc định của Next bắt đầu từ 640px — quá to cho card poster (~180–340px)
     * và cho điện thoại 360/414px. Thêm các mốc nhỏ để `sizes` chọn đúng bản vừa
     * đủ thay vì luôn nhảy lên bản 640.
     */
    deviceSizes: [360, 414, 640, 750, 828, 1080, 1280, 1920, 2560],
    imageSizes: [16, 32, 48, 64, 96, 128, 200, 256, 320, 384],

    /** Poster phim không đổi — giữ bản đã tối ưu 30 ngày. */
    minimumCacheTTL: 60 * 60 * 24 * 30,

    /**
     * KHÔNG bật `dangerouslyAllowSVG`. Placeholder nội bộ là SVG và optimizer của
     * Next 14 sẽ trả 400 cho chúng, nhưng lời giải đúng là cho placeholder đi
     * thẳng từ /public (`components/ui/SmartImage.tsx`) chứ không phải mở cửa cho
     * MỌI SVG từ CDN phim đi qua origin của mình — đó là đường XSS có thật khi
     * nguồn ảnh là bên thứ ba không kiểm soát được.
     */

    // loader: 'custom',
    // loaderFile: './src/lib/image-loader.ts',
  },

  // §12.2 — không để console.log lọt vào bundle production (Phụ lục B)
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },

  experimental: {
    optimizePackageImports: ['framer-motion'],

    /**
     * Router cache phía client giữ trang động bao lâu trước khi phải hỏi lại server.
     *
     * Mặc định 30s: mở lại một modal phim hay quay về trang thể loại sau nửa phút
     * là thêm một vòng RSC kèm skeleton, cho đúng dữ liệu đã có trong tay. 120 =
     * `REVALIDATE.search`, cache ngắn nhất phía server — không route nào hiện thứ
     * cũ hơn chính cache của nó. F5 hay `router.refresh()` vẫn lấy bản mới.
     */
    staleTimes: { dynamic: 120, static: 300 },
  },

  /**
   * Ảnh đã tối ưu và font tự host là bất biến theo URL — cho cache thật lâu để
   * lần vào thứ hai gần như không chạm mạng. Next đã đặt header cho /_next/static;
   * phần thiếu là ảnh trong /public.
   */
  async headers() {
    return [
      {
        source: '/:file(placeholder-.*\\.svg)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
