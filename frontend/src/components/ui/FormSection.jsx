/**
 * Form section — owned by A. Layout and a heading; no field behaviour.
 *
 * Not built on FieldShell: the shell binds a <label> to a control's id and
 * wires hint and error into its aria-describedby. A section has a heading, not
 * a label, and owns no control — it would generate ids nothing points at.
 *
 * Renders <h2>, which sits correctly under a page's PageHeader <h1>. Inside a
 * Drawer or Modal, whose own title is an <h2>, it lands as a sibling rather
 * than a child. The locked signature has nowhere to put a level; if that
 * flatness starts to matter the fix is a `level` prop agreed by all three and
 * written into docs/components.md, not a second section component.
 *
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.description]
 */

import { cn } from '@/lib/cn';

export function FormSection({ title, description, className, children }) {
  return (
    // No aria-labelledby: a named <section> becomes a region landmark, which is
    // too heavy for a subsection of one form. The heading is enough to navigate
    // by.
    <section className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        {description && (
          <p className="text-sm text-text-muted">{description}</p>
        )}
      </div>

      {/* Fields stack at the same rhythm a bare form uses, so a section can be
          dropped around existing fields without the spacing shifting. */}
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}
