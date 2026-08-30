/**
 * Settings — owned by A.
 *
 * Reachable by anyone signed in, unlike Users: every account has a password to
 * change, and that form lives here. The company, invoicing and inventory
 * sections are gated on settings.edit instead, so a manager or staff member
 * opening this page sees the password form and nothing else. The route used to
 * carry RequireRole admin, which made the password form unreachable for exactly
 * the people most likely to need it.
 *
 * The first real use of FormSection, FormRow and FormActions: three sections,
 * fields paired into rows, one action bar at the foot. If this page reads as
 * plain layout with no bespoke CSS, those four components did their job.
 *
 * A singleton resource, so there is no list, no id and no create — GET to load,
 * PATCH to save, and the form is the whole page.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  FormActions,
  FormField,
  FormRow,
  FormSection,
  FormSelect,
  PageHeader,
  Skeleton,
  toast,
} from '@/components/ui';
import { Can, useCan } from '@/auth/AuthContext';
import { apiClient } from '@/lib/apiClient';
import { formatDateTime } from '@/lib/format';

// ── API ──────────────────────────────────────────────────────────────────────

const RESOURCE = '/settings';

const settingsKeys = {
  all: ['settings'],
  detail: () => ['settings', 'detail'],
};

async function fetchSettings() {
  const { data } = await apiClient.get(RESOURCE);
  return data;
}

async function updateSettings(body) {
  const { data } = await apiClient.patch(RESOURCE, body);
  return data;
}

/** Own account only — the endpoint takes the user from the token, not a body. */
async function changePassword(body) {
  const { data } = await apiClient.patch('/auth/password', body);
  return data;
}

// ── Validation ───────────────────────────────────────────────────────────────
// Zod here is UX; the server re-validates all of it (docs/security-notes.md §2).
// updatedAt is absent on purpose — it is server-managed and the form never
// sends it.

/** Optional address lines are null, never "" — docs/entities.md. */
const optionalLine = z
  .string()
  .trim()
  .max(255)
  .nullable()
  .or(z.literal('').transform(() => null));

const settingsSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(1, 'Enter a company name.')
    .max(255, 'Name is too long.'),

  companyAddress: z.object({
    line1: z.string().trim().min(1, 'Enter the first address line.').max(255),
    line2: optionalLine,
    city: z.string().trim().min(1, 'Enter a city.').max(255),
    region: optionalLine,
    country: z
      .string()
      .trim()
      .regex(/^[A-Z]{2}$/, 'Use the two-letter country code, e.g. ET.'),
    postalCode: optionalLine,
  }),

  defaultCurrency: z.string().min(1, 'Choose a currency.'),

  // invalid_type_error catches the NaN that an emptied number input produces
  // under valueAsNumber, so it reads as a sentence rather than a Zod type error.
  defaultPaymentTermsDays: z
    .number({ invalid_type_error: 'Enter a whole number of days.' })
    .int('Enter a whole number of days.')
    .min(0, 'Must be zero or greater.')
    .max(365, 'Must be 365 days or fewer.'),

  invoiceNumberPrefix: z
    .string()
    .trim()
    .regex(/^[A-Z]{2,5}$/, 'Two to five capital letters, e.g. INV.'),

  defaultReorderLevel: z
    .number({ invalid_type_error: 'Enter a whole number.' })
    .int('Enter a whole number.')
    .min(0, 'Must be zero or greater.'),
});

/**
 * What the select offers. The server independently rejects anything outside its
 * own supported list — this is the menu, not the rule.
 */
const CURRENCY_OPTIONS = [
  { value: 'ETB', label: 'ETB — Ethiopian birr' },
  { value: 'USD', label: 'USD — US dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
];

/** The form's shape, from a settings resource. One place, used twice. */
function toFormValues(settings) {
  return {
    companyName: settings.companyName,
    companyAddress: { ...settings.companyAddress },
    defaultCurrency: settings.defaultCurrency,
    defaultPaymentTermsDays: settings.defaultPaymentTermsDays,
    invoiceNumberPrefix: settings.invoiceNumberPrefix,
    defaultReorderLevel: settings.defaultReorderLevel,
  };
}

/**
 * The form itself, mounted only once settings have loaded so defaultValues are
 * the real ones. Same reasoning as the Users drawer: no reset effect to keep in
 * step with a second copy of the defaults.
 */
function SettingsForm({ settings }) {
  const queryClient = useQueryClient();

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(settingsSchema),
    defaultValues: toFormValues(settings),
  });

  const save = useMutation({
    mutationFn: updateSettings,
    onSuccess: (saved) => {
      queryClient.setQueryData(settingsKeys.detail(), saved);
      // Re-seed the form from what the server stored, so the page is clean
      // rather than dirty-with-identical-values after a save.
      reset(toFormValues(saved));
      toast.success('Settings saved');
    },
    onError: (error) => {
      // 422 carries `fields`, already dotted for nested names, so setError
      // takes them as they arrive. Anything else is one toast.
      if (error.fields) {
        Object.entries(error.fields).forEach(([name, message]) =>
          setError(name, { message }),
        );
        return;
      }
      toast.error('Could not save settings', { description: error.message });
    },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => save.mutate(values))}
      className="flex flex-col gap-6"
    >
      <FormSection
        title="Company"
        description="Appears on invoices and purchase orders."
      >
        <FormField
          label="Company name"
          required
          error={errors.companyName?.message}
          {...register('companyName')}
        />

        <FormRow>
          <FormField
            label="Address line 1"
            required
            error={errors.companyAddress?.line1?.message}
            {...register('companyAddress.line1')}
          />
          <FormField
            label="Address line 2"
            error={errors.companyAddress?.line2?.message}
            {...register('companyAddress.line2')}
          />
        </FormRow>

        <FormRow columns={3}>
          <FormField
            label="City"
            required
            error={errors.companyAddress?.city?.message}
            {...register('companyAddress.city')}
          />
          <FormField
            label="Region"
            error={errors.companyAddress?.region?.message}
            {...register('companyAddress.region')}
          />
          <FormField
            label="Postal code"
            error={errors.companyAddress?.postalCode?.message}
            {...register('companyAddress.postalCode')}
          />
        </FormRow>

        <FormRow>
          <FormField
            label="Country"
            required
            hint="Two-letter code, e.g. ET."
            error={errors.companyAddress?.country?.message}
            {...register('companyAddress.country')}
          />
        </FormRow>
      </FormSection>

      <FormSection
        title="Invoicing"
        description="Defaults applied to new customers and documents."
      >
        <FormRow>
          {/* Controller, not register: FormSelect renders a controlled
              <select>, and register supplies an onChange but no value.
              docs/components.md § Forms. */}
          <Controller
            name="defaultCurrency"
            control={control}
            render={({ field }) => (
              <FormSelect
                label="Default currency"
                name={field.name}
                value={field.value ?? ''}
                onChange={field.onChange}
                options={CURRENCY_OPTIONS}
                required
                error={errors.defaultCurrency?.message}
                hint="Currency is still stored per document; this only seeds new ones."
              />
            )}
          />

          <FormField
            label="Invoice number prefix"
            required
            hint="The INV in INV-2026-0117."
            error={errors.invoiceNumberPrefix?.message}
            {...register('invoiceNumberPrefix')}
          />
        </FormRow>

        <FormRow>
          {/* valueAsNumber, so the schema and the API get a number rather than
              the string an input always yields. */}
          <FormField
            label="Default payment terms (days)"
            type="number"
            required
            hint="Seeds a new customer's payment terms."
            error={errors.defaultPaymentTermsDays?.message}
            {...register('defaultPaymentTermsDays', { valueAsNumber: true })}
          />
        </FormRow>
      </FormSection>

      <FormSection
        title="Inventory"
        description="Defaults applied to new products."
      >
        <FormRow>
          <FormField
            label="Default reorder level"
            type="number"
            required
            hint="New products start at this level; the low-stock badge uses each product's own."
            error={errors.defaultReorderLevel?.message}
            {...register('defaultReorderLevel', { valueAsNumber: true })}
          />
        </FormRow>
      </FormSection>

      <div className="flex flex-col gap-2">
        <FormActions
          submitLabel="Save settings"
          // Cancel on a settings page means discard edits, not navigate away —
          // there is nowhere to go back to, so it only appears once there is
          // something to discard.
          onCancel={isDirty ? () => reset() : undefined}
          loading={save.isPending}
        />
        <p className="text-right text-xs text-text-muted">
          Last saved {formatDateTime(settings.updatedAt)}
        </p>
      </div>
    </form>
  );
}

/**
 * Mirrors the server's rule: length only, no composition requirements. The
 * server additionally refuses a short list of common passwords — not duplicated
 * here, because a blocklist kept in two places is one that disagrees with
 * itself. That rejection arrives as a 422 on `newPassword` and lands on the
 * input like any other field error.
 */
const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  newPassword: z.string().min(8, 'Use at least 8 characters.'),
});

/**
 * Change password — every account has one, so this section has no permission
 * gate. It is its own form rather than part of the settings form: a different
 * endpoint, a different resource, and saving one must not save the other.
 */
function ChangePasswordSection() {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });

  const save = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      // Cleared rather than left filled — a password sitting in a form after
      // it has been saved is one shoulder-surf away from being read back.
      reset({ currentPassword: '', newPassword: '' });
      toast.success('Password changed');
    },
    onError: (error) => {
      if (error.fields) {
        Object.entries(error.fields).forEach(([name, message]) =>
          setError(name, { message }),
        );
        return;
      }
      // A wrong current password is a 401 with no `fields`. It belongs on the
      // input that was wrong rather than in a toast that does not say which of
      // the two boxes to fix.
      if (error.status === 401) {
        setError('currentPassword', { message: error.message });
        return;
      }
      toast.error('Could not change password', { description: error.message });
    },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => save.mutate(values))}
      className="flex flex-col gap-6"
    >
      <FormSection
        title="Change password"
        description="Changes only your own sign-in password."
      >
        <FormField
          label="Current password"
          type="password"
          required
          autoComplete="current-password"
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />

        <FormField
          label="New password"
          type="password"
          required
          autoComplete="new-password"
          hint="At least 8 characters. Length matters more than symbols — a short phrase works well."
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
      </FormSection>

      <FormActions submitLabel="Change password" loading={save.isPending} />
    </form>
  );
}

export function SettingsPage() {
  // The endpoint requires settings.view and answers 403 without it. Firing it
  // for a manager or staff member would put an error banner above a password
  // form that works perfectly well, so the request is not made at all.
  const canViewSettings = useCan('settings.view');

  const { data, isLoading, error } = useQuery({
    queryKey: settingsKeys.detail(),
    queryFn: fetchSettings,
    enabled: canViewSettings,
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <PageHeader
        title="Settings"
        description="Company details and the defaults new records start from."
      />

      {/* The company, invoicing and inventory sections. Absent rather than
          disabled for anyone without settings.edit — a form you may look at but
          never save is worse than no form. The query above does not run for
          them either, so there is no request behind this to fail. */}
      <Can permission="settings.edit">
        {error && (
          // Server `message` only — never a raw body. Same rule as DataTable's
          // error row; this page has no DataTable to borrow it from.
          <div
            role="alert"
            className="rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-danger"
          >
            {error.message ?? 'Could not load settings. Try again.'}
          </div>
        )}

        {isLoading && <Skeleton variant="form" />}

        {/* Mounted only once data exists, so defaultValues are the real values. */}
        {data && <SettingsForm settings={data} />}
      </Can>

      {/* No gate — everyone signed in has a password of their own. */}
      <ChangePasswordSection />
    </div>
  );
}
