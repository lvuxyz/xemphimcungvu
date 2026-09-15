import { QueryClient, isServer, keepPreviousData } from '@tanstack/react-query';
import { CACHE } from './constants';
import { ApiError } from './api';

/**
 * Mặc định chung cho TanStack Query (§11.1, §14.2).
 * staleTime cụ thể theo loại dữ liệu được đặt tại từng `useQuery`.
 */
function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: CACHE.list.staleTime,
        gcTime: CACHE.list.gcTime,

        // §14.2 — không retry 404, tối đa 2 lần, backoff mũ trần 8s.
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.isNotFound) return false;
          return failureCount < 2;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 8000),

        // §14.1 — mất mạng thì giữ nguyên dữ liệu đã cache, không nháy lại.
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        placeholderData: keepPreviousData,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/** Server: client mới mỗi request. Browser: singleton, tránh mất cache khi re-render. */
export function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
