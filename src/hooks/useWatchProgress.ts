'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PLAYER } from '@/lib/constants';
import {
  clearWatchProgress,
  getWatchProgress,
  markCompleted,
  setWatchProgress,
  type WatchProgress,
  type WatchSnapshot,
} from '@/lib/storage';

/**
 * §10.5 — lưu và khôi phục tiến độ xem.
 *
 *   · ghi mỗi 5 giây khi đang phát
 *   · quay lại → hiện prompt "Tiếp tục xem từ 12:34" / "Xem từ đầu"
 *   · xem đủ 95% → xoá key, đánh dấu đã xem
 */
export function useWatchProgress(
  slug: string,
  ep: string,
  videoRef: React.RefObject<HTMLVideoElement>,
  options?: {
    /**
     * URL có `?t=` — người dùng đã nói rõ muốn bắt đầu từ đâu, nên đừng hỏi lại.
     * Hiện prompt "Tiếp tục xem từ 12:34?" đè lên một mốc vừa được chia sẻ là
     * hỏi một câu đã có câu trả lời, và bấm nhầm "Xem từ đầu" là mất luôn mốc đó.
     */
    skipResumePrompt?: boolean;
    /**
     * Ảnh chụp phim đang xem, ghi kèm tiến độ để chỗ khác vẽ được card "đang xem"
     * mà không gọi API. Chỉ trang phát có dữ liệu này; bỏ trống thì tiến độ vẫn
     * ghi như thường và entry giữ snapshot đã lưu trước đó.
     */
    snapshot?: WatchSnapshot;
  },
) {
  const [saved, setSaved] = useState<WatchProgress | null>(null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const lastWriteRef = useRef(0);

  const skipResumePrompt = options?.skipResumePrompt ?? false;

  /**
   * Qua ref chứ không qua deps: snapshot là dữ liệu ĐI KÈM lượt ghi, không phải
   * thứ quyết định khi nào ghi. Đưa nó vào deps của `persist` thì mọi listener
   * `pagehide`/`visibilitychange` bị tháo ra gắn lại mỗi lần nơi gọi dựng lại
   * object — mà nơi gọi không có lý do gì phải biết chuyện đó.
   */
  const snapshotRef = useRef(options?.snapshot);
  snapshotRef.current = options?.snapshot;

  // Đọc tiến độ đã lưu một lần khi đổi tập.
  useEffect(() => {
    if (!slug || !ep) return;
    const progress = getWatchProgress(slug, ep);
    setSaved(progress);
    setShowResumePrompt(
      !skipResumePrompt && progress !== null && progress.position > PLAYER.resumeMinPosition,
    );
  }, [slug, ep, skipResumePrompt]);

  /**
   * Tập này đã được đánh dấu xem xong trong lượt xem hiện tại chưa.
   *
   * `persist` chạy mỗi 5 giây, và một khi đã qua mốc 95% thì mọi lượt sau đó cũng
   * qua — thiếu chốt này là đoạn credit chạy 3 phút cộng thêm 36 lần "đã xem xong"
   * vào trọng số sở thích.
   */
  const completedRef = useRef<string | null>(null);

  useEffect(() => {
    completedRef.current = null;
  }, [slug, ep]);

  const persist = useCallback(
    (position: number, duration: number) => {
      if (!slug || !ep || !Number.isFinite(duration) || duration <= 0) return;

      if (position / duration >= PLAYER.completedThreshold) {
        if (completedRef.current !== ep) {
          completedRef.current = ep;
          markCompleted(slug, ep, snapshotRef.current);
        } else {
          /**
           * Đã đếm xong rồi, nhưng vẫn phải dọn: xem hết → tua lại giữa tập (lượt
           * `persist` sau ghi lại tiến độ) → tua qua 95% lần nữa thì không có nhánh
           * này là tập đã xem xong nằm lại trong "Tiếp tục xem" ở mốc giữa tập. Rẻ:
           * không còn tiến độ thì hàm tự dừng sau một `removeItem`.
           */
          clearWatchProgress(slug, ep);
        }
        setSaved(null);
        return;
      }
      setWatchProgress(slug, ep, position, duration, snapshotRef.current);
    },
    [slug, ep],
  );

  /** Gắn vào `onTimeUpdate` của thẻ video — tự throttle về 5s một lần ghi. */
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.paused) return;

    const now = Date.now();
    if (now - lastWriteRef.current < PLAYER.progressSaveInterval) return;
    lastWriteRef.current = now;

    persist(video.currentTime, video.duration);
  }, [persist, videoRef]);

  const resume = useCallback(() => {
    const video = videoRef.current;
    if (video && saved) video.currentTime = saved.position;
    setShowResumePrompt(false);
  }, [saved, videoRef]);

  const restart = useCallback(() => {
    const video = videoRef.current;
    if (video) video.currentTime = 0;
    // Xem lại từ đầu thì tập được phép "xem xong" một lần nữa.
    completedRef.current = null;
    clearWatchProgress(slug, ep);
    setSaved(null);
    setShowResumePrompt(false);
  }, [slug, ep, videoRef]);

  /**
   * Rời trang giữa chừng vẫn phải ghi lại vị trí.
   *
   * Trên iOS/Android, chuyển app hay khoá máy KHÔNG chắc bắn `pagehide` —
   * `visibilitychange` là sự kiện duy nhất gần như luôn tới. Nghe cả hai.
   */
  useEffect(() => {
    const flush = () => {
      const video = videoRef.current;
      if (video) persist(video.currentTime, video.duration);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };

    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      flush();
    };
  }, [persist, videoRef]);

  return {
    saved,
    showResumePrompt,
    handleTimeUpdate,
    resume,
    restart,
    dismissPrompt: () => setShowResumePrompt(false),
  };
}
