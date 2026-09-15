import { cn } from '@/lib/cn';

/**
 * §12.2 — "Không dùng spinner. Skeleton giữ layout ổn định."
 * Hiệu ứng shimmer định nghĩa ở styles/globals.css.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('skeleton rounded-card', className)} />;
}

export function CardSkeleton({ aspect = 'backdrop' }: { aspect?: 'backdrop' | 'poster' }) {
  return (
    <Skeleton className={aspect === 'poster' ? 'aspect-poster w-full' : 'aspect-backdrop w-full'} />
  );
}

export function RowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="px-row">
      <Skeleton className="mb-3 h-5 w-48" />
      <div className="flex gap-2">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="w-[calc((100%-2.5rem)/6)] shrink-0">
            <CardSkeleton />
          </div>
        ))}
      </div>
    </div>
  );
}
