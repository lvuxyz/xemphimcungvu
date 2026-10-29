import { Skeleton } from '@/components/ui/Skeleton';

/**
 * §12.2 — khung trang phát: player + tiêu đề bên trái, danh sách tập bên phải.
 * Cùng lưới và cùng khung player với `WatchScreen` để lúc dữ liệu về không nhảy.
 */
export default function WatchLoading() {
  return (
    <main className="min-h-screen pt-16" aria-hidden="true">
      <div className="mx-auto grid max-w-[110rem] gap-6 p-4 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-4">
          <Skeleton className="aspect-backdrop w-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 lg:self-start">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </main>
  );
}
