'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { SmartImage } from '@/components/ui/SmartImage';
import { IconButton } from '@/components/ui/Button';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { episodeLabel, formatTime } from '@/lib/derive';
import { BLUR_DATA_URL, IMAGE_SIZES } from '@/lib/image';
import { PLACEHOLDER_BACKDROP } from '@/lib/constants';
import { routes } from '@/lib/routes';
import type { WatchIndexEntry } from '@/lib/storage';
import { resumePoint, useWatchStore } from '@/store/useWatchStore';
import { useRowScroll } from '@/hooks/useRowScroll';
import { useDevice } from '@/hooks/useDevice';

/** Số card tối đa. Quá đây thì nó thành trang lịch sử, không còn là lối quay lại. */
const MAX_ITEMS = 12;

/** Bề rộng card — giữ đúng thang của `ContentRow` để `IMAGE_SIZES.rowCard` vẫn đúng. */
const CARD_WIDTH = 'w-[45%] shrink-0 sm:w-[30%] lg:w-[19%] 2xl:w-[16%]';

/** Khối chữ dưới ảnh: chiều cao CỐ ĐỊNH để khung chờ và card thật cao bằng nhau. */
const TEXT_BLOCK = 'h-[3.25rem] px-2 py-1.5';

/**
 * Row "Tiếp tục xem" — dựng hoàn toàn từ localStorage, KHÔNG một request nào.
 *
 * Đây là phần thu lãi của cái index ở `lib/storage.ts`: mỗi entry đã mang theo
 * snapshot (tên, ảnh, tập) từ lúc người ta xem, nên row này vẽ được ngay trong
 * lượt hydrate. Không có snapshot thì phải gọi `/phim/{slug}` cho từng phim —
 * mấy request nối tiếp ở ngay màn hình đầu, đúng thứ §11.2 cấm.
 *
 * Chỗ chừa chống CLS do `.continue-slot` + `CONTINUE_PROBE` lo, xem `continue-probe.ts`.
 */
export function ContinueRow() {
  const entries = useWatchStore((s) => s.entries);
  const loaded = useWatchStore((s) => s.loaded);
  const refresh = useWatchStore((s) => s.refresh);
  const forget = useWatchStore((s) => s.forget);
  const { canHover, tier } = useDevice();
  const router = useRouter();
  const { ref, canScrollPrev, canScrollNext, scrollNext, scrollPrev } =
    useRowScroll<HTMLUListElement>();

  /**
   * Đọc lại mỗi lần row lên màn hình, không chỉ lần đầu: xem xong một tập rồi bấm
   * Back về trang chủ là điều hướng mềm — component mount lại nhưng store thì
   * không, và tiến độ vừa ghi sẽ không bao giờ hiện ra nếu chỉ nạp một lần.
   */
  useEffect(() => refresh(), [refresh]);

  const items = entries
    .filter((entry) => entry.snapshot !== null && resumePoint(entry) !== null)
    .slice(0, MAX_ITEMS);

  const firstResume = items[0] ? resumePoint(items[0]) : null;
  const firstHref =
    items[0] && firstResume
      ? routes.watch(items[0].slug, firstResume.ep, { startAt: firstResume.position })
      : null;

  /**
   * Tải trước ĐÚNG MỘT route: tập mà người này gần như chắc chắn bấm tiếp.
   *
   * Cả row không prefetch (12 route trình phát thì thành nghẽn băng thông), nhưng
   * mục đầu tiên là cú bấm có xác suất cao nhất trên cả trang chủ — trả trước một
   * lần cho nó thì cú bấm đó thành tức thì.
   *
   * Hai điều kiện: chỉ khi máy RỖI (`requestIdleCallback`, không tranh với ảnh hero
   * và 6 row đang tải), và chỉ ở tier `high` — mạng yếu thì tải trước một trang
   * người ta CHƯA bấm là đúng thứ làm nghẽn nốt băng thông còn lại, cùng lý do
   * `MovieCard` chặn prefetch khi hover ở tier thấp.
   */
  useEffect(() => {
    if (!firstHref || tier !== 'high') return;

    const run = () => router.prefetch(firstHref);

    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(run, { timeout: 3_000 });
      return () => window.cancelIdleCallback?.(id);
    }

    // Safari cũ không có requestIdleCallback — chờ một nhịp rồi làm.
    const timer = setTimeout(run, 2_000);
    return () => clearTimeout(timer);
  }, [firstHref, tier, router]);

  // Chưa đọc xong localStorage → giữ khung, để chỗ đã chừa không nháy rồi mới có card.
  if (!loaded) return <ContinueSkeleton />;
  if (items.length === 0) return null;

  return (
    <section className="py-3" aria-labelledby="continue-heading">
      <h2
        id="continue-heading"
        className="mb-2 px-row text-base font-bold tracking-[-0.01em] text-text-primary md:text-lg"
      >
        Tiếp tục xem
      </h2>

      <div className="relative">
        {canHover && (
          <>
            <Arrow side="left" visible={canScrollPrev} onClick={scrollPrev} label="Cuộn ngược" />
            <Arrow side="right" visible={canScrollNext} onClick={scrollNext} label="Cuộn tiếp" />
          </>
        )}

        <ul ref={ref} className="scroll-x gap-2 px-row" role="list">
          {items.map((entry) => (
            <ContinueCard
              key={entry.slug}
              entry={entry}
              canHover={canHover}
              onForget={() => forget(entry.slug)}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}

function ContinueCard({
  entry,
  canHover,
  onForget,
}: {
  entry: WatchIndexEntry;
  canHover: boolean;
  onForget: () => void;
}) {
  const snapshot = entry.snapshot;
  const resume = resumePoint(entry);
  if (!snapshot || !resume) return null;

  const label = episodeLabel(snapshot.episodeName);
  const href = routes.watch(entry.slug, resume.ep, { startAt: resume.position });

  return (
    <li className={cn('row-item group/cw relative', CARD_WIDTH)}>
      <Link
        href={href}
        className="block overflow-hidden rounded-card bg-bg-elevated"
        /**
         * KHÔNG prefetch: 12 card ở đây là 12 route trình phát, tải trước hết là
         * đúng kiểu nghẽn băng thông mà §11.2 cấm — và chúng nằm ngay trên màn hình
         * đầu, nơi băng thông đang thuộc về ảnh hero.
         */
        prefetch={false}
      >
        <div className="relative aspect-backdrop">
          <SmartImage
            src={snapshot.thumb || snapshot.poster || PLACEHOLDER_BACKDROP}
            alt={snapshot.name}
            fill
            sizes={IMAGE_SIZES.rowCard}
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            className="object-cover"
          />

          {/* Tiến độ — thứ duy nhất phân biệt card này với card thường */}
          <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] bg-white/20">
            <span
              className="block h-full bg-accent"
              style={{ width: `${Math.max(2, Math.round(resume.ratio * 100))}%` }}
            />
          </span>
        </div>

        <div className={TEXT_BLOCK}>
          <p className="truncate text-xs font-medium text-text-primary">{snapshot.name}</p>
          <p className="truncate text-[11px] text-text-muted">
            {[label, `còn ${formatTime(resume.remaining)}`].filter(Boolean).join(' · ')}
          </p>
        </div>
      </Link>

      <IconButton
        label={`Gỡ ${snapshot.name} khỏi Tiếp tục xem`}
        size="sm"
        onClick={onForget}
        className={cn(
          'absolute right-2 top-2 transition-opacity duration-micro ease-standard',
          // Màn cảm ứng không hover được: nút phải hiện sẵn, nếu không là không có lối gỡ.
          canHover
            ? 'opacity-0 focus-visible:opacity-100 group-hover/cw:opacity-100'
            : 'opacity-100',
        )}
      >
        <CloseIcon className="text-[10px]" />
      </IconButton>
    </li>
  );
}

/**
 * Khung chờ — cùng cấu trúc và cùng chiều cao với card thật (`CARD_WIDTH` +
 * `aspect-backdrop` + `TEXT_BLOCK`), nên lúc card thật vào không dịch một pixel.
 */
function ContinueSkeleton() {
  return (
    <section className="py-3" aria-hidden="true">
      <div className="mb-2 px-row">
        <h2 className="text-base font-bold tracking-[-0.01em] text-text-primary md:text-lg">
          Tiếp tục xem
        </h2>
      </div>

      <div className="flex gap-2 overflow-hidden px-row">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={CARD_WIDTH}>
            <div className="overflow-hidden rounded-card bg-bg-elevated">
              <div className="skeleton aspect-backdrop w-full" />
              <div className={TEXT_BLOCK} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Arrow({
  side,
  visible,
  onClick,
  label,
}: {
  side: 'left' | 'right';
  visible: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <IconButton
      label={label}
      onClick={onClick}
      disabled={!visible}
      aria-hidden={!visible}
      tabIndex={visible ? undefined : -1}
      className={cn(
        // Canh giữa DẢI ẢNH, không phải giữa cả row: khối chữ cao 3.25rem nằm dưới.
        'absolute z-20 -translate-y-1/2 transition-opacity duration-standard ease-standard',
        'top-[calc(50%-1.625rem)]',
        side === 'left' ? 'left-1' : 'right-1',
        visible ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
    >
      {side === 'left' ? <ChevronLeftIcon /> : <ChevronRightIcon />}
    </IconButton>
  );
}
