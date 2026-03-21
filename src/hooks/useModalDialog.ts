import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

function getFocusable(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];

  const elements = container.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );

  return Array.from(elements).filter((element) => {
    if (element.getAttribute('aria-hidden') === 'true') return false;
    if (element.tabIndex < 0) return false;
    return !element.hasAttribute('disabled');
  });
}

export function useModalDialog(
  isOpen: boolean,
  onClose: () => void,
  initialFocusRef?: RefObject<HTMLElement | null>,
) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    const frame = window.requestAnimationFrame(() => {
      const firstTarget =
        initialFocusRef?.current ??
        getFocusable(containerRef.current)[0] ??
        containerRef.current;

      firstTarget?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = getFocusable(containerRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        containerRef.current?.focus();
        return;
      }

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [initialFocusRef, isOpen, onClose]);

  return containerRef;
}
