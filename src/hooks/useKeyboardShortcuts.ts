'use client';

import { useEffect, useRef } from 'react';

export type ShortcutMap = Record<string, (event: KeyboardEvent) => void>;

interface Options {
  enabled?: boolean;
  /** Mặc định `window`. Truyền element khi muốn giới hạn phạm vi (modal, player). */
  target?: HTMLElement | null;
  /** Bỏ qua khi con trỏ đang ở input/textarea/contenteditable. Mặc định true. */
  ignoreWhenTyping?: boolean;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/**
 * Đăng ký phím tắt (§10.4, §13.1).
 * Key dùng giá trị `event.key`, ví dụ: ' ', 'ArrowLeft', 'f', 'Escape'.
 */
export function useKeyboardShortcuts(shortcuts: ShortcutMap, options: Options = {}) {
  const { enabled = true, target, ignoreWhenTyping = true } = options;

  // Giữ map trong ref để listener không phải gắn lại mỗi render.
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!enabled) return;

    const node: HTMLElement | Window = target ?? window;

    const onKeyDown = (event: Event) => {
      const e = event as KeyboardEvent;
      if (ignoreWhenTyping && isTypingTarget(e.target)) return;
      // Không cướp phím tắt hệ thống (Ctrl/Cmd + ...).
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const handler = shortcutsRef.current[e.key] ?? shortcutsRef.current[e.key.toLowerCase()];
      if (!handler) return;

      e.preventDefault();
      handler(e);
    };

    node.addEventListener('keydown', onKeyDown);
    return () => node.removeEventListener('keydown', onKeyDown);
  }, [enabled, target, ignoreWhenTyping]);
}
