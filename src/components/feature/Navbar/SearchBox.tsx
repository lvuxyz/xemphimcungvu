'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SmartImage } from '@/components/ui/SmartImage';
import { cn } from '@/lib/cn';
import { BLUR_DATA_URL } from '@/lib/image';
import { matchesSearch, searchKey } from '@/lib/text';
import type { SearchIndexItem } from '@/mocks';
import { CloseIcon, SearchIcon } from '@/components/ui/icons';

/**
 * §8.1 — ô tìm kiếm.
 *
 *   click icon → input expand 0 → 280px
 *   debounce 350ms → truy vấn, tối đa 8 kết quả
 *   ESC hoặc blur → thu lại
 *   Enter → điều hướng /tim-kiem?keyword=
 *
 * Giai đoạn dựng giao diện: kết quả lấy từ mock tĩnh, chưa gọi API.
 */
export function SearchBox({ index }: { index: SearchIndexItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<SearchIndexItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // §8.1 — debounce 350ms
  useEffect(() => {
    const term = keyword.trim();
    if (term === '') {
      setResults([]);
      return;
    }

    const timer = setTimeout(() => {
      // Bỏ dấu hai phía: "thien" phải ra "Thiên" (§8.1).
      const needle = searchKey(term);
      setResults(
        index
          .filter((m) => matchesSearch(m.name, needle) || matchesSearch(m.originName, needle))
          .slice(0, 8),
      );
    }, 350);
    return () => clearTimeout(timer);
  }, [keyword, index]);

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

  const submit = () => {
    const term = keyword.trim();
    if (!term) return;
    setOpen(false);
    router.push(`/tim-kiem?keyword=${encodeURIComponent(term)}`);
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

      {open && keyword.trim() !== '' && (
        <div
          className="absolute right-0 top-full mt-2 w-[320px] overflow-hidden rounded-card bg-bg-elevated/98 shadow-elev-2 ring-1 ring-white/10 backdrop-blur-md"
          role="listbox"
          aria-label="Kết quả tìm kiếm"
        >
          {results.length === 0 ? (
            <p className="px-3 py-4 text-sm text-text-muted">Không tìm thấy phim phù hợp.</p>
          ) : (
            <ul>
              {results.map((movie) => (
                <li key={movie.slug}>
                  <Link
                    href={`/phim/${movie.slug}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 transition-colors duration-micro ease-standard hover:bg-bg-hover"
                  >
                    {/* §8.1 — poster thumbnail 40×60 */}
                    <div className="relative h-[60px] w-10 shrink-0 overflow-hidden rounded-[3px] bg-bg-hover">
                      <SmartImage
                        src={movie.poster}
                        alt=""
                        fill
                        sizes="40px"
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
