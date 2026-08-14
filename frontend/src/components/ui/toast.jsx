/**
 * Toasts — imperative on purpose.
 *
 *   import { toast } from '@/components/ui/toast';
 *   toast.success('Customer saved');
 *   toast.error('Could not save customer', { description: err.message });
 *
 * No hook, no context, no provider wiring in module code. The store below lives
 * outside React, so any file can call `toast.*` — including a mutation's
 * onError, which is nowhere near a component. A single <Toaster /> mounted in
 * providers.jsx subscribes and renders.
 *
 * Copy rule: the toast uses the same verb as the button that caused it.
 * Button says "Publish" → toast says "Published". Never "Success!".
 * docs/components.md § Overlays.
 */

import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/cn';

const DEFAULT_DURATION = 5000;

let items = [];
let nextId = 0;
const listeners = new Set();

function emit() {
  // New array each time so subscribers actually re-render.
  items = [...items];
  listeners.forEach((listener) => listener(items));
}

function dismiss(id) {
  items = items.filter((item) => item.id !== id);
  emit();
}

/**
 * @param {'success'|'error'|'warning'|'info'} variant
 * @param {string} title
 * @param {{ description?: string, duration?: number }} [options]
 * @returns {number} the toast id, for dismissing it early
 */
function push(variant, title, options = {}) {
  const id = (nextId += 1);
  const duration = options.duration ?? DEFAULT_DURATION;

  items = [
    ...items,
    { id, variant, title, description: options.description ?? null },
  ];
  emit();

  // duration: 0 means "stay until dismissed".
  if (duration > 0) setTimeout(() => dismiss(id), duration);

  return id;
}

export const toast = {
  success: (title, options) => push('success', title, options),
  error: (title, options) => push('error', title, options),
  warning: (title, options) => push('warning', title, options),
  info: (title, options) => push('info', title, options),
  dismiss,
};

const VARIANT_CLASSES = {
  success: 'border-success bg-success-bg text-success',
  error: 'border-danger bg-danger-bg text-danger',
  warning: 'border-warning bg-warning-bg text-warning',
  info: 'border-info bg-info-bg text-info',
};

/** Mounted once, in providers.jsx. Modules never render this. */
export function Toaster() {
  const [toasts, setToasts] = useState(items);

  useEffect(() => {
    listeners.add(setToasts);
    // Catch anything queued between module load and mount.
    setToasts(items);
    return () => listeners.delete(setToasts);
  }, []);

  return createPortal(
    <ol
      aria-live="polite"
      aria-label="Notifications"
      // Above the modal layer (z-50) so a toast fired from a dialog is visible.
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2"
    >
      {toasts.map((item) => (
        <li
          key={item.id}
          // Errors interrupt; everything else waits for a pause in speech.
          role={item.variant === 'error' ? 'alert' : 'status'}
          className={cn(
            'pointer-events-auto flex items-start gap-2 rounded-md border px-3 py-2 shadow-md',
            VARIANT_CLASSES[item.variant],
          )}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-sm font-medium">{item.title}</p>
            {item.description && (
              <p className="text-xs opacity-90">{item.description}</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => dismiss(item.id)}
            aria-label="Dismiss notification"
            className="shrink-0 rounded-sm p-0.5 opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
          >
            <X size={14} />
          </button>
        </li>
      ))}
    </ol>,
    document.body,
  );
}
