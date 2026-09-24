'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PLAYER } from '@/lib/constants';
import { formatTime } from '@/lib/derive';
import { getPlayerSettings, savePlayerSettings, type WatchSnapshot } from '@/lib/storage';
import { useHls, type PlaybackSource } from '@/hooks/useHls';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useWatchProgress } from '@/hooks/useWatchProgress';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useDevice } from '@/hooks/useDevice';
import { useUIStore } from '@/store/useUIStore';
import { Button } from '@/components/ui/Button';
import { PlayerControls } from './PlayerControls';

interface VideoPlayerProps {
  slug: string;
  episodeSlug: string;
  title: string;
  linkM3u8: string;
  linkEmbed: string;
  onEnded?: () => void;
  /**
   * Giây lấy từ `?t=` trên URL — mở đúng phút đã chia sẻ, và F5 giữ nguyên chỗ
   * đang xem (§2.4). Bỏ trống thì rơi về tiến độ lưu trong localStorage.
   */
  startAt?: number;
  /** Thoát trình phát — nút ← ở thanh trên (§1.4 L3). */
  onBack?: () => void;
  /** Sang tập kế. Bỏ trống ở phim lẻ / tập cuối → nút tự ẩn. */
  onNext?: () => void;
  nextLabel?: string;
  /**
   * Ghi kèm tiến độ để row "Tiếp tục xem" vẽ được card mà không gọi API.
   *
   * Trình phát không biết gì về phim ngoài slug và link, nên dữ liệu này do nơi
   * gọi dựng (`WatchScreen` — chỗ đang giữ `MovieDetailResult`) rồi gửi xuống.
   */
  watchSnapshot?: WatchSnapshot;
}

type FullscreenVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitSupportsFullscreen?: boolean;
};

type PipVideo = HTMLVideoElement & {
  requestPictureInPicture?: () => Promise<unknown>;
  disablePictureInPicture?: boolean;
};

/** Hai lần chạm trong khoảng này, gần nhau → coi là double tap. */
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP_PX = 60;

/**
 * §10 — trình phát.
 *
 * Luồng fallback (§10.2): hls.js → native HLS → iframe linkEmbed → "Thử server khác".
 * Control layer tự viết (§10.3), phím tắt (§10.4), lưu tiến độ (§10.5).
 *
 * Ba thứ khiến nó dùng được trên mọi thiết bị / mọi mạng:
 *   · cử chỉ chạm riêng cho màn cảm ứng (chạm = hiện control, chạm đôi = tua)
 *   · trạng thái chờ / tự cứu / mất mạng hiện rõ thay vì khung đen câm lặng
 *   · khi control đang ẩn thì KHÔNG setState theo `timeupdate` nữa — xem toàn
 *     màn hình trên điện thoại không còn 4 lần render mỗi giây cho vô ích
 */
export function VideoPlayer({
  slug,
  episodeSlug,
  title,
  linkM3u8,
  linkEmbed,
  onEnded,
  startAt,
  onBack,
  onNext,
  nextLabel,
  watchSnapshot,
}: VideoPlayerProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef({ time: 0, x: 0 });

  const pushToast = useUIStore((s) => s.pushToast);
  const { coarsePointer, tier, network } = useDevice();

  const onFallback = useCallback(
    (next: PlaybackSource) => {
      if (next === 'embed') {
        // §10.2 bước 3 — toast đúng MỘT dòng, không phải error state to đùng.
        pushToast('Đang dùng nguồn phát dự phòng', { variant: 'warning' });
      }
    },
    [pushToast],
  );

  const {
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
    embedUrl,
  } = useHls({ linkM3u8, linkEmbed, onFallback });

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [pip, setPip] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [seekFlash, setSeekFlash] = useState<{ dir: 1 | -1; key: number } | null>(null);

  const { saved, showResumePrompt, handleTimeUpdate, resume, restart } = useWatchProgress(
    slug,
    episodeSlug,
    videoRef,
    { skipResumePrompt: startAt !== undefined, snapshot: watchSnapshot },
  );

  /**
   * `?t=` chỉ được áp đúng MỘT lần cho mỗi tập.
   *
   * `loadedmetadata` và `durationchange` còn bắn lại khi hls.js đổi mức chất
   * lượng giữa chừng; thiếu chốt này thì mỗi lần đổi bitrate là video nhảy ngược
   * về mốc `?t=` ban đầu, và người xem không tài nào tua đi đâu được.
   */
  const startAtAppliedRef = useRef<string | null>(null);

  useEffect(() => {
    startAtAppliedRef.current = null;
  }, [episodeSlug]);

  // Control ẩn thì không cần cập nhật đồng hồ/thanh tiến độ nữa.
  const controlsShown = controlsVisible || !playing;
  const controlsShownRef = useRef(controlsShown);
  controlsShownRef.current = controlsShown;

  useWakeLock(playing);

  /* -------------------- điều khiển -------------------- */

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => undefined);
    else video.pause();
  }, [videoRef]);

  const seek = useCallback(
    (time: number) => {
      const video = videoRef.current;
      if (!video || !Number.isFinite(time)) return;
      video.currentTime = Math.max(0, Math.min(time, video.duration || 0));
      setCurrentTime(video.currentTime);
    },
    [videoRef],
  );

  const skip = useCallback(
    (delta: number) => {
      const video = videoRef.current;
      if (video) seek(video.currentTime + delta);
    },
    [seek, videoRef],
  );

  const changeVolume = useCallback(
    (value: number) => {
      const video = videoRef.current;
      if (!video) return;
      const next = Math.max(0, Math.min(1, value));
      video.volume = next;
      video.muted = next === 0;
    },
    [videoRef],
  );

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (video) video.muted = !video.muted;
  }, [videoRef]);

  /**
   * iPhone KHÔNG hỗ trợ Fullscreen API trên phần tử thường — `requestFullscreen`
   * không tồn tại trên div. Đường duy nhất là gọi `webkitEnterFullscreen` của
   * chính thẻ video (đổi lại: control layer tự viết nhường chỗ cho control iOS).
   */
  const toggleFullscreen = useCallback(() => {
    const shell = shellRef.current;
    const video = videoRef.current as FullscreenVideo | null;

    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
      return;
    }

    if (shell?.requestFullscreen) {
      void shell.requestFullscreen().catch(() => undefined);
      return;
    }

    video?.webkitEnterFullscreen?.();
  }, [videoRef]);

  /** Xem tiếp trong cửa sổ nổi khi chuyển tab làm việc khác. */
  const togglePip = useCallback(() => {
    const video = videoRef.current as PipVideo | null;
    if (!video?.requestPictureInPicture) return;

    if (document.pictureInPictureElement) {
      void document.exitPictureInPicture().catch(() => undefined);
    } else {
      void video.requestPictureInPicture().catch(() => undefined);
    }
  }, [videoRef]);

  const changeRate = useCallback(
    (rate: number) => {
      const video = videoRef.current;
      if (video) video.playbackRate = rate;
      setPlaybackRate(rate);
      savePlayerSettings({ rate });
    },
    [videoRef],
  );

  /* -------------------- §10.3 auto-hide -------------------- */

  const bumpControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), PLAYER.controlsAutoHide);
  }, []);

  /* -------------------- cử chỉ trên mặt video -------------------- */

  const flashSeek = useCallback(
    (dir: 1 | -1) => {
      skip(dir * PLAYER.seekStep);
      setSeekFlash({ dir, key: Date.now() });
    },
    [skip],
  );

  useEffect(() => {
    if (!seekFlash) return;
    const timer = setTimeout(() => setSeekFlash(null), 600);
    return () => clearTimeout(timer);
  }, [seekFlash]);

  /**
   * Màn cảm ứng: chạm một lần = bật/tắt control (KHÔNG phải play/pause — bản cũ
   * làm người dùng dừng phim mỗi lần muốn xem thanh tiến độ), chạm đôi hai bên
   * mép = tua ±10s, chạm đôi giữa màn = play/pause.
   */
  const onSurfacePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!coarsePointer) return;

      const now = Date.now();
      const last = lastTapRef.current;
      const rect = event.currentTarget.getBoundingClientRect();
      const ratio = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0.5;

      const isDoubleTap =
        now - last.time < DOUBLE_TAP_MS && Math.abs(event.clientX - last.x) < DOUBLE_TAP_SLOP_PX;

      lastTapRef.current = { time: now, x: event.clientX };

      if (isDoubleTap) {
        lastTapRef.current.time = 0; // chạm thứ ba không tính là double tiếp
        if (ratio < 0.35) flashSeek(-1);
        else if (ratio > 0.65) flashSeek(1);
        else togglePlay();
        bumpControls();
        return;
      }

      if (controlsShownRef.current && playing) setControlsVisible(false);
      else bumpControls();
    },
    [coarsePointer, flashSeek, togglePlay, bumpControls, playing],
  );

  /** Chuột: bấm = play/pause, bấm đôi = toàn màn hình (thói quen từ YouTube). */
  const onSurfaceClick = useCallback(() => {
    if (coarsePointer) return;
    togglePlay();
    bumpControls();
  }, [coarsePointer, togglePlay, bumpControls]);

  const onSurfaceDoubleClick = useCallback(() => {
    if (coarsePointer) return;
    toggleFullscreen();
  }, [coarsePointer, toggleFullscreen]);

  /* -------------------- §10.4 phím tắt -------------------- */

  useKeyboardShortcuts(
    {
      ' ': () => {
        togglePlay();
        bumpControls();
      },
      k: () => {
        togglePlay();
        bumpControls();
      },
      ArrowLeft: () => {
        skip(-PLAYER.seekStep);
        bumpControls();
      },
      ArrowRight: () => {
        skip(PLAYER.seekStep);
        bumpControls();
      },
      j: () => skip(-PLAYER.seekStep),
      l: () => skip(PLAYER.seekStep),
      ArrowUp: () => changeVolume((videoRef.current?.volume ?? 0) + PLAYER.volumeStep),
      ArrowDown: () => changeVolume((videoRef.current?.volume ?? 0) - PLAYER.volumeStep),
      f: toggleFullscreen,
      m: toggleMute,
      p: togglePip,
      Escape: () => {
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
      },
    },
    { enabled: source !== 'embed' },
  );

  /* -------------------- sự kiện media -------------------- */

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // §10.5 mở rộng — trả lại âm lượng/tốc độ người dùng đã chọn ở tập trước.
    const settings = getPlayerSettings();
    video.volume = settings.volume;
    video.muted = settings.muted;
    video.playbackRate = settings.rate;
    setVolume(settings.volume);
    setMuted(settings.muted);
    setPlaybackRate(settings.rate);

    const onPlay = () => setPlaying(true);
    const onPause = () => {
      setPlaying(false);
      setControlsVisible(true);
    };

    const onTime = () => {
      // Ghi tiến độ vẫn chạy (đọc thẳng từ video, không qua state).
      handleTimeUpdate();
      if (!controlsShownRef.current) return;

      setCurrentTime(video.currentTime);
      const ranges = video.buffered;
      setBuffered(ranges.length > 0 ? ranges.end(ranges.length - 1) : 0);
    };

    const onMeta = () => {
      setDuration(video.duration || 0);

      if (startAt === undefined || startAtAppliedRef.current === episodeSlug) return;
      // Mốc nằm ngoài phim thì bỏ qua, còn hơn treo ở khung đen cuối file.
      if (Number.isFinite(video.duration) && video.duration > 0 && startAt >= video.duration) {
        startAtAppliedRef.current = episodeSlug;
        return;
      }
      startAtAppliedRef.current = episodeSlug;
      video.currentTime = startAt;
    };

    const onVolumeChange = () => {
      setVolume(video.volume);
      setMuted(video.muted);
      // Kéo thanh âm lượng bắn ra hàng chục sự kiện — gom lại rồi mới ghi.
      if (settingsTimerRef.current) clearTimeout(settingsTimerRef.current);
      settingsTimerRef.current = setTimeout(
        () => savePlayerSettings({ volume: video.volume, muted: video.muted }),
        400,
      );
    };

    const onRate = () => setPlaybackRate(video.playbackRate);
    const onPipEnter = () => setPip(true);
    const onPipLeave = () => setPip(false);

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('progress', onTime);
    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('durationchange', onMeta);
    video.addEventListener('volumechange', onVolumeChange);
    video.addEventListener('ratechange', onRate);
    video.addEventListener('enterpictureinpicture', onPipEnter);
    video.addEventListener('leavepictureinpicture', onPipLeave);
    if (onEnded) video.addEventListener('ended', onEnded);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('progress', onTime);
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('durationchange', onMeta);
      video.removeEventListener('volumechange', onVolumeChange);
      video.removeEventListener('ratechange', onRate);
      video.removeEventListener('enterpictureinpicture', onPipEnter);
      video.removeEventListener('leavepictureinpicture', onPipLeave);
      if (onEnded) video.removeEventListener('ended', onEnded);
      if (settingsTimerRef.current) clearTimeout(settingsTimerRef.current);
    };
  }, [videoRef, handleTimeUpdate, onEnded, source, startAt, episodeSlug]);

  useEffect(() => {
    const onFsChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    bumpControls();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [bumpControls]);

  /** Vừa hiện lại control sau một lúc ẩn → đồng bộ ngay, đừng để đồng hồ nhảy cóc. */
  useEffect(() => {
    const video = videoRef.current;
    if (!controlsShown || !video) return;
    setCurrentTime(video.currentTime);
    setDuration(video.duration || 0);
  }, [controlsShown, videoRef]);

  /* -------------------- render -------------------- */

  // §10.2 bước 4 — cả hai nguồn fail.
  if (source === 'failed') {
    return (
      <div className="flex aspect-backdrop w-full flex-col items-center justify-center gap-4 rounded-card bg-bg-elevated px-6 text-center">
        <p className="text-text-secondary">Không phát được tập này.</p>
        <Button variant="accent" onClick={retry}>
          Thử server khác
        </Button>
      </div>
    );
  }

  // §10.2 bước 3 — iframe dự phòng. Không kiểm soát được nên không vẽ control layer.
  if (source === 'embed') {
    return (
      <div className="relative aspect-backdrop w-full overflow-hidden rounded-card bg-black">
        <iframe
          src={embedUrl}
          title={title}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
        <button
          type="button"
          onClick={retry}
          className="absolute bottom-2 right-2 rounded-pill bg-bg-base/80 px-3 py-1 text-xs text-text-secondary backdrop-blur-sm transition-colors duration-micro ease-standard hover:text-text-primary"
        >
          Thử lại nguồn chính
        </button>
      </div>
    );
  }

  const waiting = !isReady || stalled || recovering;

  return (
    <div className="space-y-2">
      <div
        ref={shellRef}
        onMouseMove={coarsePointer ? undefined : bumpControls}
        className="player-shell relative aspect-backdrop w-full overflow-hidden rounded-card bg-black"
      >
        <video
          ref={videoRef}
          playsInline
          // Mạng yếu: chỉ lấy metadata, đừng nuốt data khi người dùng còn chưa bấm phát.
          preload={tier === 'low' ? 'metadata' : 'auto'}
          className="h-full w-full object-contain"
          // §10.3 — KHÔNG dùng controls mặc định
        />

        {/* Lớp nhận cử chỉ: nằm dưới control layer, phủ kín mặt video */}
        <div
          className="absolute inset-0 z-[1]"
          onPointerUp={onSurfacePointerUp}
          onClick={onSurfaceClick}
          onDoubleClick={onSurfaceDoubleClick}
        />

        {/* Chờ dữ liệu — vòng xoay, KHÔNG phải màn lỗi */}
        {waiting && (
          <div className="pointer-events-none absolute inset-0 z-[2] flex flex-col items-center justify-center gap-3">
            <span className="player-spinner" aria-hidden="true" />
            {(recovering || !network.online) && (
              <span className="rounded-pill bg-bg-base/80 px-3 py-1 text-xs text-text-secondary backdrop-blur-sm">
                {network.online
                  ? 'Mạng chập chờn, đang kết nối lại…'
                  : 'Mất mạng — sẽ tự phát tiếp'}
              </span>
            )}
          </div>
        )}

        {/* Phản hồi cử chỉ tua trên màn cảm ứng */}
        {seekFlash && (
          <div
            key={seekFlash.key}
            className={`pointer-events-none absolute top-1/2 z-[2] -translate-y-1/2 rounded-pill bg-bg-base/75 px-4 py-2 text-sm font-medium text-text-primary backdrop-blur-sm ${
              seekFlash.dir === 1 ? 'right-[12%]' : 'left-[12%]'
            }`}
          >
            {seekFlash.dir === 1 ? `+${PLAYER.seekStep}s` : `−${PLAYER.seekStep}s`}
          </div>
        )}

        {/* §13.3 — thông báo trạng thái cho screen reader */}
        <p aria-live="polite" className="sr-only">
          {playing ? 'Đang phát' : 'Đã tạm dừng'} {title}
        </p>

        <PlayerControls
          playing={playing}
          currentTime={currentTime}
          duration={duration}
          buffered={buffered}
          volume={volume}
          muted={muted}
          fullscreen={fullscreen}
          pip={pip}
          playbackRate={playbackRate}
          levels={levels}
          currentLevel={currentLevel}
          autoLevel={autoLevel}
          title={title}
          visible={controlsShown}
          compact={coarsePointer}
          saveData={network.saveData}
          onTogglePlay={togglePlay}
          onSeek={seek}
          onSkip={skip}
          onVolume={changeVolume}
          onToggleMute={toggleMute}
          onToggleFullscreen={toggleFullscreen}
          onTogglePip={togglePip}
          onRate={changeRate}
          onLevel={selectLevel}
          onInteract={bumpControls}
          onBack={onBack}
          onNext={onNext}
          nextLabel={nextLabel}
        />
      </div>

      {/*
        §10.5 — prompt tiếp tục xem, DƯỚI player chứ không đè lên mặt video.
        Sai lệch có chủ đích so với §10.5, lý do là số đo: player 16:9 ở khổ 375
        cao 193px, hai thanh điều khiển đã ăn gần hết, phần trống còn lại không
        đủ cho một dải hỏi hai nút — bản cũ đặt `bottom-20` và nằm chồng lên
        thanh tiêu đề (đo được: prompt 101→193, tiêu đề 110→130, hai khối chữ đè
        nhau). Thu nhỏ hay dời chỗ đều chỉ đẩy va chạm sang chỗ khác vì chỗ
        trống thật sự không có.

        Ra ngoài khung thì hết va chạm ở MỌI khổ màn, và dùng lại đúng hình dạng
        của dải đếm ngược auto-next ngay bên dưới (`WatchScreen`) — cùng một loại
        thông báo thì trông giống nhau.
      */}
      {showResumePrompt && saved && (
        <div className="flex flex-wrap items-center gap-3 rounded-card bg-bg-elevated p-3 text-sm">
          <span className="text-text-secondary">Tiếp tục xem từ {formatTime(saved.position)}?</span>
          <Button size="sm" variant="accent" onClick={resume}>
            Tiếp tục
          </Button>
          <Button size="sm" variant="ghost" onClick={restart}>
            Xem từ đầu
          </Button>
        </div>
      )}
    </div>
  );
}
