/**
 * Drawer — owned by A. A dialog anchored to an edge instead of centred.
 *
 * Focus trap, Escape, scroll lock and focus return come from useDialogFocus,
 * the same hook Modal uses.
 */

import { X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/cn';

import { useDialogFocus } from './useDialogFocus';

/** Same scale as Modal — size="lg" should not mean two widths in one kit. */
const SIZES = {
  sm: 'md:max-w-sm',
  md: 'md:max-w-md',
  lg: 'md:max-w-2xl',
  xl: 'md:max-w-4xl',
};

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} props.title
 * @param {'right'|'left'} [props.side]
 * @param {'sm'|'md'|'lg'|'xl'} [props.size]
 */
export function Drawer({
  open,
  onClose,
  title,
  side = 'right',
  size = 'md',
  children,
}) {
  const dialogRef = useRef(null);
  const titleId = `${useId()}-title`;

  useDialogFocus(open, onClose, dialogRef);

  // Mount off-screen, then flip on the next frame so the transition has two
  // states to move between. A CSS transition cannot animate a fresh mount.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!open) {
      setEntered(false);
      return undefined;
    }
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  if (!open) return null;

  const closed = side === 'right' ? 'translate-x-full' : '-translate-x-full';

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      {/* A real button so click, Enter and screen readers all work. tabIndex
          -1 keeps it out of the trap's tab cycle. */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close drawer"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'relative flex h-full w-full flex-col bg-surface shadow-lg',
          // Full width below 768px regardless of size; the cap starts at md.
          SIZES[size],
          side === 'right'
            ? 'ml-auto border-l border-border'
            : 'mr-auto border-r border-border',
          // motion-safe, not the global rule — that clamps the duration rather
          // than removing the animation. Same call as Skeleton.
          'motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out',
          entered ? 'translate-x-0' : closed,
        )}
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-border px-4 py-3">
          <h2
            id={titleId}
            className="min-w-0 flex-1 text-base font-semibold text-text"
          >
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md p-1 text-text-muted hover:bg-bg hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X size={16} />
          </button>
        </header>

        {/* Only the body scrolls, so the title stays put. */}
        <div className="flex-1 overflow-y-auto px-4 py-3 text-sm text-text">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
