/**
 * HTTP client cho KKPhim API — timeout, retry, error phân loại (§3, §14.2, §14.3).
 *
 * Client này trả về JSON thô. Việc chuẩn hoá thuộc về `lib/normalize.ts`;
 * chỉ `lib/endpoints.ts` được gọi `request()` trực tiếp.
 */

import { API_BASE_URL } from './constants';

export class ApiError extends Error {
  readonly status: number;
  readonly url: string;

  constructor(message: string, status: number, url: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.url = url;
  }

  /** 404 không bao giờ retry (§14.2). */
  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isTimeout(): boolean {
    return this.status === 408;
  }

  get isNetwork(): boolean {
    return this.status === 0;
  }
}

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

export interface RequestOptions {
  params?: QueryParams;
  /** ms — mặc định 8s (§14.3) */
  timeout?: number;
  /** Số lần thử lại, không tính lần đầu. Mặc định 2 (§14.2). */
  retries?: number;
  /** Giây — `next.revalidate` cho fetch phía RSC (§11). */
  revalidate?: number;
  signal?: AbortSignal;
}

export function buildUrl(path: string, params?: QueryParams): string {
  const url = new URL(path.startsWith('http') ? path : `${API_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/** §14.2 — backoff mũ, trần 8s. */
const retryDelay = (attempt: number): number => Math.min(1000 * 2 ** attempt, 8000);

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Ghép AbortSignal của caller với signal timeout nội bộ. */
function linkSignals(timeout: number, external?: AbortSignal): [AbortSignal, () => void] {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('timeout', 'TimeoutError')), timeout);

  const onAbort = () => controller.abort(external?.reason);
  if (external) {
    if (external.aborted) onAbort();
    else external.addEventListener('abort', onAbort, { once: true });
  }

  return [
    controller.signal,
    () => {
      clearTimeout(timer);
      external?.removeEventListener('abort', onAbort);
    },
  ];
}

async function attempt<T>(url: string, options: RequestOptions): Promise<T> {
  const { timeout = 8000, revalidate, signal: external } = options;
  const [signal, cleanup] = linkSignals(timeout, external);

  try {
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal,
      ...(revalidate === undefined ? {} : { next: { revalidate } }),
    });

    if (!res.ok) {
      throw new ApiError(`HTTP ${res.status} ${res.statusText}`, res.status, url);
    }

    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError(`Quá thời gian chờ ${timeout}ms`, 408, url);
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error; // caller chủ động huỷ — không bọc lại, không retry
    }

    throw new ApiError(error instanceof Error ? error.message : 'Lỗi mạng', 0, url);
  } finally {
    cleanup();
  }
}

/**
 * Gọi API với retry. Trả về JSON thô (`unknown`) — bắt buộc đi qua adapter
 * trước khi tới component (§2.2 nguyên tắc 1).
 */
export async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { retries = 2, params } = options;
  const url = buildUrl(path, params);

  let lastError: unknown;

  for (let i = 0; i <= retries; i++) {
    try {
      return await attempt<T>(url, options);
    } catch (error) {
      lastError = error;

      // Caller huỷ, hoặc 404 → dừng ngay (§14.2).
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      if (error instanceof ApiError && error.isNotFound) throw error;

      if (i < retries) await sleep(retryDelay(i));
    }
  }

  throw lastError;
}

/**
 * Bọc một lời gọi bổ trợ (images / peoples / keywords): fail thì trả fallback,
 * KHÔNG ném lỗi lên UI (§14.1 — phần bổ trợ fail thì ẩn im lặng).
 */
export async function requestOptional<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}
