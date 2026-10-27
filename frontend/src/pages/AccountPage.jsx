/**
 * Account — the signed-in user's own settings. Today that is the password.
 *
 * Reachable by everyone signed in: every account has a password to change.
 * PATCH /api/auth/password acts only on the token's own user (there is no id
 * in the path or body), so this page grants nothing beyond the caller's own
 * account. It moved here from SettingsPage so that reaching it no longer
 * looks like reaching an administrator page (pentest vuln-2).
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  FormActions,
  FormField,
  FormSection,
  PageHeader,
  toast,
} from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { apiClient } from '@/lib/apiClient';

/**
 * Own account only. The server revokes every older token on success and
 * returns a fresh one for this device: `{ data: { user, accessToken } }`.
 */
async function changePassword(body) {
  const { data } = await apiClient.patch('/auth/password', body);
  return data;
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

  const { replaceToken } = useAuth();

  const save = useMutation({
    mutationFn: changePassword,
    onSuccess: ({ accessToken }) => {
      // Every other session was just signed out; this one carries on with the
      // token the server issued alongside the change.
      replaceToken(accessToken);
      // Cleared rather than left filled — a password sitting in a form after
      // it has been saved is one shoulder-surf away from being read back.
      reset({ currentPassword: '', newPassword: '' });
      toast.success('Password changed', {
        description: 'Other devices have been signed out.',
      });
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

export function AccountPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <PageHeader title="Account" description="Your own sign-in details." />
      <ChangePasswordSection />
    </div>
  );
}
