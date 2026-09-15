'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type HlsType from 'hls.js';
import type { ErrorData, Level } from 'hls.js';
import { hlsConfigFor, maxHeightForTier } from '@/lib/hls-config';
import { getPlayerSettings, savePlayerSettings } from '@/lib/storage';
import { useDevice } from './useDevice';

/**
 * §10.1–10.2 — vòng đời hls.js và luồng fallback.
 *
 *   1. Khởi tạo hls.js với cấu hình theo chất lượng mạng (lib/hls-config.ts)
 *   2. Hls.isSupported() === false → thử native HLS (Safari/iOS)
 *   3. Lỗi mạng → tự cứu có giới hạn, backoff tăng dần
 *   4. Hết đường cứu → <iframe src={linkEmbed}>
 *   5. Iframe cũng fail → UI hiện nút "Thử server khác"
 *
 * hls.js được import động để không nằm trong bundle initial (§12.2 code-split).
 */

export type PlaybackSource = 'hls' | 'native' | 'embed' | 'failed';

export interface HlsQualityLevel {
  index: number;
  height: number;
  bitrate: number;
  label: string;
}

/**
 * Số lần tự cứu lỗi mạng trước khi chuyển nguồn.
 *
 * Bản cũ gọi `hls.startLoad()` mà không đếm: mạng chết hẳn thì vòng này lặp mãi,
 * người xem nhìn khung đen vô hạn và không bao giờ được chuyển sang embed.
 */
const MAX_NETWORK_RECOVERIES = 4;
const MAX_MEDIA_RECOVERIES = 2;

interface UseHlsOptions {
  linkM3u8: string;
  linkEmbed: string;
  /** Gọi khi phải rơi xuống nguồn dự phòng — UI hiện toast 1 dòng (§10.2). */
  onFallback?: (source: PlaybackSource) => void;
  autoPlay?: boolean;
}

export function useHls({ linkM3u8, linkEmbed, onFallback, autoPlay = false }: UseHlsOptions) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<HlsType | null>(null);

  const { tier, network } = useDevice();
  const tierRef = useRef(tier);
  tierRef.current = tier;

  const [source, setSource] = useState<PlaybackSource>('hls');
  const [levels, setLevels] = useState<HlsQualityLevel[]>([]);
  /** -1 = tự động */
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [autoLevel, setAutoLevel] = useState(true);
  const [isReady, setIsReady] = useState(false);
  /** Đang chờ dữ liệu: hiện vòng xoay. KHÔNG phải trạng thái lỗi. */
  const [stalled, setStalled] = useState(false);
  /** Đang tự cứu sau lỗi mạng — nói rõ để người dùng đừng bấm loạn. */
  const [recovering, setRecovering] = useState(false);
  /** Tăng mỗi lần bấm "Thử lại" để effect gắn lại player từ đầu. */
  const [attempt, setAttempt] = useState(0);

  const fallbackRef = useRef(onFallback);
  fallbackRef.current = onFallback;

  const degradeTo = useCallback((next: PlaybackSource) => {
    setSource((prev) => {
      if (prev === next) return prev;
      fallbackRef.current?.(next);
      return next;
    });
  }, []);

  /* ------------------------- gắn player ------------------------- */

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !linkM3u8 || source === 'embed' || source === 'failed') return;

    let disposed = false;
    let networkRecoveries = 0;
    let mediaRecoveries = 0;
    let recoverTimer: ReturnType<typeof setTimeout> | null = null;

    setIsReady(false);
    setLevels([]);
    setCurrentLevel(-1);
    setStalled(false);
    setRecovering(false);

    const attach = async () => {
      const { default: Hls } = await import('hls.js');
      if (disposed) return;

      // Safari/iOS phát HLS thẳng, không cần MSE — nhẹ pin hơn hẳn.
      if (!Hls.isSupported()) {
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
          // `source` nằm trong deps nên effect chạy lại ngay sau setSource('native').
          // Gán lại `src` lúc đó sẽ ĐÁ video về 0 giây — trên iOS là thấy rõ.
          if (video.src !== linkM3u8) video.src = linkM3u8;
          setSource('native');
          setIsReady(true);
          if (autoPlay) void video.play().catch(() => undefined);
        } else {
          degradeTo(linkEmbed ? 'embed' : 'failed');
        }
        return;
      }

      const hls = new Hls(hlsConfigFor(tierRef.current));
      hlsRef.current = hls;

      /** Trần chất lượng: ưu tiên lựa chọn đã lưu, không có thì theo mạng. */
      const applyCapping = (parsed: HlsQualityLevel[]) => {
        const preferred = getPlayerSettings().qualityHeight;

        if (preferred > 0) {
          const match = parsed.filter((l) => l.height > 0 && l.height <= preferred).pop();
          if (match) {
            hls.currentLevel = match.index;
            setCurrentLevel(match.index);
            setAutoLevel(false);
            return;
          }
        }

        const ceiling = maxHeightForTier(tierRef.current);
        const capped = parsed.filter((l) => l.height > 0 && l.height <= ceiling).pop();
        // Không level nào đủ thấp → thà xem chất lượng cao còn hơn không xem được.
        hls.autoLevelCapping = capped ? capped.index : -1;
        setAutoLevel(true);
      };

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        if (disposed) return;

        const parsed = (data.levels as Level[]).map((level, index) => ({
          index,
          height: level.height ?? 0,
          bitrate: level.bitrate ?? 0,
          label: level.height
            ? `${level.height}p`
            : `${Math.round((level.bitrate ?? 0) / 1000)}kbps`,
        }));

        setLevels(parsed);
        applyCapping(parsed);
        setIsReady(true);
        if (autoPlay) void video.play().catch(() => undefined);
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        if (disposed) return;
        setAutoLevel(hls.autoLevelEnabled);
        setCurrentLevel(data.level);
      });

      // Fragment về được = mạng đã sống lại; xoá bộ đếm cứu hộ.
      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        if (disposed) return;
        networkRecoveries = 0;
        mediaRecoveries = 0;
        setRecovering(false);
        setStalled(false);
      });

      const scheduleRecover = (run: () => void) => {
        setRecovering(true);
        // Backoff 0.5s → 1s → 2s → 4s: mạng 3G chập chờn cần thời gian thở.
        const delay = Math.min(500 * 2 ** networkRecoveries, 8_000);
        recoverTimer = setTimeout(() => {
          if (!disposed) run();
        }, delay);
      };

      hls.on(Hls.Events.ERROR, (_event, data: ErrorData) => {
        if (disposed) return;

        // Lỗi không fatal hls tự xử lý; chỉ phản ánh ra UI khi video đứng hình.
        if (!data.fatal) {
          if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) setStalled(true);
          return;
        }

        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            if (networkRecoveries < MAX_NETWORK_RECOVERIES) {
              networkRecoveries += 1;
              scheduleRecover(() => hls.startLoad());
              return;
            }
            break;

          case Hls.ErrorTypes.MEDIA_ERROR:
            if (mediaRecoveries < MAX_MEDIA_RECOVERIES) {
              mediaRecoveries += 1;
              setRecovering(true);
              // Lần 2 đổi codec audio — lỗi kinh điển của nguồn remux.
              if (mediaRecoveries === 2) hls.swapAudioCodec();
              hls.recoverMediaError();
              return;
            }
            break;
        }

        hls.destroy();
        hlsRef.current = null;
        setRecovering(false);
        degradeTo(linkEmbed ? 'embed' : 'failed');
      });

      hls.loadSource(linkM3u8);
      hls.attachMedia(video);
    };

    void attach();

    return () => {
      disposed = true;
      if (recoverTimer) clearTimeout(recoverTimer);
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
    // `tier` cố ý KHÔNG nằm trong deps: đổi mạng giữa chừng mà dựng lại player thì
    // người xem mất vị trí đang phát. Việc đó do effect capping bên dưới lo.
  }, [linkM3u8, linkEmbed, autoPlay, degradeTo, source, attempt]);

  /* -------------------- mạng đổi giữa chừng -------------------- */

  useEffect(() => {
    const hls = hlsRef.current;
    if (!hls || !autoLevel || levels.length === 0) return;

    const ceiling = maxHeightForTier(tier);
    const capped = levels.filter((l) => l.height > 0 && l.height <= ceiling).pop();
    hls.autoLevelCapping = capped ? capped.index : -1;
  }, [tier, autoLevel, levels]);

  /* -------------------- trạng thái chờ dữ liệu -------------------- */

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onWaiting = () => setStalled(true);
    const onResume = () => setStalled(false);

    video.addEventListener('waiting', onWaiting);
    video.addEventListener('stalled', onWaiting);
    video.addEventListener('playing', onResume);
    video.addEventListener('canplay', onResume);
    video.addEventListener('seeked', onResume);

    return () => {
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('stalled', onWaiting);
      video.removeEventListener('playing', onResume);
      video.removeEventListener('canplay', onResume);
      video.removeEventListener('seeked', onResume);
    };
  }, [source]);

  /** Mạng về lại sau khi mất → nạp tiếp, không bắt người dùng F5. */
  useEffect(() => {
    if (!network.online) return;
    hlsRef.current?.startLoad();
  }, [network.online]);

  /**
   * `index = -1` → bật lại chế độ tự động (§10.3).
   * Lựa chọn được ghi nhớ cho các tập sau.
   */
  const selectLevel = useCallback(
    (index: number) => {
      const hls = hlsRef.current;
      if (!hls) return;

      hls.currentLevel = index;
      setCurrentLevel(index);
      setAutoLevel(index === -1);
      savePlayerSettings({
        qualityHeight: index === -1 ? 0 : (levels.find((l) => l.index === index)?.height ?? 0),
      });
    },
    [levels],
  );

  /** Người dùng bấm "Thử lại" → dựng lại từ nhánh hls.js. */
  const retry = useCallback(() => {
    setSource('hls');
    setAttempt((n) => n + 1);
  }, []);

  return {
    videoRef,
    source,
    levels,
    currentLevel,
    autoLevel,
    isReady,
    stalled,
    recovering,
    selectLevel,
    retry,
    embedUrl: linkEmbed,
  };
}
