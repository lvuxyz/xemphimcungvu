import type { ReactNode } from 'react';

interface RoutePlaceholderProps {
  /** Tên route theo §6 */
  title: string;
  /** Mục trong tài liệu kỹ thuật mô tả màn này */
  spec: string;
  /** Những gì sẽ dựng ở đây */
  todo: string[];
  /** Tham số route/searchParams đã parse — để kiểm tra khung định tuyến chạy đúng */
  params?: Record<string, unknown>;
  children?: ReactNode;
}

/**
 * Khung tạm cho từng route trong giai đoạn dựng nền.
 * Thay bằng UI thật theo lộ trình §16 — xoá import này khi route đã hoàn thiện.
 */
export function RoutePlaceholder({ title, spec, todo, params, children }: RoutePlaceholderProps) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-xs uppercase tracking-widest text-accent">{spec}</p>
      <h1 className="mt-2 text-3xl font-extrabold text-text-primary">{title}</h1>

      {params && Object.keys(params).length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-text-secondary">Tham số route</h2>
          <pre className="mt-2 overflow-x-auto rounded-modal bg-bg-elevated p-4 text-xs text-text-secondary">
            {JSON.stringify(params, null, 2)}
          </pre>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-text-secondary">Sẽ dựng ở đây</h2>
        <ul className="mt-2 space-y-1 text-sm text-text-muted">
          {todo.map((item) => (
            <li key={item}>· {item}</li>
          ))}
        </ul>
      </section>

      {children}
    </main>
  );
}
