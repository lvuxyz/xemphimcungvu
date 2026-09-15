import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

type ChipVariant = 'default' | 'outline' | 'accent' | 'success';

const variants: Record<ChipVariant, string> = {
  default: 'bg-bg-hover text-text-secondary',
  outline: 'text-text-secondary ring-1 ring-white/20',
  accent: 'bg-[color:var(--accent-soft)] text-accent-hover ring-1 ring-accent/40',
  success: 'text-success ring-1 ring-success/40',
};

interface ChipProps {
  variant?: ChipVariant;
  href?: string;
  className?: string;
  children: ReactNode;
}

/** Badge / tag / keyword chip (§8.4, §8.5). radius 999 theo §7.3. */
export function Chip({ variant = 'default', href, className, children }: ChipProps) {
  const classes = cn(
    'inline-flex items-center rounded-pill px-2.5 py-1 text-[11px] font-medium leading-none tracking-[0.01em]',
    variants[variant],
    href && 'transition-colors duration-micro ease-standard hover:text-text-primary',
    className,
  );

  return href ? (
    <Link href={href} className={classes}>
      {children}
    </Link>
  ) : (
    <span className={classes}>{children}</span>
  );
}

/** Badge "% phù hợp" — chỉ render khi matchScore() KHÁC null (§5.3, §8.4). */
export function MatchScore({ score, className }: { score: number | null; className?: string }) {
  if (score === null) return null;

  return (
    <span className={cn('text-xs font-bold text-success', className)}>{score}% phù hợp</span>
  );
}
