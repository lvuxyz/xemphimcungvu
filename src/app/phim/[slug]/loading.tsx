/** §12.2 — skeleton giữ đúng khung trang chi tiết trong lúc 4 endpoint §11.3 về. */
export default function MovieDetailLoading() {
  return (
    <main className="mx-auto max-w-5xl pb-16 pt-16">
      <div className="overflow-hidden rounded-modal bg-bg-elevated shadow-elev-2">
        <div className="skeleton aspect-backdrop w-full" />

        <div className="grid gap-8 p-6 md:grid-cols-[1fr_16rem] md:p-8">
          <div className="min-w-0 space-y-4">
            <div className="skeleton h-4 w-1/2 rounded-card" />
            <div className="skeleton h-3 w-full rounded-card" />
            <div className="skeleton h-3 w-11/12 rounded-card" />
            <div className="skeleton h-3 w-3/4 rounded-card" />
            <div className="flex gap-3 pt-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton h-20 w-20 rounded-pill" />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-3 w-full rounded-card" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
