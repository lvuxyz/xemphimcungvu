'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SmartImage } from '@/components/ui/SmartImage';
import { Button, IconButton } from '@/components/ui/Button';
import { CloseIcon } from '@/components/ui/icons';
import { EmptyState, ListHeader } from '@/components/feature/FilterBar/MovieGrid';
import { cn } from '@/lib/cn';
import { episodeLabel, formatTime } from '@/lib/derive';
import { groupByDay } from '@/lib/history';
import { BLUR_DATA_URL } from '@/lib/image';
import { PLACEHOLDER_BACKDROP } from '@/lib/constants';
import { routes } from '@/lib/routes';
import type { WatchIndexEntry } from '@/lib/storage';
import { resumePoint, useWatchStore } from '@/store/useWatchStore';
import { useUIStore } from '@/store/useUIStore';
import { useDevice } from '@/hooks/useDevice';

/** Bao lâu thì cú bấm "Xoá" đầu tiên hết hiệu lực — cùng mốc với `PersonalizationToggle`. */
const CONFIRM_TIMEOUT = 5_000;

const GRID = 'grid grid-cols-2 gap-3 px-row sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5';

/** Khớp đúng `GRID` ở trên: 2 / 3 / 4 / 5 cột. */
const CARD_SIZES =
  '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1536px) 25vw, 20vw';

/**
 * Trang lịch sử xem — mọi phim trong index tiến độ, gom theo ngày.
 *
 * Row "Tiếp tục xem" chỉ giữ 12 phim CÒN DỞ; phim đã xem hết hoặc rơi khỏi 12 chỗ
 * đó thì không còn lối nào quay lại. Trang này là lối đó, và cũng là chỗ gỡ từng
 * phim mà không phải xoá sạch cả lịch sử.
 *
 * Không request nào: dựng hoàn toàn từ index (`lib/storage.ts`), cùng nguồn với
 * row "Tiếp tục xem". Tắt cá nhân hoá thì `entries` của store về rỗng — trang này
 * tôn trọng đúng cờ đó thay vì tự đọc storage vòng qua nó.
 */
export function WatchHistory() {
  const entries = useWatchStore((s) => s.entries);
  const loaded = useWatchStore((s) => s.loaded);
  const personalized = useWatchStore((s) => s.personalized);
  const hasData = useWatchStore((s) => s.hasData);
  const refresh = useWatchStore((s) => s.refresh);
  const forget = useWatchStore((s) => s.forget);
  const clearAll = useWatchStore((s) => s.clearAll);
  const pushToast = useUIStore((s) => s.pushToast);
  const { canHover } = useDevice();

  // Store chỉ nạp ở lúc khởi động và trang chủ — tới đây từ trang phát thì nó đã cũ.
  useEffect(() => refresh(), [refresh]);

  /**
   * `now` chốt một lần khi trang mở, không tính lại mỗi lượt render: gỡ một phim
   * lúc 23:59:59 không được làm cả trang nhảy nhóm.
   */
  const [now] = useState(() => Date.now());

  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), CONFIRM_TIMEOUT);
    return () => clearTimeout(timer);
  }, [confirming]);

  const onClearAll = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    clearAll();
    setConfirming(false);
    pushToast('Đã xoá lịch sử xem trên máy này', { variant: 'success' });
  };

  if (!loaded) {
    return (
      <main className="pb-16">
        <ListHeader title="Lịch sử xem" count={0} />
        <div className={cn(GRID, 'mt-6')} aria-hidden="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton aspect-backdrop rounded-card" />
          ))}
        </div>
      </main>
    );
  }

  if (!personalized && hasData) {
    return (
      <main className="pb-16">
        <ListHeader title="Lịch sử xem" count={0} />
        <EmptyState
          title="Lịch sử đang ẩn vì bạn đã tắt cá nhân hoá"
          hint="Bật lại Cá nhân hoá trong menu ở thanh điều hướng để xem. Dữ liệu vẫn còn nguyên."
        />
      </main>
    );
  }

  if (entries.length === 0) {
    return (
      <main className="pb-16">
        <ListHeader title="Lịch sử xem" count={0} />
        <EmptyState
          title="Chưa có phim nào trong lịch sử"
          hint="Phim bạn xem sẽ hiện ở đây, chỉ lưu trên máy này."
        />
      </main>
    );
  }

  const groups = groupByDay(entries, now);

  return (
    <main className="pb-16">
      <div className="flex flex-wrap items-end justify-between gap-3 pr-row">
        <ListHeader title="Lịch sử xem" count={entries.length} />
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className={cn(confirming && 'font-semibold text-danger hover:text-danger')}
        >
          {confirming ? 'Chắc chắn xoá? Bấm lại để xoá.' : 'Xoá toàn bộ lịch sử'}
        </Button>
      </div>

      {groups.map((group) => (
        <section key={group.key} className="mt-6" aria-labelledby={`history-${group.key}`}>
          <h2
            id={`history-${group.key}`}
            className="mb-2 px-row text-base font-bold tracking-[-0.01em] text-text-primary md:text-lg"
          >
            {group.label}
          </h2>

          <ul role="list" className={GRID}>
            {group.entries.map((entry) => (
              <HistoryCard
                key={entry.slug}
                entry={entry}
                canHover={canHover}
                onForget={() => forget(entry.slug)}
              />
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}

/**
 * Card dẫn tới đâu và nói gì dưới tên phim.
 *
 *   · còn dở  → mở đúng tập, đúng giây đang xem
 *   · xem hết → trang chi tiết, để chọn tập tiếp hay xem lại
 *   · mới mở vài giây (dưới ngưỡng resume) → mở tập đó từ đầu
 */
function describe(entry: WatchIndexEntry): { href: string; status: string; ratio: number } {
  const resume = resumePoint(entry);
  const label = entry.snapshot ? episodeLabel(entry.snapshot.episodeName) : '';

  if (resume) {
    return {
      href: routes.watch(entry.slug, resume.ep, { startAt: resume.position }),
      status: [label, `còn ${formatTime(resume.remaining)}`].filter(Boolean).join(' · '),
      ratio: resume.ratio,
    };
  }

  if (Object.keys(entry.eps).length === 0 && entry.finished > 0) {
    return {
      href: routes.detail(entry.slug),
      status: entry.finished > 1 ? `Đã xem hết ${entry.finished} tập` : 'Đã xem hết',
      ratio: 1,
    };
  }

  return {
    href: routes.watch(entry.slug, entry.lastEp || undefined),
    status: label || 'Mới bắt đầu',
    ratio: 0,
  };
}

function HistoryCard({
  entry,
  canHover,
  onForget,
}: {
  entry: WatchIndexEntry;
  canHover: boolean;
  onForget: () => void;
}) {
  const { href, status, ratio } = describe(entry);
  /**
   * Entry dựng lại từ key cũ (`rebuildIndex`) không có snapshot. Vẫn hiện — đây là
   * chỗ duy nhất gỡ được nó — nhưng chỉ có slug để làm tên.
   */
  const name = entry.snapshot?.name ?? entry.slug;
  const image = entry.snapshot?.thumb || entry.snapshot?.poster || PLACEHOLDER_BACKDROP;

  return (
    <li className="group relative">
      {/* KHÔNG prefetch: cả lưới là route trình phát, cùng lý do với `ContinueRow`. */}
      <Link
        href={href}
        prefetch={false}
        className="block overflow-hidden rounded-card bg-bg-elevated"
      >
        <div className="relative aspect-backdrop">
          <SmartImage
            src={image}
            alt={name}
            fill
            sizes={CARD_SIZES}
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            className="object-cover"
          />

          {ratio > 0 && (
            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] bg-white/20">
              <span
                className="block h-full bg-accent"
                style={{ width: `${Math.max(2, Math.round(ratio * 100))}%` }}
              />
            </span>
          )}
        </div>

        <div className="h-[3.25rem] px-2 py-1.5">
          <p className="truncate text-xs font-medium text-text-primary">{name}</p>
          <p className="truncate text-[11px] text-text-muted">{status}</p>
        </div>
      </Link>

      <IconButton
        label={`Gỡ ${name} khỏi lịch sử`}
        size="sm"
        onClick={onForget}
        className={cn(
          'absolute right-2 top-2 transition-opacity duration-micro ease-standard',
          // Màn cảm ứng không hover được: nút phải hiện sẵn, nếu không là không có lối gỡ.
          canHover ? 'opacity-0 focus-visible:opacity-100 group-hover:opacity-100' : 'opacity-100',
        )}
      >
        <CloseIcon className="text-[10px]" />
      </IconButton>
    </li>
  );
}
