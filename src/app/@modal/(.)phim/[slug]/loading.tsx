/**
 * §11.3 — modal hiện NGAY khi click, phần dữ liệu đổ vào sau.
 * §12.2 — skeleton giữ layout, không dùng spinner.
 */
export default function ModalLoading() {
  return (
    <div className="fixed inset-0 z-modal overflow-y-auto bg-bg-base/70 backdrop-blur-[8px]">
      <div className="relative mx-auto my-8 w-[min(56rem,92vw)] overflow-hidden rounded-modal bg-bg-elevated shadow-elev-3">
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
    </div>
  );
}
