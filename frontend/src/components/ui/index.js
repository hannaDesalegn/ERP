/**
 * The shared kit — A's folder. B and C import from here, never edit it.
 * Prop signatures are locked by docs/components.md; implementation is not.
 *
 * Shipped: Button, FormField, FormSelect, StatusBadge, PageHeader, DataTable,
 *          Modal, ConfirmDialog, toast.
 * Still to come: FormMoney, FormDate, FormCheckbox, FormTextarea, FormSection,
 *          FormRow, FormActions, Drawer, KPICard, EmptyState, Skeleton,
 *          DateRangePicker.
 */

export { Button } from './Button';
export { ConfirmDialog } from './ConfirmDialog';
export { DataTable } from './DataTable';
export { FormField } from './FormField';
export { FormSelect } from './FormSelect';
export { Modal } from './Modal';
export { PageHeader } from './PageHeader';
export { StatusBadge } from './StatusBadge';
// Toaster is mounted once in providers.jsx; modules only ever import `toast`.
export { toast, Toaster } from './toast';
