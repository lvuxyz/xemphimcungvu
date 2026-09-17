'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { usePresence } from '@/hooks/usePresence';
import { ChevronDownIcon } from './icons';

export interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  label: string;
  value?: string;
  options: DropdownOption[];
  onChange: (value: string | undefined) => void;
  /** Nhãn cho lựa chọn "bỏ lọc". Không truyền thì không có mục này. */
  allLabel?: string;
  className?: string;
}

/**
 * §13.1 — dropdown điều hướng bằng ↑/↓, Enter chọn, ESC đóng.
 * Dùng cho FilterBar (§8.7) và menu chất lượng / tốc độ của player (§10.3).
 */
export function Dropdown({ label, value, options, onChange, allLabel, className }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  /** Bung ra / thu lại trong 150ms thay vì hiện tắt tức thì. */
  const { mounted, visible } = usePresence(open, 150);

  const items: DropdownOption[] = allLabel ? [{ value: '', label: allLabel }, ...options] : options;

  const selected = items.find((o) => o.value === (value ?? ''));

  // Click ra ngoài thì đóng.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const commit = (option: DropdownOption) => {
    onChange(option.value === '' ? undefined : option.value);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!open && (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(
        Math.max(
          0,
          items.findIndex((o) => o.value === (value ?? '')),
        ),
      );
      return;
    }
    if (!open) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % items.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + items.length) % items.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = items[activeIndex];
      if (option) commit(option);
    }
  };

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className={cn(
          'flex h-9 min-w-[9rem] items-center justify-between gap-3 rounded-card px-3 text-sm',
          'bg-bg-elevated text-text-secondary ring-1 ring-white/10',
          'transition-colors duration-micro ease-standard hover:text-text-primary hover:ring-white/25',
          selected && value !== undefined && 'text-text-primary ring-accent/50',
        )}
      >
        <span className="truncate">
          <span className="text-text-muted">{label}: </span>
          {selected?.label ?? allLabel ?? '—'}
        </span>
        <ChevronDownIcon
          className={cn(
            'shrink-0 transition-transform duration-micro ease-standard',
            open && 'rotate-180',
          )}
        />
      </button>

      {mounted && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          data-motion="fade"
          className={cn(
            'absolute left-0 top-full z-navbar mt-1 max-h-72 w-full min-w-[12rem] overflow-y-auto rounded-card bg-bg-elevated py-1 shadow-elev-2 ring-1 ring-white/10',
            'transition-[opacity,transform] duration-micro ease-standard',
            visible ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-1 opacity-0',
          )}
        >
          {items.map((option, index) => {
            const isSelected = option.value === (value ?? '');
            return (
              <li key={option.value || '__all__'}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => commit(option)}
                  className={cn(
                    'block w-full px-3 py-2 text-left text-sm transition-colors duration-micro ease-standard',
                    isSelected ? 'text-accent-hover' : 'text-text-secondary',
                    index === activeIndex && 'bg-bg-hover text-text-primary',
                  )}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
