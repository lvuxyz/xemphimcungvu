/** §12.2 — skeleton giữ layout ổn định. Không dùng spinner. */
export default function Loading() {
  return (
    <div className="px-row py-16">
      <div className="skeleton h-[56vh] w-full rounded-modal" />
      <div className="mt-8 space-y-6">
        {Array.from({ length: 3 }).map((_, row) => (
          <div key={row} className="flex gap-2">
            {Array.from({ length: 6 }).map((__, card) => (
              <div key={card} className="skeleton aspect-backdrop w-1/6 rounded-card" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
