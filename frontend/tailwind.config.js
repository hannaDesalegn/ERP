/**
 * Every colour, radius and font value comes from the CSS custom properties in
 * `src/styles/tokens.css`. Modules use the Tailwind class (`bg-surface`,
 * `text-muted`); nobody hardcodes a hex value.
 * See docs/components.md § Design tokens.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        border: 'var(--color-border)',
        text: {
          DEFAULT: 'var(--color-text)',
          muted: 'var(--color-text-muted)',
        },
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          fg: 'var(--color-primary-fg)',
        },
        success: {
          DEFAULT: 'var(--color-success)',
          bg: 'var(--color-success-bg)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          bg: 'var(--color-warning-bg)',
        },
        danger: {
          DEFAULT: 'var(--color-danger)',
          bg: 'var(--color-danger-bg)',
        },
        info: {
          DEFAULT: 'var(--color-info)',
          bg: 'var(--color-info-bg)',
        },
        // Auth screen only. See tokens.css — not app-interior colours.
        ink: {
          DEFAULT: 'var(--color-ink)',
          muted: 'var(--color-ink-muted)',
        },
        bone: 'var(--color-bone)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)',
        // Condensed poster face. `font-display` belongs to the auth screen and
        // nothing else — the app interior is set in sans, on purpose.
        display: 'var(--font-display)',
      },
      // Row heights from docs/components.md § Design tokens: 40px comfortable,
      // 32px compact. Only DataTable uses these.
      height: {
        row: '40px',
        'row-compact': '32px',
      },
    },
  },
  plugins: [],
};
