import { X } from 'lucide-react';
import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/cn';

import { useDialogFocus } from './useDialogFocus';

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {'sm'|'md'|'lg'|'xl'} [props.size]
 * @param {React.ReactNode} [props.footer]
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  footer,
  children,
}) {
  const dialogRef = useRef(null);
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;

  useDialogFocus(open, onClose, dialogRef);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* A real button so click, Enter and screen readers all work. tabIndex
          -1 keeps it out of the trap's tab cycle. */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[85vh] w-full flex-col rounded-lg border border-border bg-surface shadow-lg',
          SIZES[size],
        )}
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-border px-4 py-3">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h2 id={titleId} className="text-base font-semibold text-text">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="text-sm text-text-muted">
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md p-1 text-text-muted hover:bg-bg hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X size={16} />
          </button>
        </header>

        {/* Only the body scrolls, so the title and actions stay put. Skipped
            entirely when there are no children, so a message-only dialog like
            ConfirmDialog doesn't render an empty padded gap. */}
        {children != null && (
          <div className="flex-1 overflow-y-auto px-4 py-3 text-sm text-text">
            {children}
          </div>
        )}

        {footer && (
          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
