import type { ButtonHTMLAttributes, ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'accent';
type Size = 'sm' | 'md' | 'lg';

/** §9.2 — micro 150ms cho hover nút; chỉ animate màu và transform. */
const base =
  'inline-flex items-center justify-center gap-2 rounded-pill font-medium whitespace-nowrap ' +
  'transition-[background-color,color,transform] duration-micro ease-standard ' +
  'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40';

const variants: Record<Variant, string> = {
  /** Nút Play chính — sáng rực rỡ, gradient ngọc trai, shadow phát quang nhẹ, hover nổi */
  primary:
    'bg-gradient-to-b from-white via-white/95 to-neutral-200 text-bg-base font-bold ' +
    'shadow-[0_4px_20px_-2px_rgba(255,255,255,0.35),0_2px_8px_rgba(0,0,0,0.5)] ' +
    'hover:from-white hover:to-white hover:shadow-[0_6px_28px_rgba(255,255,255,0.6)] ' +
    'hover:scale-[1.03]',
  /** Nút phụ / Thông tin — frosted glassmorphism kính mờ cao cấp với viền ánh sáng */
  secondary:
    'bg-white/10 text-text-primary backdrop-blur-md border border-white/20 ' +
    'shadow-[0_4px_16px_rgba(0,0,0,0.35)] ' +
    'hover:bg-white/20 hover:border-white/40 hover:shadow-[0_6px_24px_rgba(255,255,255,0.15)] ' +
    'hover:scale-[1.03]',
  ghost: 'text-text-secondary hover:bg-white/10 hover:text-text-primary hover:scale-[1.02]',
  accent:
    'bg-gradient-to-r from-accent via-accent to-accent-hover text-[color:var(--accent-contrast)] font-bold ' +
    'shadow-[0_4px_20px_rgba(145,132,217,0.35)] ' +
    'hover:shadow-[0_6px_28px_rgba(145,132,217,0.55)] hover:scale-[1.03]',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-5 text-sm',
  lg: 'h-12 px-7 text-base',
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children?: ReactNode;
}

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type LinkProps = CommonProps & {
  href: string;
  prefetch?: boolean;
  /**
   * Đi bằng `<a>` thường thay vì `<Link>` — điều hướng CỨNG, không qua router.
   *
   * Cần cho những link rời trình phát: điều hướng mềm từ `/xem` sang
   * `/phim/{slug}` khớp intercepting route và mở modal đè lên player đang chạy
   * (xem `hooks/useLeavesPlayer.ts`). Trước đây chỗ đó phải chép tay lại toàn
   * bộ class của `Button` vào một thẻ `<a>` — chép thiếu `gap-2`,
   * `whitespace-nowrap` và `active:scale-[0.97]`, rồi sẽ trôi xa dần mỗi lần
   * `Button` đổi.
   */
  hard?: boolean;
};

export function Button(props: ButtonProps | LinkProps) {
  const { variant = 'secondary', size = 'md', className, children } = props;
  const classes = cn(base, variants[variant], sizes[size], className);

  if ('href' in props && props.href) {
    const { href, prefetch, hard } = props;

    if (hard) {
      return (
        <a href={href} className={classes}>
          {children}
        </a>
      );
    }

    return (
      <Link href={href} prefetch={prefetch} className={classes}>
        {children}
      </Link>
    );
  }

  const { variant: _v, size: _s, className: _c, children: _ch, ...rest } = props as ButtonProps;
  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Bắt buộc — icon button không có text nên phải có nhãn cho screen reader (§13.3) */
  label: string;
  size?: Size;
  active?: boolean;
  children: ReactNode;
}

/** Nút tròn dùng trong HoverPreview và control layer của player (§8.4, §10.3). */
export function IconButton({
  label,
  size = 'md',
  active = false,
  className,
  children,
  ...rest
}: IconButtonProps) {
  const dimensions = size === 'sm' ? 'h-8 w-8 text-sm' : size === 'lg' ? 'h-12 w-12 text-xl' : 'h-10 w-10 text-base';

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        'bg-white/10 text-text-primary border border-white/15 backdrop-blur-md shadow-md',
        'transition-all duration-micro ease-standard',
        'hover:bg-white/25 hover:border-white/35 hover:scale-105 hover:shadow-lg active:scale-95',
        active && 'bg-accent/30 text-accent-hover border-accent/60 shadow-[0_0_16px_rgba(145,132,217,0.5)]',
        dimensions,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
