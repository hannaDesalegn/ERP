import { Button } from './Button';
import { Modal } from './Modal';

/**
 * Built on Modal, so focus trapping, Escape and focus restore come for free —
 * there is deliberately only one implementation of that behaviour in the kit.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {() => void} props.onConfirm
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {string} [props.confirmLabel]
 * @param {string} [props.cancelLabel]
 * @param {'primary'|'destructive'} [props.variant]
 * @param {boolean} [props.loading]
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  loading = false,
}) {
  return (
    <Modal
      open={open}
      // While the action is in flight, closing would leave the user unsure
      // whether it happened. Escape and the backdrop are inert until it settles.
      onClose={loading ? () => {} : onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {/* The description in the header carries the message; the body stays
          empty unless a caller needs more room. */}
      {null}
    </Modal>
  );
}
