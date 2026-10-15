'use client';

import { SmartImage } from '@/components/ui/SmartImage';
import { IMAGE_SIZES } from '@/lib/image';
import type { Person } from '@/types/movie';

/**
 * §8.6 — hàng diễn viên.
 *
 *   avatar tròn 80px, lazy load
 *   tên + vai diễn, 2 dòng, ellipsis
 *   không có ảnh → hiện initials trên nền `raised` (nổi một bậc so với mặt chứa)
 */
export function CastRow({ people }: { people: Person[] }) {
  // §14.1 — /peoples fail thì ẩn hẳn, không hiện lỗi.
  if (people.length === 0) return null;

  return (
    <section aria-labelledby="cast-heading">
      <h3 id="cast-heading" className="mb-3 text-sm font-bold text-text-primary">
        Diễn viên &amp; ê-kíp
      </h3>

      <ul className="scroll-x gap-4 pb-2" role="list">
        {people.map((person) => (
          <li key={`${person.id}-${person.character ?? person.job ?? ''}`} className="row-item w-20">
            <div className="relative mx-auto h-20 w-20 overflow-hidden rounded-pill bg-raised">
              {person.profile ? (
                <SmartImage
                  src={person.profile}
                  alt={person.name}
                  fill
                  sizes={IMAGE_SIZES.castAvatar}
                  loading="lazy"
                  className="object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-lg font-bold text-text-muted">
                  {initials(person.name)}
                </span>
              )}
            </div>

            <p className="mt-2 line-clamp-2 text-center text-[11px] leading-tight text-text-primary">
              {person.name}
            </p>
            {(person.character || person.job) && (
              <p className="line-clamp-2 text-center text-[10px] leading-tight text-text-muted">
                {person.character || person.job}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
