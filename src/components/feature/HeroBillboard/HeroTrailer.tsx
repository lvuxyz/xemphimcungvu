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

      {/* Thông báo tương tác nổi ở giữa (Feedback Badge) */}
      {feedback && (
        <div
          key={feedback.id}
          className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center animate-fade-in"
        >
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-bg-base/85 px-6 py-4 text-text-primary shadow-2xl ring-1 ring-white/20 backdrop-blur-md">
            <span className="text-3xl">
              {feedback.icon === 'play' && <PlayIcon className="h-8 w-8 text-emerald-400" />}
              {feedback.icon === 'pause' && <PauseIcon className="h-8 w-8 text-amber-400" />}
              {feedback.icon === 'volume' && <VolumeIcon className="h-8 w-8 text-accent" />}
              {feedback.icon === 'mute' && (
                <VolumeMutedIcon className="h-8 w-8 text-text-secondary" />
              )}
              {feedback.icon === 'replay' && <ReplayIcon className="h-8 w-8 text-sky-400" />}
            </span>
            <span className="text-sm font-semibold tracking-wide drop-shadow-md">
              {feedback.text}
            </span>
          </div>
        </div>
      )}

      {/* Cụm điều khiển phát trailer ở góc phải dưới (§8.2 nâng cao) */}
      {ready && (
        <div className="pointer-events-auto absolute bottom-[12%] right-row z-20 flex items-center gap-2 rounded-pill bg-bg-base/75 p-1.5 ring-1 ring-white/15 backdrop-blur-md shadow-2xl transition-all duration-300 hover:bg-bg-base/90 hover:ring-white/30">
          {/* Badge trạng thái phát */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold tracking-wider uppercase text-text-primary/90">
            <span
              className={cn(
                'h-2 w-2 rounded-full transition-colors duration-300',
                isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse',
              )}
            />
            <span className="text-[11px] font-bold">{isPaused ? 'Tạm dừng' : 'Trailer'}</span>
          </div>

          <div className="hidden sm:block h-4 w-[1px] bg-white/20" />

          {/* Nút Play / Pause */}
          <IconButton
            label={
              isPaused
                ? 'Tiếp tục phát trailer (Phím Space)'
                : 'Tạm dừng trailer (Phím Space)'
            }
            onClick={togglePlayPause}
            className={cn(
              'hover:bg-white/20 text-white',
              isPaused && 'text-amber-300 ring-amber-400/50 bg-amber-500/10',
            )}
          >
            {isPaused ? <PlayIcon className="translate-x-0.5" /> : <PauseIcon />}
          </IconButton>

          {/* Nút Âm thanh & Âm thanh demo */}
          <IconButton
            label={
              muted
                ? 'Bật âm thanh demo trailer (Phím M)'
                : 'Tắt âm thanh (Phím M)'
            }
            onClick={toggleAudio}
            className={cn(
              'hover:bg-white/20 transition-all',
              !muted && 'text-accent ring-accent/60 bg-accent/20',
            )}
          >
            {muted ? <VolumeMutedIcon /> : <VolumeIcon />}
          </IconButton>

          {/* Nút Phát lại từ đầu */}
          <IconButton
            label="Phát lại trailer từ đầu"
            onClick={replayTrailer}
            className="hover:bg-white/20 text-white"
          >
            <ReplayIcon />
          </IconButton>
        </div>
      )}
    </div>
  );
}

