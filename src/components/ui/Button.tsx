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
  /** Nút Play chính — nền trắng, chữ tối, đúng ngữ pháp thị giác của hero */
  primary: 'bg-text-primary text-bg-base hover:bg-text-primary/80',
  secondary: 'bg-bg-hover/80 text-text-primary backdrop-blur-sm hover:bg-bg-hover',
  ghost: 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
  accent: 'bg-accent text-[color:var(--accent-contrast)] hover:bg-accent-hover',
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
type LinkProps = CommonProps & { href: string; prefetch?: boolean };

export function Button(props: ButtonProps | LinkProps) {
  const { variant = 'secondary', size = 'md', className, children } = props;
  const classes = cn(base, variants[variant], sizes[size], className);

  if ('href' in props && props.href) {
    const { href, prefetch } = props;
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
        'inline-flex shrink-0 items-center justify-center rounded-pill',
        'bg-bg-base/60 text-text-primary ring-1 ring-white/25 backdrop-blur-sm',
        'transition-[background-color,transform,box-shadow] duration-micro ease-standard',
        'hover:bg-bg-hover hover:ring-white/60 active:scale-95',
        active && 'bg-accent text-[color:var(--accent-contrast)] ring-accent',
        dimensions,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
