/**
 * Login — owned by A.
 *
 * Renders outside AppShell (see app/router.jsx): no sidebar, no topbar, no
 * breadcrumbs. AuthLayout owns the poster half; this file owns the form half
 * and nothing else.
 *
 * The form is the kit's FormField and Button, not bespoke inputs. If the login
 * screen needs an input the kit can't render, that's a gap in the kit — the fix
 * goes in components/ui, not here.
 *
 * TODO(A), week 2: replace the fake delay with POST /auth/login, put the access
 * token in memory via AuthProvider, and redirect to the `from` location the
 * route guard stashed. docs/api-contract.md §3, docs/security-notes.md §3.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { Button, FormField } from '@/components/ui';
import { AuthLayout } from '@/layouts/AuthLayout';

/**
 * Login validation is UX only — it stops a pointless round trip on an empty
 * field. The server decides who is allowed in, and must answer identically for
 * an unknown email and a wrong password (docs/security-notes.md §4).
 *
 * Deliberately no length or complexity rule on the password: the client does
 * not know the server's policy, and guessing it locks out a valid credential.
 */
const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter your email address.')
    .email('Must be a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
  remember: z.boolean(),
});

/** Entrance delays, ms. The last one starts at 310 and runs 280 — done at 590. */
const DELAY = {
  heading: 140,
  email: 200,
  password: 250,
  options: 290,
  submit: 310,
};

export function LoginPage() {
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', remember: false },
  });

  async function onSubmit(_values) {
    // Stand-in for the real request, so the loading state and the disabled
    // button are exercised now rather than discovered later.
    await new Promise((resolve) => {
      setTimeout(resolve, 1200);
    });
    navigate('/', { replace: true });
  }

  return (
    <AuthLayout>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-3.5"
        noValidate
      >
        {/* mb-1 rather than a wider gap on the form: the heading belongs to the
            fields below it, so the block reads as one unit against the poster. */}
        <div
          className="auth-rise mb-1 flex flex-col gap-1"
          style={{ animationDelay: `${DELAY.heading}ms` }}
        >
          <h1 className="text-xl font-semibold text-text">Sign in</h1>
          <p className="text-sm text-text-muted">
            Use your work account to continue.
          </p>
        </div>

        {/* The animation and its delay have to sit on the same element, so each
            field gets a wrapper rather than a className on FormField. */}
        <div
          className="auth-rise"
          style={{ animationDelay: `${DELAY.email}ms` }}
        >
          <FormField
            label="Email"
            type="email"
            required
            autoComplete="username"
            placeholder="you@example-erp.test"
            error={errors.email?.message}
            {...register('email')}
          />
        </div>

        <div
          className="auth-rise"
          style={{ animationDelay: `${DELAY.password}ms` }}
        >
          <FormField
            label="Password"
            type="password"
            required
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />
        </div>

        <div
          className="auth-rise flex items-center justify-between gap-3"
          style={{ animationDelay: `${DELAY.options}ms` }}
        >
          {/* TODO(A): swap for the kit's FormCheckbox when it ships — it is on
              the list in components/ui/index.js. Inline until then; one
              checkbox is not a reason to fork the kit's input styling. */}
          <label className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              className="h-4 w-4 rounded-sm border-border accent-[color:var(--color-primary)]"
              {...register('remember')}
            />
            Remember me
          </label>

          {/* TODO(A): route exists from week 2; until then this lands on 404. */}
          <Link
            to="/forgot-password"
            className="rounded-sm text-sm text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <div
          className="auth-rise"
          style={{ animationDelay: `${DELAY.submit}ms` }}
        >
          <Button
            type="submit"
            size="lg"
            loading={isSubmitting}
            className="w-full"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
