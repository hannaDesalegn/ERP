/**
 * The shared kit — A's folder. B and C import from here, never edit it.
 * Prop signatures are locked by docs/components.md; implementation is not.
 *
 * Shipped: Button, FormField, FormSelect, StatusBadge, PageHeader, DataTable,
 *          Modal, ConfirmDialog, toast, EmptyState, Skeleton, Drawer, KPICard,
 *          FormMoney, FormCheckbox, FormTextarea, FormDate, FormSection,
 *          FormRow, FormActions.
 * Still to come: DateRangePicker.
 */

export { Button } from './Button';
export { ConfirmDialog } from './ConfirmDialog';
export { DataTable } from './DataTable';
export { Drawer } from './Drawer';
export { EmptyState } from './EmptyState';
export { FormActions } from './FormActions';
export { FormCheckbox } from './FormCheckbox';
export { FormDate } from './FormDate';
export { FormField } from './FormField';
export { FormMoney } from './FormMoney';
export { FormRow } from './FormRow';
export { FormSection } from './FormSection';
export { FormSelect } from './FormSelect';
export { FormTextarea } from './FormTextarea';
export { KPICard } from './KPICard';
export { Modal } from './Modal';
export { PageHeader } from './PageHeader';
export { Skeleton } from './Skeleton';
export { StatusBadge } from './StatusBadge';
// Toaster is mounted once in providers.jsx; modules only ever import `toast`.
export { toast, Toaster } from './toast';
