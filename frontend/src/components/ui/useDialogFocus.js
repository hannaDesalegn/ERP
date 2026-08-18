/**
 * Dialog behaviour — owned by A. Kit-internal, not exported from index.js.
 *
 * Focus trap, Escape to close, scroll lock and focus return, shared by Modal
 * and Drawer so the two cannot drift apart.
 */

import { useEffect, useRef } from 'react';

/** Everything that can hold focus inside a dialog. */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * @param {boolean} open
 * @param {() => void} onClose
 * @param {React.RefObject<HTMLElement>} ref the dialog element
 */
export function useDialogFocus(open, onClose, ref) {
  // Held in a ref so the effect below depends only on `open`. Without this, a
  // parent passing an inline `onClose={() => …}` would re-run the effect on
  // every render, which yanks focus back to the trigger mid-interaction.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;

    // Remember who opened us, so focus can go back there on close.
    const previouslyFocused = document.activeElement;

    // Save and restore rather than clearing to '': hardcoding the reset is the
    // classic bug that strips an overflow someone else set.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus the first control, or the dialog itself if it has none.
    const focusables = () => [
      ...(ref.current?.querySelectorAll(FOCUSABLE) ?? []),
    ];
    (focusables()[0] ?? ref.current)?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current?.();
        return;
      }

      if (event.key !== 'Tab') return;

      // Focus trap: wrap around at both ends rather than escaping to the page
      // behind, which is still rendered and still focusable.
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    // Capture phase, so the dialog sees Escape before anything underneath.
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, ref]);
}
