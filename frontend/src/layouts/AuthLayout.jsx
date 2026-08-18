/**
 * Auth layout — owned by A.
 *
 * The one screen in this app allowed to be loud. Everything inside AppShell is
 * deliberately quiet — dense tables, 40px rows, no decoration — so the whole
 * visual budget is spent here, before the user is looking at data.
 *
 *   ┌───────────────────────┬──────────────────┐
 *   │ poster panel  (55%)   │ form panel (45%) │   ≥900px
 *   │ ink, display type     │ surface, kit UI  │
 *   └───────────────────────┴──────────────────┘
 *
 *   ┌──────────────────────────────────────────┐
 *   │ poster, collapsed to a banner            │   <900px
 *   ├──────────────────────────────────────────┤
 *   │ form                                     │
 *   └──────────────────────────────────────────┘
 *
 * 900px is a one-off breakpoint (`min-[900px]:`) rather than a new entry in
 * tailwind.config.js — the whole app shares that config, and this threshold is
 * about one headline's line length, not about the app's layout.
 *
 * Reusable on purpose: forgot-password and reset-password land here too, so the
 * poster copy is props with defaults rather than hardcoded JSX.
 */

// Anton, self-hosted through @fontsource — an npm package we bundle from our
// own origin, not a Google Fonts <link>. tokens.css §Type says no font CDN, and
// a third-party origin on the login page is the last place we'd want one.
import '@fontsource/anton/400.css';

import '@/styles/auth.css';
import { cn } from '@/lib/cn';

/**
 * Headline lines, top to bottom. `outline` renders the line as a stroke instead
 * of a fill; the two treatments overlap slightly, which is the whole effect.
 */
const DEFAULT_HEADLINE = [
  { text: 'Reliability', outline: false },
  { text: 'at every', outline: true },
  { text: 'milestone', outline: false },
];

const DEFAULT_FOOTNOTE =
  'Orders, stock, invoicing, and the paperwork in between — one system, one set of numbers.';

/**
 * @param {object} props
 * @param {{ text: string, outline?: boolean }[]} [props.headline]
 * @param {string} [props.footnote] one quiet line, bottom of the poster panel
 * @param {React.ReactNode} props.children the form panel's contents
 */
export function AuthLayout({
  headline = DEFAULT_HEADLINE,
  footnote = DEFAULT_FOOTNOTE,
  children,
}) {
  return (
    <div className="flex min-h-screen flex-col bg-bone min-[900px]:flex-row">
      <section
        className={cn(
          'auth-poster relative isolate overflow-hidden bg-ink',
          // pb-10 rather than py-7: the banner's arc eats into the bottom edge.
          'flex flex-col gap-6 px-6 pb-10 pt-7',
          // Below 900px this is a banner, not a panel: it gives up the footnote
          // and most of its height so the form is above the fold on a phone.
          'min-[900px]:w-[59%] min-[900px]:shrink-0 min-[900px]:justify-between',
          'min-[900px]:py-10 min-[900px]:pl-[clamp(2rem,4.5vw,4.5rem)]',
          // The right padding clears the bulge, so no content can land in the
          // part of the box the clip removes.
          'min-[900px]:pr-[clamp(3rem,6vw,7rem)]',
        )}
      >
        <p
          className="auth-rise relative text-xs font-semibold uppercase tracking-[0.32em] text-white"
          style={{ animationDelay: '0ms' }}
        >
          ERP
        </p>

        {/* Not an <h1>: the page's heading is "Sign in", on the form side. This
            is poster copy, and it reads fine to a screen reader as one line. */}
        <p
          className={cn(
            // 0.88, not 0.82: at the tighter leading the stroked line was
            // crushed between its neighbours and stopped reading as type.
            'relative flex flex-col font-display uppercase leading-[0.88] tracking-[-0.01em]',
            'text-[clamp(2.75rem,11vw,4.5rem)]',
            'min-[900px]:flex-1 min-[900px]:justify-center min-[900px]:text-[clamp(3rem,9vw,10rem)]',
          )}
        >
          {headline.map((line, index) => (
            <span
              key={line.text}
              className={cn(
                'auth-rise block',
                line.outline ? 'auth-outline' : 'text-white',
                // The overlap. Lines pull up into each other by a hair and the
                // stroked one sits slightly inboard — editorial, not a stack of
                // centred web-hero text. Enough to interlock, not so much that
                // the stroke collides with the solid line above it.
                index > 0 && '-mt-[0.02em]',
                line.outline && 'ml-[0.06em]',
              )}
              style={{ animationDelay: `${index * 60}ms` }}
            >
              {line.text}
            </span>
          ))}
        </p>

        {footnote && (
          <p
            className="auth-rise relative hidden max-w-md border-l border-white/20 pl-3.5 text-sm leading-relaxed text-ink-muted min-[900px]:block"
            style={{ animationDelay: '180ms' }}
          >
            {footnote}
          </p>
        )}
      </section>

      {/* Optical, not geometric, centring: the extra bottom padding lifts the
          form above the true middle. A block centred by arithmetic reads as
          sitting low, which is what left the dead space above "Sign in". */}
      <main className="flex flex-1 items-center justify-center px-6 py-10 min-[900px]:px-10 min-[900px]:pb-[9vh]">
        <div className="w-full max-w-[22rem]">{children}</div>
      </main>
    </div>
  );
}
