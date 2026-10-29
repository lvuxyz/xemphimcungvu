import type { MetadataRoute } from 'next';
import { SITE_NAME } from '@/lib/constants';

/**
 * Web App Manifest — cho phép "Thêm vào màn hình chính" trên Android/iOS.
 *
 * Với một app xem phim thì đây không phải màu mè: mở từ icon là chạy ở chế độ
 * standalone, không còn thanh địa chỉ chiếm mất ~10% chiều cao màn hình khi xem
 * ngang, và hệ điều hành giữ lại tab thay vì tải lại trang từ đầu.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: 'XemPhim',
    description: 'Xem phim trực tuyến — phim bộ, phim lẻ, hoạt hình, TV shows.',
    start_url: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#08080b',
    theme_color: '#08080b',
    lang: 'vi',
    categories: ['entertainment', 'video'],
    icons: [
      {
        /** `app/icon.svg` — cùng icon với tab trình duyệt. */
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
