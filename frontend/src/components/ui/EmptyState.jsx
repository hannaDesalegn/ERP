/**
 * Empty state — owned by A.
 *
 * An empty screen is an invitation to act, never an apology.
 * docs/components.md § Empty state copy.
 */

import { Button } from './Button';

/**
 * @param {object} props
 * @param {React.ElementType} [props.icon] a lucide icon component
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {{ label: string, onClick: () => void }} [props.action]
 */
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    // Centred in whatever contains it — a table cell, a card, a panel.
    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 px-4 py-10 text-center">
      {Icon && (
        <Icon size={24} aria-hidden="true" className="text-text-muted" />
      )}

      <div className="flex flex-col gap-1">
        {/* Not a heading: this renders inside arbitrary containers, so a fixed
            level would land wrong in the document outline. */}
        <p className="text-sm font-medium text-text">{title}</p>
        {description && (
          <p className="text-sm text-text-muted">{description}</p>
        )}
      </div>

      {/* Focus ring comes from Button and the global :focus-visible rule. */}
      {action && <Button onClick={action.onClick}>{action.label}</Button>}
    </div>
  );
}
