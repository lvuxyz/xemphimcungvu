'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { youtubeId } from '@/lib/derive';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { IconButton } from '@/components/ui/Button';
import {
  PauseIcon,
  PlayIcon,
  ReplayIcon,
  VolumeIcon,
  VolumeMutedIcon,
} from '@/components/ui/icons';

/** §8.2 — sau 2500ms mới crossfade sang trailer. */
const TRAILER_DELAY = 2500;
/** Không nhận tín hiệu nào từ YouTube trong khoảng này → coi như nhúng thất bại. */
const READY_TIMEOUT = 5000;

interface HeroTrailerProps {
  /** Link YouTube từ `movie.trailerUrl`. Rỗng hoặc không nhận ra → không render gì. */
  trailerUrl: string;
  title: string;
}

/** Biến toàn cục giữ AudioContext cho âm thanh demo trailer */
let activeDemoAudioCtx: AudioContext | null = null;

/** Phát âm thanh trailer demo chuẩn điện ảnh sử dụng Web Audio API */
function playCinemaDemoAudio() {
  if (typeof window === 'undefined') return;
  try {
    if (activeDemoAudioCtx) {
      try {
        activeDemoAudioCtx.close();
      } catch {
        /* bỏ qua nếu đã đóng */
      }
      activeDemoAudioCtx = null;
    }

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    activeDemoAudioCtx = ctx;

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // Master gain
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.linearRampToValueAtTime(0.2, now + 0.25);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);
    masterGain.connect(ctx.destination);

    // Sub bass cinematic rumble (sóng sine trầm)
    const subOsc = ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(60, now);
    subOsc.frequency.exponentialRampToValueAtTime(38, now + 1.6);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.4, now);
    subOsc.connect(subGain);
    subGain.connect(masterGain);
    subOsc.start(now);
    subOsc.stop(now + 2.7);

    // Hợp âm điện ảnh ấm áp (D minor pad chord)
    const chord = [146.83, 220.0, 261.63, 329.63, 440.0];
    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx % 2 === 0 ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, now);
      filter.frequency.exponentialRampToValueAtTime(1300, now + 0.7);
      filter.frequency.exponentialRampToValueAtTime(240, now + 2.7);

      const oscGain = ctx.createGain();
      oscGain.gain.setValueAtTime(0.05, now);

      osc.connect(filter);
      filter.connect(oscGain);
      oscGain.connect(masterGain);

      osc.start(now + idx * 0.03);
      osc.stop(now + 2.7);
    });
  } catch {
    /* fail mềm nếu trình duyệt giới hạn audio */
  }
}

/** Tắt âm thanh demo nếu đang phát */
function stopCinemaDemoAudio() {
  if (activeDemoAudioCtx) {
    try {
      activeDemoAudioCtx.close();
    } catch {
      /* bỏ qua */
    }
    activeDemoAudioCtx = null;
  }
}

/**
 * §8.2 — lớp trailer của hero.
 *
 *   sau 2500ms          → crossfade sang YouTube
 *   nhúng thất bại      → IM LẶNG giữ ảnh, không hiện lỗi (§14.1, §17 rủi ro #5)
 *   rời viewport        → pause (IntersectionObserver)
 *   reduced motion      → không phát (§9.4)
 *   mạng/máy yếu        → HeroBillboard không truyền trailerUrl xuống nữa
 *   màn cảm ứng         → như trên: hero dọc, video 16:9 bị letterbox
 *   điều khiển          → Pause / Play, Bật / Tắt âm thanh Demo, Phát lại (Replay)
 */
export function HeroTrailer({ trailerUrl, title }: HeroTrailerProps) {
  const videoId = youtubeId(trailerUrl);
  const reducedMotion = usePrefersReducedMotion();

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [inView, setInView] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [muted, setMuted] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  // Hiệu ứng thông báo nổi (visual feedback) khi tương tác
  const [feedback, setFeedback] = useState<{
    id: number;
    icon: 'play' | 'pause' | 'volume' | 'mute' | 'replay';
    text: string;
  } | null>(null);
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showFeedback = useCallback(
    (icon: 'play' | 'pause' | 'volume' | 'mute' | 'replay', text: string) => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      setFeedback({ id: Date.now(), icon, text });
      feedbackTimerRef.current = setTimeout(() => {
        setFeedback(null);
      }, 1600);
    },
    [],
  );

  const post = useCallback((payload: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify(payload),
      'https://www.youtube.com',
    );
  }, []);

  const command = useCallback(
    (func: string, args: unknown[] = []) => post({ event: 'command', func, args, id: videoId }),
    [post, videoId],
  );

  /**
   * Bắt tay với player: YouTube chỉ gửi message về SAU khi nhận `listening`.
   */
  const startListening = useCallback(
    () => post({ event: 'listening', id: videoId, channel: 'widget' }),
    [post, videoId],
  );

  /** Theo dõi viewport ngay từ đầu — vừa để hoãn mount, vừa để pause sau này. */
  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setInView(entry.isIntersecting);
      },
      { threshold: 0.3 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // §8.2 — chờ 2500ms, và chỉ khi hero còn trên màn hình.
  useEffect(() => {
    if (!videoId || reducedMotion || mounted || !inView) return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

    const timer = setTimeout(() => setMounted(true), TRAILER_DELAY);
    return () => clearTimeout(timer);
  }, [videoId, reducedMotion, mounted, inView]);

  /**
   * Nghe tín hiệu từ YouTube:
   * - Ready
   * - Cập nhật trạng thái Play/Pause tự động
   * - Lặp lại khi kết thúc
   */
  useEffect(() => {
    if (!mounted) return;

    const onMessage = (event: MessageEvent) => {
      if (!event.origin.includes('youtube.com')) return;
      setReady(true);

      if (typeof event.data !== 'string') return;
      try {
        const payload = JSON.parse(event.data) as {
          event?: string;
          info?: { playerState?: number };
        };
        // 0 = ended -> tua về đầu lặp lại
        if (payload.info?.playerState === 0) {
          command('seekTo', [0, true]);
          command('playVideo');
          setIsPaused(false);
        } else if (payload.info?.playerState === 1) {
          // playing
          setIsPaused(false);
        } else if (payload.info?.playerState === 2) {
          // paused
          setIsPaused(true);
        }
      } catch {
        /* message không phải JSON — bỏ qua */
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [mounted, command]);

  // Hết thời gian chờ mà player không phản hồi → im lặng bỏ cuộc, giữ ảnh (§14.1).
  useEffect(() => {
    if (!mounted || ready) return;
    const timer = setTimeout(() => setFailed(true), READY_TIMEOUT);
    return () => clearTimeout(timer);
  }, [mounted, ready]);

  // Pause khi hero rời viewport hoặc khi người dùng chuyển tab (trừ khi người dùng đã chủ động pause)
  useEffect(() => {
    if (!ready) return;
    if (inView) {
      if (!isPaused) {
        command('playVideo');
      }
    } else {
      command('pauseVideo');
    }
  }, [ready, inView, isPaused, command]);

  useEffect(() => {
    if (!ready) return;

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && inView && !isPaused) {
        command('playVideo');
      } else {
        command('pauseVideo');
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [ready, inView, isPaused, command]);

  // Dọn dẹp âm thanh demo khi unmount
  useEffect(() => {
    return () => {
      stopCinemaDemoAudio();
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  /** Tạm dừng hoặc tiếp tục phát trailer */
  const togglePlayPause = useCallback(() => {
    setIsPaused((prev) => {
      const next = !prev;
      if (next) {
        command('pauseVideo');
        stopCinemaDemoAudio();
        showFeedback('pause', 'Tạm dừng trailer');
      } else {
        command('playVideo');
        showFeedback('play', 'Tiếp tục phát');
      }
      return next;
    });
  }, [command, showFeedback]);

  /** Bật hoặc tắt âm thanh + kích hoạt demo audio khi bật */
  const toggleAudio = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      if (!next) {
        // Bật tiếng
        command('unMute');
        command('setVolume', [100]);
        command('playVideo');
        setIsPaused(false);
        playCinemaDemoAudio();
        showFeedback('volume', 'Đã bật âm thanh trailer demo');
      } else {
        // Tắt tiếng
        command('mute');
        stopCinemaDemoAudio();
        showFeedback('mute', 'Đã tắt âm thanh');
      }
      return next;
    });
  }, [command, showFeedback]);

  /** Phát lại trailer từ đầu */
  const replayTrailer = useCallback(() => {
    command('seekTo', [0, true]);
    command('playVideo');
    setIsPaused(false);
    showFeedback('replay', 'Phát lại từ đầu');
  }, [command, showFeedback]);

  // Phím tắt bàn phím: Phím Space / K để Play/Pause, phím M để Bật/Tắt âm thanh
  useEffect(() => {
    if (!ready) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.getAttribute('role') === 'textbox')
      ) {
        return;
      }

      if (e.code === 'Space' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleAudio();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [ready, togglePlayPause, toggleAudio]);

  if (!videoId || reducedMotion || failed) {
    // Vẫn phải giữ container: nó là thứ IntersectionObserver bám vào.
    return <div ref={containerRef} className="absolute inset-0" aria-hidden="true" />;
  }

  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    controls: '0',
    modestbranding: '1',
    disablekb: '1',
    playsinline: '1',
    iv_load_policy: '3',
    fs: '0',
    rel: '0',
    enablejsapi: '1',
  });

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {mounted && (
        <iframe
          ref={iframeRef}
          src={`https://www.youtube.com/embed/${videoId}?${params.toString()}`}
          title={`Trailer ${title}`}
          allow="autoplay; encrypted-media"
          loading="lazy"
          tabIndex={-1}
          onLoad={() => {
            startListening();
            // Fallback: đảm bảo các nút điều khiển xuất hiện sau khi iframe tải xong
            setTimeout(() => setReady(true), 1200);
          }}
          className={cn(
            // Phóng to để che thanh đen của khung 16:9 YouTube
            'pointer-events-none absolute left-1/2 top-1/2 h-[135%] w-[135%] -translate-x-1/2 -translate-y-1/2 border-0',
            'transition-opacity duration-standard ease-standard',
            ready ? 'opacity-100' : 'opacity-0',
          )}
          data-motion="fade"
        />
      )}

      {/* Thông báo tương tác nổi ở giữa (Feedback Badge chuẩn Netflix/Apple) */}
      {feedback && (
        <div
          key={feedback.id}
          className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center animate-fade-scale"
        >
          <div className="flex flex-col items-center gap-3 rounded-3xl bg-black/80 px-8 py-5 text-text-primary shadow-[0_25px_60px_rgba(0,0,0,0.85)] ring-1 ring-white/20 backdrop-blur-2xl">
            <div
              className={cn(
                'flex h-16 w-16 items-center justify-center rounded-2xl shadow-inner transition-colors',
                feedback.icon === 'play' &&
                  'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/50 shadow-[0_0_24px_rgba(52,211,153,0.35)]',
                feedback.icon === 'pause' &&
                  'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/50 shadow-[0_0_24px_rgba(251,191,36,0.35)]',
                feedback.icon === 'volume' &&
                  'bg-accent/25 text-accent-hover ring-1 ring-accent/60 shadow-[0_0_24px_rgba(145,132,217,0.45)]',
                feedback.icon === 'mute' &&
                  'bg-white/10 text-text-secondary ring-1 ring-white/20',
                feedback.icon === 'replay' &&
                  'bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/50 shadow-[0_0_24px_rgba(56,189,248,0.35)]',
              )}
            >
              {feedback.icon === 'play' && <PlayIcon className="h-8 w-8 translate-x-0.5" />}
              {feedback.icon === 'pause' && <PauseIcon className="h-8 w-8" />}
              {feedback.icon === 'volume' && <VolumeIcon className="h-8 w-8" />}
              {feedback.icon === 'mute' && (
                <VolumeMutedIcon className="h-8 w-8" />
              )}
              {feedback.icon === 'replay' && <ReplayIcon className="h-8 w-8" />}
            </div>
            <div className="flex flex-col items-center text-center">
              <span className="text-base font-bold tracking-wide drop-shadow-md">
                {feedback.text}
              </span>
              <span className="mt-0.5 text-xs text-text-muted">
                {feedback.icon === 'play' || feedback.icon === 'pause'
                  ? 'Phím tắt Space hoặc K'
                  : feedback.icon === 'volume' || feedback.icon === 'mute'
                    ? 'Phím tắt M'
                    : 'Tua về 0:00'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Cụm điều khiển trailer góc phải dưới kiểu Frosted Glass Pill siêu đẹp */}
      {ready && (
        <div className="pointer-events-auto absolute bottom-[12%] right-row z-20 flex items-center gap-2 rounded-full bg-gradient-to-r from-black/70 via-black/55 to-black/70 p-2 ring-1 ring-white/20 backdrop-blur-2xl shadow-[0_16px_40px_rgba(0,0,0,0.7)] transition-all duration-300 hover:ring-white/40 hover:shadow-[0_20px_50px_rgba(0,0,0,0.85)]">
          {/* Badge trạng thái phát */}
          <div className="hidden sm:flex items-center gap-2 pl-3 pr-2 py-1 text-xs font-semibold tracking-wider uppercase text-text-primary/90">
            <span className="relative flex h-2.5 w-2.5 items-center justify-center">
              {!isPaused ? (
                <>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                </>
              ) : (
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]" />
              )}
            </span>
            <span className="bg-gradient-to-r from-white via-white/95 to-white/70 bg-clip-text text-[11px] font-extrabold tracking-widest text-transparent">
              {isPaused ? 'Tạm dừng' : 'Trailer'}
            </span>
          </div>

          <div className="hidden sm:block h-5 w-[1px] bg-gradient-to-b from-white/10 via-white/25 to-white/10" />

          {/* Nút Play / Pause */}
          <button
            type="button"
            aria-label={
              isPaused
                ? 'Tiếp tục phát trailer (Phím Space)'
                : 'Tạm dừng trailer (Phím Space)'
            }
            title={
              isPaused
                ? 'Tiếp tục phát trailer (Phím Space)'
                : 'Tạm dừng trailer (Phím Space)'
            }
            onClick={togglePlayPause}
            className={cn(
              'group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
              'transition-all duration-200 active:scale-90',
              isPaused
                ? 'bg-amber-400/25 text-amber-300 ring-1 ring-amber-400/50 shadow-[0_0_16px_rgba(251,191,36,0.35)] hover:bg-amber-400/35'
                : 'bg-white/10 text-white ring-1 ring-white/20 shadow-md hover:bg-white/25 hover:ring-white/40 hover:scale-105',
            )}
          >
            {isPaused ? (
              <PlayIcon className="h-4 w-4 translate-x-0.5 transition-transform group-hover:scale-110" />
            ) : (
              <PauseIcon className="h-4 w-4 transition-transform group-hover:scale-110" />
            )}
          </button>

          {/* Nút Âm thanh & Âm thanh demo với visualizer equalizer */}
          <button
            type="button"
            aria-label={
              muted
                ? 'Bật âm thanh demo trailer (Phím M)'
                : 'Tắt âm thanh (Phím M)'
            }
            title={
              muted
                ? 'Bật âm thanh demo trailer (Phím M)'
                : 'Tắt âm thanh (Phím M)'
            }
            onClick={toggleAudio}
            className={cn(
              'group relative flex h-10 shrink-0 items-center justify-center rounded-full px-3 gap-2',
              'transition-all duration-200 active:scale-90',
              !muted
                ? 'bg-accent/30 text-accent-hover ring-1 ring-accent/60 shadow-[0_0_20px_rgba(145,132,217,0.5)] hover:bg-accent/40'
                : 'bg-white/10 text-white/80 ring-1 ring-white/20 shadow-md hover:bg-white/25 hover:text-white hover:ring-white/40 hover:scale-105',
            )}
          >
            {!muted ? (
              <>
                <VolumeIcon className="h-4 w-4 transition-transform group-hover:scale-110" />
                {/* 3 vạch sóng âm thanh equalizer chuyển động sống động */}
                <div className="flex items-end gap-0.5 h-3.5" aria-hidden="true">
                  <span className="w-0.5 rounded-full bg-accent animate-eq-1" />
                  <span className="w-0.5 rounded-full bg-accent animate-eq-2" />
                  <span className="w-0.5 rounded-full bg-accent animate-eq-3" />
                </div>
              </>
            ) : (
              <VolumeMutedIcon className="h-4 w-4 transition-transform group-hover:scale-110" />
            )}
          </button>

          {/* Nút Phát lại từ đầu */}
          <button
            type="button"
            aria-label="Phát lại trailer từ đầu"
            title="Phát lại trailer từ đầu"
            onClick={replayTrailer}
            className="group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80 ring-1 ring-white/20 shadow-md transition-all duration-200 hover:bg-white/25 hover:text-white hover:ring-white/40 hover:scale-105 active:scale-90"
          >
            <ReplayIcon className="h-4 w-4 transition-transform duration-300 ease-out group-hover:-rotate-90 group-hover:scale-110" />
          </button>
        </div>
      )}
    </div>
  );
}

