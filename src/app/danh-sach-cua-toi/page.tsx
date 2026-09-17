'use client';

import Link from 'next/link';
import { SmartImage } from '@/components/ui/SmartImage';
import { BLUR_DATA_URL, IMAGE_SIZES } from '@/lib/image';
import { EmptyState, ListHeader } from '@/components/feature/FilterBar/MovieGrid';
import { IconButton } from '@/components/ui/Button';
import { CloseIcon } from '@/components/ui/icons';
import { useMyListHydrated, useMyListStore } from '@/store/useMyListStore';
import { routes } from '@/lib/routes';

/** My List — đọc localStorage qua zustand persist, không có backend (§1.2). */
export default function MyListPage() {
  const entries = useMyListStore((s) => s.entries);
  const remove = useMyListStore((s) => s.remove);
  const hydrated = useMyListHydrated();

  // Chưa hydrate xong thì giữ khung — tránh nháy "danh sách rỗng" rồi mới có dữ liệu.
  if (!hydrated) {
    return (
      <main className="pb-16">
        <ListHeader title="Danh sách của tôi" count={0} />
        <div className="grid grid-cols-2 gap-3 px-row sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton aspect-poster rounded-card" />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="pb-16">
      <ListHeader title="Danh sách của tôi" count={entries.length} />

      {entries.length === 0 ? (
        <EmptyState
          title="Danh sách của bạn đang trống"
          hint="Rê chuột lên một phim bất kỳ rồi bấm dấu + để lưu lại."
        />
      ) : (
        <ul
          role="list"
          className="grid grid-cols-2 gap-3 px-row sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6"
        >
          {entries.map((entry) => (
            <li key={entry.slug} className="group relative">
              <Link
                href={routes.detail(entry.slug)}
                className="block overflow-hidden rounded-card bg-bg-elevated"
              >
                <div className="relative aspect-poster">
                  <SmartImage
                    src={entry.poster}
                    alt={`${entry.name} (${entry.year})`}
                    fill
                    sizes={IMAGE_SIZES.gridCard}
                    placeholder="blur"
                    blurDataURL={BLUR_DATA_URL}
                    className="object-cover"
                  />
                </div>
                <div className="space-y-1 p-2">
                  <p className="truncate text-xs font-medium text-text-primary">{entry.name}</p>
                  <p className="truncate text-[11px] text-text-muted">
                    {[entry.year > 0 ? entry.year : null, entry.quality].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </Link>

              <IconButton
                label={`Gỡ ${entry.name} khỏi danh sách`}
                size="sm"
                onClick={() => remove(entry.slug)}
                className="absolute right-2 top-2 opacity-0 transition-opacity duration-micro ease-standard focus-visible:opacity-100 group-hover:opacity-100"
              >
                <CloseIcon className="text-[10px]" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
