/**
 * Form actions — owned by A. The button row at the foot of a form.
 *
 * @param {object} props
 * @param {string} [props.submitLabel]
 * @param {() => void} [props.onCancel] omit and no Cancel renders
 * @param {boolean} [props.loading]
 */

import { cn } from '@/lib/cn';

import { Button } from './Button';

export function FormActions({
  submitLabel = 'Save',
  onCancel,
  loading = false,
  className,
}) {
  return (
    // Cancel first, submit last — same order as ConfirmDialog's footer, so the
    // primary action is always the rightmost thing in the kit.
    <div
      className={cn('flex flex-wrap items-center justify-end gap-2', className)}
    >
      {onCancel && (
        // Explicitly type="button". A <button> inside a <form> with no type
        // submits it, which would make Cancel save. Button already defaults to
        // "button", and this stays written down because the day that default
        // changes is the day Cancel starts saving.
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
      )}

      {/* type="submit" so Enter in any field and a click both go through the
          form's own onSubmit — no onClick handler to keep in step with it. */}
      <Button type="submit" loading={loading}>
        {submitLabel}
      </Button>
    </div>
  );
}
