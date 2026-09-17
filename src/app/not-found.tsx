import Link from 'next/link';
import { routes } from '@/lib/routes';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <h1 className="text-4xl font-extrabold">Không tìm thấy nội dung</h1>
      <p className="mt-3 text-text-secondary">
        Phim bạn tìm có thể đã bị gỡ hoặc đường dẫn không đúng.
      </p>
      <Link
        href={routes.home()}
        className="mt-8 rounded-pill bg-accent px-6 py-3 font-medium text-[color:var(--accent-contrast)] transition-colors duration-micro ease-standard hover:bg-accent-hover"
      >
        Về trang chủ
      </Link>
    </main>
  );
}
