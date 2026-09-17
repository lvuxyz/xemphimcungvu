'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { formatTime } from '@/lib/derive';
import { PLAYER } from '@/lib/constants';
import type { HlsQualityLevel } from '@/hooks/useHls';
import { IconButton } from '@/components/ui/Button';
import {
  ExitFullscreenIcon,
  FullscreenIcon,
  PauseIcon,
  PipIcon,
  PlayIcon,
  SettingsIcon,
  SkipBackIcon,
  SkipForwardIcon,
  VolumeIcon,
  VolumeMutedIcon,
} from '@/components/ui/icons';

interface PlayerControlsProps {
  playing: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  volume: number;
  muted: boolean;
  fullscreen: boolean;
  pip: boolean;
  playbackRate: number;
  levels: HlsQualityLevel[];
  currentLevel: number;
  /** ABR đang tự chọn chất lượng. */
  autoLevel: boolean;
  title: string;
  visible: boolean;
  /** Màn cảm ứng: vùng chạm to hơn, bỏ những nút đã có cử chỉ thay thế. */
  compact: boolean;
  saveData: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onSkip: (delta: number) => void;
  onVolume: (value: number) => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onTogglePip: () => void;
  onRate: (rate: number) => void;
  onLevel: (index: number) => void;
  /** Bất kỳ tương tác nào cũng hoãn auto-hide. */
  onInteract: () => void;
}

/**
 * §10.3 — control layer tự viết.
 * KHÔNG dùng `controls` mặc định của thẻ video.
 *
 * Lớp gốc `pointer-events-none`, chỉ thanh trên/dưới mới nhận sự kiện: nhờ vậy
 * chạm vào giữa màn hình luôn rơi xuống lớp cử chỉ của VideoPlayer, kể cả khi
 * control đang hiện (bản cũ bị nền gradient nuốt mất cú chạm).
 */
export function PlayerControls(props: PlayerControlsProps) {
  const {
    playing,
    currentTime,
    duration,
    buffered,
    volume,
    muted,
    fullscreen,
    pip,
    playbackRate,
    levels,
    currentLevel,
    autoLevel,
    title,
    visible,
    compact,
    saveData,
    onInteract,
  } = props;

  const [menuOpen, setMenuOpen] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const pipSupported =
    typeof document !== 'undefined' && Boolean(document.pictureInPictureEnabled) && !compact;

  // Đang kéo thì thanh phải bám ngón tay/con trỏ, không đợi video seek xong.
  const shownTime = scrubTime ?? currentTime;
  const progress = duration > 0 ? (shownTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  const timeFromClientX = useCallback(
    (clientX: number): number => {
      const rect = barRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return 0;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return ratio * duration;
    },
    [duration],
  );

  /* -------------------- kéo thanh tiến độ -------------------- */

  const onBarPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setScrubTime(timeFromClientX(event.clientX));
    onInteract();
  };

  const onBarPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const time = timeFromClientX(event.clientX);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      setScrubTime(time);
      // Tua ngay trong lúc kéo: mượt hơn hẳn so với chỉ tua khi thả tay.
      props.onSeek(time);
    }
    if (event.pointerType === 'mouse') setHoverTime(time);
  };

  const endScrub = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      props.onSeek(timeFromClientX(event.clientX));
    }
    setScrubTime(null);
  };

  /** §13.1 — thanh tiến độ phải điều khiển được bằng bàn phím. */
  const onBarKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 60 : PLAYER.seekStep;
    const map: Record<string, number> = {
      ArrowLeft: -step,
      ArrowRight: step,
      PageDown: -60,
      PageUp: 60,
    };

    if (event.key in map) {
      event.preventDefault();
      props.onSkip(map[event.key]!);
      onInteract();
    } else if (event.key === 'Home') {
      event.preventDefault();
      props.onSeek(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      props.onSeek(duration);
    }
  };

  // Đóng menu cài đặt khi control ẩn đi, tránh menu mồ côi treo giữa màn hình.
  useEffect(() => {
    if (!visible) setMenuOpen(false);
  }, [visible]);

  const autoLabel = (() => {
    if (!autoLevel) return null;
    const active = levels.find((l) => l.index === currentLevel);
    return active ? `Tự động (${active.label})` : 'Tự động';
  })();

  return (
    <div
      className={cn(
        // §10.3 — auto-hide sau 3000ms không cử động chuột, fade 300ms
        'pointer-events-none absolute inset-0 z-[4] flex flex-col justify-between',
        'transition-opacity duration-standard ease-standard',
        visible ? 'opacity-100' : 'opacity-0',
      )}
      data-motion="fade"
      onPointerDown={onInteract}
    >
      <div className="pointer-events-auto bg-gradient-to-b from-bg-base/80 to-transparent p-4 pb-8">
        <p className="truncate text-sm font-medium text-text-primary drop-shadow">{title}</p>
      </div>

      <div className="player-bar pointer-events-auto space-y-1 bg-gradient-to-t from-bg-base/90 to-transparent p-3 pt-8 sm:p-4">
        {/* Progress bar — buffered range riêng, kéo được, có tooltip thời gian */}
        <div
          ref={barRef}
          role="slider"
          tabIndex={0}
          aria-label="Tiến độ phát"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(shownTime)}
          aria-valuetext={`${formatTime(shownTime)} trên ${formatTime(duration)}`}
          onPointerDown={onBarPointerDown}
          onPointerMove={onBarPointerMove}
          onPointerUp={endScrub}
          onPointerCancel={endScrub}
          onPointerLeave={() => setHoverTime(null)}
          onKeyDown={onBarKeyDown}
          // touch-none: không để trình duyệt hiểu nhầm cú kéo ngang là cuộn trang
          className={cn('group/bar relative cursor-pointer touch-none', compact ? 'h-8' : 'h-6')}
        >
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-pill bg-white/25">
            <div
              className="absolute inset-y-0 left-0 rounded-pill bg-[color:var(--text-muted)]"
              style={{ width: `${bufferedPct}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-pill bg-accent"
              style={{ width: `${progress}%` }}
            />
            <div
              className={cn(
                'absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-pill bg-accent',
                'transition-transform duration-micro ease-standard group-hover/bar:scale-100',
                // Trên màn cảm ứng không có hover: núm phải hiện sẵn mới nắm được.
                compact || scrubTime !== null ? 'scale-125' : 'scale-0',
              )}
              style={{ left: `${progress}%` }}
            />
          </div>

          {hoverTime !== null && duration > 0 && (
            <span
              className="pointer-events-none absolute -top-6 -translate-x-1/2 rounded-[3px] bg-bg-base/90 px-1.5 py-0.5 text-[10px] text-text-primary"
              style={{ left: `${(hoverTime / duration) * 100}%` }}
            >
              {formatTime(hoverTime)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <IconButton
            label={playing ? 'Tạm dừng' : 'Phát'}
            size={compact ? 'lg' : 'md'}
            onClick={props.onTogglePlay}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </IconButton>

          {/* Màn cảm ứng đã có chạm đôi để tua — bớt hai nút cho thoáng */}
          {!compact && (
            <>
              <IconButton label="Lùi 10 giây" onClick={() => props.onSkip(-PLAYER.seekStep)}>
                <SkipBackIcon />
              </IconButton>
              <IconButton label="Tiến 10 giây" onClick={() => props.onSkip(PLAYER.seekStep)}>
                <SkipForwardIcon />
              </IconButton>
            </>
          )}

          {/* Volume — slider hiện khi hover icon (§10.3).
              Điện thoại dùng phím cứng chỉnh âm lượng nên chỉ giữ nút tắt tiếng. */}
          <div className="group/vol flex items-center gap-2">
            <IconButton
              label={muted ? 'Bật tiếng' : 'Tắt tiếng'}
              size={compact ? 'lg' : 'md'}
              onClick={props.onToggleMute}
            >
              {muted || volume === 0 ? <VolumeMutedIcon /> : <VolumeIcon />}
            </IconButton>
            {!compact && (
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => props.onVolume(Number(e.target.value))}
                aria-label="Âm lượng"
                className="h-1 w-0 cursor-pointer appearance-none rounded-pill bg-white/30 accent-[color:var(--accent)] opacity-0 transition-[width,opacity] duration-standard ease-standard focus-visible:w-20 focus-visible:opacity-100 group-hover/vol:w-20 group-hover/vol:opacity-100"
              />
            )}
          </div>

          <span
            className={cn(
              'ml-1 tabular-nums text-text-secondary',
              compact ? 'text-[11px]' : 'text-xs',
            )}
          >
            {formatTime(shownTime)}
            <span className="text-text-muted"> / {formatTime(duration)}</span>
          </span>

          <div className="relative ml-auto">
            <IconButton
              label="Cài đặt chất lượng và tốc độ"
              size={compact ? 'lg' : 'md'}
              onClick={() => setMenuOpen((open) => !open)}
              active={menuOpen}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <SettingsIcon />
            </IconButton>

            {menuOpen && (
              <div
                role="menu"
                className="absolute bottom-full right-0 mb-2 max-h-[60vh] w-48 overflow-y-auto overscroll-contain rounded-card bg-bg-elevated/95 p-2 text-sm shadow-elev-2 ring-1 ring-white/10 backdrop-blur-md"
              >
                <p className="px-2 pb-1 text-[10px] uppercase tracking-wider text-text-muted">
                  Tốc độ
                </p>
                <div className="grid grid-cols-3 gap-1">
                  {PLAYER.playbackRates.map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      role="menuitemradio"
                      aria-checked={rate === playbackRate}
                      onClick={() => props.onRate(rate)}
                      className={cn(
                        'rounded-[3px] py-1.5 text-xs transition-colors duration-micro ease-standard',
                        rate === playbackRate
                          ? 'bg-[color:var(--accent-soft)] text-accent-hover'
                          : 'text-text-secondary hover:bg-bg-hover',
                      )}
                    >
                      {rate}×
                    </button>
                  ))}
                </div>

                {levels.length > 0 && (
                  <>
                    <p className="px-2 pb-1 pt-3 text-[10px] uppercase tracking-wider text-text-muted">
                      Chất lượng
                    </p>
                    <QualityOption
                      label={autoLabel ?? 'Tự động'}
                      active={autoLevel}
                      onClick={() => props.onLevel(-1)}
                    />
                    {[...levels].reverse().map((level) => (
                      <QualityOption
                        key={level.index}
                        label={level.label}
                        active={!autoLevel && currentLevel === level.index}
                        onClick={() => props.onLevel(level.index)}
                      />
                    ))}
                    {saveData && (
                      <p className="px-2 pt-2 text-[10px] leading-snug text-text-muted">
                        Đang bật tiết kiệm dữ liệu — chất lượng tự động giới hạn ở mức thấp.
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {pipSupported && (
            <IconButton
              label={pip ? 'Thoát cửa sổ nổi' : 'Cửa sổ nổi'}
              active={pip}
              onClick={props.onTogglePip}
            >
              <PipIcon />
            </IconButton>
          )}

          <IconButton
            label={fullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
            size={compact ? 'lg' : 'md'}
            onClick={props.onToggleFullscreen}
          >
            {fullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
          </IconButton>
        </div>
      </div>
    </div>
  );
}

function QualityOption({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        'block w-full rounded-[3px] px-2 py-1.5 text-left text-xs transition-colors duration-micro ease-standard',
        active
          ? 'bg-[color:var(--accent-soft)] text-accent-hover'
          : 'text-text-secondary hover:bg-bg-hover',
      )}
    >
      {label}
    </button>
  );
}
