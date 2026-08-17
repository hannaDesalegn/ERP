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
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { useAuth } from '@/auth/AuthContext';
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
});

/** Entrance delays, ms. The last one starts at 310 and runs 280 — done at 590. */
const DELAY = {
  heading: 140,
  email: 200,
  password: 250,
  forgot: 290,
  submit: 310,
};

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Where ProtectedRoute bounced the user from, or the app root.
  const from = location.state?.from ?? '/';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const loginMutation = useMutation({
    // login takes one object, not two positional arguments.
    mutationFn: ({ email, password }) => login({ email, password }),
    onSuccess: () => navigate(from, { replace: true }),
  });

  return (
    <AuthLayout>
      <form
        onSubmit={handleSubmit((values) => loginMutation.mutate(values))}
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

        {/* Server-side failure. Field-level errors stay on their inputs, and
            no auth-rise here — this appears long after the entrance runs. */}
        {loginMutation.isError && (
          <p
            role="alert"
            className="rounded-md border border-danger bg-danger-bg px-3 py-2 text-sm text-danger"
          >
            {loginMutation.error.message}
          </p>
        )}

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
          className="auth-rise flex justify-end"
          style={{ animationDelay: `${DELAY.forgot}ms` }}
        >
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
          {/* Button treats loading as disabled, so pending blocks a second submit. */}
          <Button
            type="submit"
            size="lg"
            loading={loginMutation.isPending}
            className="w-full"
          >
            {loginMutation.isPending ? 'Signing in…' : 'Sign in'}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
