'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { youtubeId } from '@/lib/derive';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { IconButton } from '@/components/ui/Button';
import { VolumeIcon, VolumeMutedIcon } from '@/components/ui/icons';

/** §8.2 — sau 2500ms mới crossfade sang trailer. */
const TRAILER_DELAY = 2500;
/** Không nhận tín hiệu nào từ YouTube trong khoảng này → coi như nhúng thất bại. */
const READY_TIMEOUT = 5000;

interface HeroTrailerProps {
  /** Link YouTube từ `movie.trailerUrl`. Rỗng hoặc không nhận ra → không render gì. */
  trailerUrl: string;
  title: string;
}

/**
 * §8.2 — lớp trailer của hero.
 *
 *   sau 2500ms          → crossfade sang YouTube
 *   nhúng thất bại      → IM LẶNG giữ ảnh, không hiện lỗi (§14.1, §17 rủi ro #5)
 *   rời viewport        → pause (IntersectionObserver)
 *   reduced motion      → không phát (§9.4)
 *   mạng/máy yếu        → HeroBillboard không truyền trailerUrl xuống nữa
 *
 * Ba điều kiện phải đúng ĐỒNG THỜI thì iframe mới được gắn: đã chờ đủ 2.5s,
 * hero còn trong viewport, và tab đang hiện. Nhúng YouTube kéo theo ~1MB
 * script/CSS — mở trang rồi cuộn xuống ngay mà vẫn phải trả khoản đó là vô lý.
 *
 * Dùng `enablejsapi=1` + postMessage thay vì tải IFrame API script: điều khiển
 * được play/pause/mute mà không kéo thêm script bên thứ ba vào bundle (§12.1).
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
   * Thiếu bước này thì không bao giờ biết nhúng có thành công hay không.
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
   * Nghe tín hiệu từ YouTube: vừa để biết nhúng có thành công, vừa để lặp lại.
   *
   * ⚠️ Sai lệch so với §8.2: tài liệu chỉ định `loop=1&playlist={id}`, nhưng
   * `playlist` làm YouTube chuyển sang chế độ danh sách phát và hiện nút
   * prev/pause/next ngay giữa hero — `controls=0` không tắt được. Đã kiểm chứng
   * trên trình duyệt. Thay bằng: nghe `playerState === 0` (ended) rồi tua về đầu.
   */
  useEffect(() => {
    if (!mounted) return;

    const onMessage = (event: MessageEvent) => {
      if (!event.origin.includes('youtube.com')) return;
      setReady(true);

      if (typeof event.data !== 'string') return;
      try {
        const payload = JSON.parse(event.data) as { info?: { playerState?: number } };
        // 0 = ended
        if (payload.info?.playerState === 0) {
          command('seekTo', [0, true]);
          command('playVideo');
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

  // §8.2 — pause khi hero rời viewport hoặc khi người dùng chuyển tab.
  useEffect(() => {
    if (!ready) return;
    command(inView ? 'playVideo' : 'pauseVideo');
  }, [ready, inView, command]);

  useEffect(() => {
    if (!ready) return;

    const onVisibility = () => {
      command(document.visibilityState === 'visible' && inView ? 'playVideo' : 'pauseVideo');
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [ready, inView, command]);

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
          onLoad={startListening}
          className={cn(
            // Phóng to để che thanh đen của khung 16:9 YouTube
            'pointer-events-none absolute left-1/2 top-1/2 h-[135%] w-[135%] -translate-x-1/2 -translate-y-1/2 border-0',
            'transition-opacity duration-standard ease-standard',
            ready ? 'opacity-100' : 'opacity-0',
          )}
          data-motion="fade"
        />
      )}

      {ready && (
        <IconButton
          label={muted ? 'Bật tiếng trailer' : 'Tắt tiếng trailer'}
          onClick={() => {
            command(muted ? 'unMute' : 'mute');
            setMuted((m) => !m);
          }}
          className="pointer-events-auto absolute bottom-[12%] right-row"
        >
          {muted ? <VolumeMutedIcon /> : <VolumeIcon />}
        </IconButton>
      )}
    </div>
  );
}
