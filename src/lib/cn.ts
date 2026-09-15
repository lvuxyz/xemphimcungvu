import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Ghép className, class Tailwind sau đè lên class trước. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
