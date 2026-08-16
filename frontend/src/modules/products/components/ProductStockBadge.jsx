/**
 * Derived stock badge — C owns this file.
 *
 * `low_stock` and `out_of_stock` are NOT values of Product.status, which is
 * only 'active' | 'discontinued' (docs/entities.md). They are display states
 * derived from quantityAvailable against reorderLevel, and the shared
 * StatusBadge already maps both to a colour, so this only decides which one
 * applies and renders plain text for the healthy case.
 *
 * Derived in the UI on purpose: it is a pure function of two fields the server
 * already sends, so it needs no extra endpoint and cannot drift.
 */

import { StatusBadge } from '@/components/ui';
import { formatNumber } from '@/lib/format';

/**
 * @param {object} props
 * @param {number} props.quantityAvailable
 * @param {number} props.reorderLevel
 * @param {string} [props.unitOfMeasure]
 */
export function ProductStockBadge({
  quantityAvailable,
  reorderLevel,
  unitOfMeasure,
}) {
  if (quantityAvailable <= 0) {
    return <StatusBadge status="out_of_stock" variant="auto" />;
  }

  if (quantityAvailable <= reorderLevel) {
    return <StatusBadge status="low_stock" variant="auto" />;
  }

  return (
    <span className="text-sm text-text-muted">
      {formatNumber(quantityAvailable, { unit: unitOfMeasure })}
    </span>
  );
}
