/**
 * Login smoke test — owned by A.
 *
 * Not a test of Zod or React Hook Form; both are tested by their authors. This
 * covers the wiring between them and the kit: that an empty submit surfaces
 * both field errors, that the button reports its loading state, and that a
 * valid submit ends up at `/`.
 *
 * TODO(A), week 2: when the fake delay becomes POST /auth/login, this test
 * grows an MSW handler and a case for 401 — the failure path is the one that
 * actually matters, and it does not exist yet to test.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { LoginPage } from './LoginPage';

/** `/` stands in for the app shell — this test does not care what renders. */
function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<p>signed in</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  it('renders the form and the poster headline', () => {
    renderLogin();

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    expect(screen.getByLabelText(/Email/)).toBeVisible();
    expect(screen.getByLabelText(/Password/)).toBeVisible();
    expect(screen.getByLabelText('Remember me')).not.toBeChecked();

    // The headline is three separate lines because one of them is stroked.
    expect(screen.getByText('Reliability')).toBeVisible();
    expect(screen.getByText('at every')).toBeVisible();
    expect(screen.getByText('milestone')).toBeVisible();
  });

  it('blocks an empty submit and shows both field errors', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter your email address.')).toBeVisible();
    expect(screen.getByText('Enter your password.')).toBeVisible();
    // Still on the form — nothing navigated.
    expect(screen.queryByText('signed in')).not.toBeInTheDocument();
  });

  it('rejects a malformed email', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/Email/), 'not-an-email');
    await user.type(screen.getByLabelText(/Password/), 'hunter2');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByText('Must be a valid email address.'),
    ).toBeVisible();
  });

  it('signs in and lands on /', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText(/Email/), 'ops@example-erp.test');
    await user.type(screen.getByLabelText(/Password/), 'hunter2');
    await user.click(screen.getByLabelText('Remember me'));
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    // The button must report itself busy for the whole fake round trip, and
    // must not be clickable twice.
    const submitting = await screen.findByRole('button', {
      name: 'Signing in…',
    });
    expect(submitting).toBeDisabled();

    // Longer than the 1.2s fake delay, short enough to fail fast if it hangs.
    await waitFor(() => expect(screen.getByText('signed in')).toBeVisible(), {
      timeout: 3000,
    });
  });
});
