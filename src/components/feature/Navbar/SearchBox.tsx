'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { SmartImage } from '@/components/ui/SmartImage';
import { cn } from '@/lib/cn';
import { CACHE, SEARCH_DEBOUNCE, SEARCH_MIN_LENGTH, SEARCH_SUGGESTIONS } from '@/lib/constants';
import { search } from '@/lib/endpoints';
import { BLUR_DATA_URL, IMAGE_SIZES } from '@/lib/image';
import { queryKeys } from '@/lib/query-keys';
import { PATH, routes } from '@/lib/routes';
import { useLeavesPlayer } from '@/hooks/useLeavesPlayer';
import { usePresence } from '@/hooks/usePresence';
import { CloseIcon, SearchIcon } from '@/components/ui/icons';
import { useReportListPending } from '@/components/feature/FilterBar/list-pending';

/**
 * §8.1 — ô tìm kiếm.
 *
 *   click icon → input expand 0 → 280px
 *   debounce 350ms → truy vấn `/v1/api/tim-kiem`, tối đa 8 kết quả
 *   ESC hoặc blur → thu lại
 *   Enter → điều hướng /tim-kiem?keyword=
 *
 * Gợi ý lấy thẳng từ API chứ không từ chỉ mục dựng sẵn: chỉ mục đủ 30.000 phim
 * là vài MB vào bundle initial, phá ngân sách §12.1.
 */
const SEARCH_FILTERS = { limit: SEARCH_SUGGESTIONS };

export function SearchBox() {
  const router = useRouter();
  const pathname = usePathname();
  /**
   * Gõ từ khoá mới khi ĐANG ở `/tim-kiem` chỉ đổi searchParams: `loading.tsx`
   * không hiện lại và lưới cũ đứng im suốt vòng RSC. Bọc push trong transition
   * rồi báo ra store để InfiniteGrid làm mờ lưới cũ (xem `list-pending.ts`).
   * Từ route khác thì segment đổi, skeleton đã lo phần chờ.
   */
  const [isPending, startTransition] = useTransition();
  /**
   * Navbar có mặt cả trên trang phát, nên gợi ý tìm kiếm cũng là một lối đi tới
   * `/phim/{slug}` từ trong player — cùng cái bẫy modal-đè-player ở §1.4 L1.
   */
  const leavesPlayer = useLeavesPlayer();
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  /** Từ khoá đã qua debounce — chỉ giá trị này được đem đi gọi API. */
  const [term, setTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // §8.1 — debounce 350ms
  useEffect(() => {
    const trimmed = keyword.trim();
    if (trimmed === '') {
      setTerm('');
      return;
    }

    const timer = setTimeout(() => setTerm(trimmed), SEARCH_DEBOUNCE);
    return () => clearTimeout(timer);
  }, [keyword]);

  const enabled = open && term.length >= SEARCH_MIN_LENGTH;

  const { data, isFetching, isError } = useQuery({
    queryKey: queryKeys.search(term, SEARCH_FILTERS),
    queryFn: ({ signal }) => search(term, SEARCH_FILTERS, { signal }),
    enabled,
    staleTime: CACHE.search.staleTime,
    gcTime: CACHE.search.gcTime,
  });

  const results = enabled ? (data?.items ?? []) : [];
  /** Chưa có kết quả nào trong tay thì vẽ skeleton, không dùng spinner (§12.2). */
  const pending = enabled && isFetching && results.length === 0;

  const { mounted: suggestionsMounted, visible: suggestionsVisible } = usePresence(
    open && keyword.trim() !== '',
    150,
  );

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Click ra ngoài thì thu lại.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useReportListPending('search', isPending);

  const submit = () => {
    const trimmed = keyword.trim();
    if (!trimmed) return;
    setOpen(false);
    const href = routes.search(trimmed);
    if (pathname === PATH.search) startTransition(() => router.push(href));
    else router.push(href);
  };

  return (
    <div ref={rootRef} className="relative">
      <div
        className={cn(
          'flex items-center gap-2 rounded-card',
          // Chỉ animate width khi expand — đây là ngoại lệ có chủ đích so với §9.1:
          // không có cách nào mở ô input bằng transform mà không méo chữ bên trong.
          'transition-[width,background-color,box-shadow] duration-standard ease-standard',
          open
            ? 'w-[280px] bg-bg-base/90 px-3 ring-1 ring-white/25'
            : 'w-10 justify-center bg-transparent',
        )}
      >
        <button
          type="button"
          onClick={() => (open ? submit() : setOpen(true))}
          aria-label="Tìm kiếm phim"
          aria-expanded={open}
          className="flex h-10 w-6 shrink-0 items-center justify-center text-lg text-text-primary"
        >
          <SearchIcon />
        </button>

        <input
          ref={inputRef}
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') setOpen(false);
          }}
          placeholder="Tên phim, diễn viên…"
          aria-label="Từ khoá tìm kiếm"
          tabIndex={open ? 0 : -1}
          className={cn(
            'h-10 w-full min-w-0 bg-transparent text-sm text-text-primary outline-none',
            'placeholder:text-text-muted',
            !open && 'pointer-events-none opacity-0',
          )}
        />

        {open && keyword && (
          <button
            type="button"
            onClick={() => setKeyword('')}
            aria-label="Xoá từ khoá"
            className="shrink-0 text-text-muted transition-colors duration-micro ease-standard hover:text-text-primary"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {suggestionsMounted && (
        <div
          data-motion="fade"
          className={cn(
            'absolute right-0 top-full mt-2 w-[320px] overflow-hidden rounded-card bg-bg-elevated/95 shadow-elev-2 ring-1 ring-white/10 backdrop-blur-md',
            // Ô input mở ra trong 300ms; bảng gợi ý bám theo cùng nhịp thay vì
            // đập vào giữa chừng.
            'transition-[opacity,transform] duration-micro ease-standard',
            suggestionsVisible
              ? 'translate-y-0 opacity-100'
              : 'pointer-events-none -translate-y-1 opacity-0',
          )}
          role="listbox"
          aria-label="Kết quả tìm kiếm"
        >
          {keyword.trim().length < SEARCH_MIN_LENGTH ? (
            <p className="px-3 py-4 text-sm text-text-muted">
              Nhập ít nhất {SEARCH_MIN_LENGTH} ký tự.
            </p>
          ) : pending ? (
            <ul aria-hidden="true">
              {Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="flex items-center gap-3 px-3 py-2">
                  <div className="skeleton h-[60px] w-10 shrink-0 rounded-[3px]" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="skeleton h-3 w-3/4 rounded-[3px]" />
                    <div className="skeleton h-2.5 w-1/3 rounded-[3px]" />
                  </div>
                </li>
              ))}
            </ul>
          ) : isError ? (
            <p className="px-3 py-4 text-sm text-text-muted">
              Không kết nối được máy chủ tìm kiếm.
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-4 text-sm text-text-muted">Không tìm thấy phim phù hợp.</p>
          ) : (
            <ul>
              {results.map((movie) => (
                <li key={movie.slug}>
                  <Link
                    href={routes.detail(movie.slug)}
                    prefetch={leavesPlayer ? false : undefined}
                    onClick={(event) => {
                      setOpen(false);
                      if (!leavesPlayer) return;
                      // Rời trình phát thì phải đi cứng, không qua router.
                      event.preventDefault();
                      window.location.assign(routes.detail(movie.slug));
                    }}
                    className="flex items-center gap-3 px-3 py-2 transition-colors duration-micro ease-standard hover:bg-bg-hover"
                  >
                    {/* §8.1 — poster thumbnail 40×60 */}
                    <div className="relative h-[60px] w-10 shrink-0 overflow-hidden rounded-[3px] bg-bg-hover">
                      <SmartImage
                        src={movie.poster}
                        alt=""
                        fill
                        sizes={IMAGE_SIZES.searchThumb}
                        placeholder="blur"
                        blurDataURL={BLUR_DATA_URL}
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm text-text-primary">{movie.name}</p>
                      <p className="truncate text-xs text-text-muted">
                        {[movie.year > 0 ? movie.year : null, movie.quality]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
