# Entity shapes

**Status: DRAFT — needs sign-off from all three before anyone builds a form.**

Once signed off, this file is read-only. Changes require all three to agree, and
the change is announced in the group chat, not merged quietly.

This is the highest-risk coordination point in the project. If B invents
`customer.fullName` and C invents `supplier.contact_name`, reconciling them later
means touching every form, table, and mock file in both modules.

---

## Conventions

These apply to **every** entity. No exceptions without a group decision.

| Rule | Value | Note |
|---|---|---|
| Field case | `camelCase` | In JSON on the wire and in JS. Backend team must match. |
| IDs | `string` | Not numbers. Survives a switch to UUIDs later. |
| Dates | ISO 8601 UTC string | `"2026-08-08T09:30:00Z"`. Format at render time only. |
| Date-only | `"YYYY-MM-DD"` | For due dates, order dates — no timezone confusion. |
| **Money** | **integer, minor units** | `149900` = 1,499.00. Never floats. See below. |
| Currency | ISO 4217 string | `"ETB"`. Stored per-document, not global. |
| Quantities | number | Decimals allowed (2.5 kg). Not money, so float is fine. |
| Enums | lowercase snake | `"pending_approval"`. Never localise the stored value. |
| Missing value | `null` | Never `""`, never `undefined`, never `0`. |
| Timestamps | `createdAt`, `updatedAt` | Server-set, read-only in the UI. |

### Money is an integer

`0.1 + 0.2 !== 0.3` in JavaScript. An ERP that gets invoice totals wrong is
worthless. Every monetary value is an integer in the currency's smallest unit,
and only `formatMoney()` in `src/lib/format.js` turns it into something a human
reads.

```js
formatMoney(149900, 'ETB')   // → "ETB 1,499.00"
parseMoney("1499.00")        // → 149900
```

Never do arithmetic on a formatted string. Never store `14.99`.

---

## Shared sub-shapes

```js
/**
 * @typedef {Object} Address
 * @property {string|null} line1
 * @property {string|null} line2
 * @property {string|null} city
 * @property {string|null} region
 * @property {string|null} country      ISO 3166-1 alpha-2, e.g. "ET"
 * @property {string|null} postalCode
 */

/**
 * @typedef {Object} Money
 * @property {number} amount            integer, minor units
 * @property {string} currency          ISO 4217
 */

/**
 * @typedef {Object} LineItem
 * @property {string} id
 * @property {string} productId
 * @property {string} productName       denormalised — the name at time of order
 * @property {string} sku               denormalised
 * @property {number} quantity
 * @property {number} unitPrice         integer, minor units
 * @property {number} discountPercent   0–100
 * @property {number} taxPercent        0–100
 * @property {number} lineTotal         integer, minor units — server-calculated
 */
```

**On denormalisation:** `productName` and `unitPrice` are copied onto the line at
the time the order is placed. If the product is later renamed or repriced, the
historical order must not change. This is standard ERP behaviour and it is not
optional.

---

## Users, roles, permissions — A owns

```js
/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} email
 * @property {string} firstName
 * @property {string} lastName
 * @property {string|null} avatarUrl
 * @property {string} roleId
 * @property {string} roleName           denormalised for display
 * @property {string[]} permissions      e.g. ["customers.view", "orders.create"]
 * @property {'active'|'invited'|'suspended'} status
 * @property {string|null} lastLoginAt
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} Role
 * @property {string} id
 * @property {string} name               "Sales Manager"
 * @property {string|null} description
 * @property {string[]} permissions
 * @property {boolean} isSystem          system roles can't be deleted
 */
```

### Permission strings

Format is `resource.action`. Actions: `view`, `create`, `edit`, `delete`,
`approve`, `export`.

```
customers.view    customers.create    customers.edit    customers.delete
orders.view       orders.create       orders.edit       orders.delete      orders.approve
invoices.view     invoices.create     invoices.edit     invoices.void
products.view     products.create     products.edit     products.delete    products.adjust_stock
suppliers.view    suppliers.create    suppliers.edit    suppliers.delete
purchasing.view   purchasing.create   purchasing.edit   purchasing.approve  purchasing.receive
users.view        users.create        users.edit        users.delete
settings.view     settings.edit
```

Add to this list when you need one. Keep the format.

---

## Customer — B owns

```js
/**
 * @typedef {Object} Customer
 * @property {string} id
 * @property {string} code               "CUS-0001" — human-readable, server-generated
 * @property {string} name               company or person name
 * @property {'company'|'individual'} type
 * @property {string|null} tin           tax identification number
 * @property {string|null} email
 * @property {string|null} phone
 * @property {string|null} contactPerson
 * @property {Address} billingAddress
 * @property {Address|null} shippingAddress    null = same as billing
 * @property {number} creditLimit        integer, minor units
 * @property {number} balance            integer, minor units — outstanding, server-calculated
 * @property {number} paymentTermsDays   e.g. 30
 * @property {string} currency
 * @property {'active'|'inactive'|'blocked'} status
 * @property {string|null} notes
 * @property {string} createdAt
 * @property {string} updatedAt
 */
```

## SalesOrder — B owns

```js
/**
 * @typedef {Object} SalesOrder
 * @property {string} id
 * @property {string} orderNumber        "SO-2026-0042"
 * @property {string} customerId
 * @property {string} customerName       denormalised
 * @property {string} orderDate          YYYY-MM-DD
 * @property {string|null} expectedDeliveryDate
 * @property {LineItem[]} lines
 * @property {number} subtotal           integer, minor units
 * @property {number} discountTotal
 * @property {number} taxTotal
 * @property {number} grandTotal
 * @property {string} currency
 * @property {'draft'|'pending_approval'|'approved'|'fulfilled'|'cancelled'} status
 * @property {string|null} notes
 * @property {string} createdBy          userId
 * @property {string|null} approvedBy
 * @property {string} createdAt
 * @property {string} updatedAt
 */
```

**Status flow:** `draft → pending_approval → approved → fulfilled`, with
`cancelled` reachable from any state before `fulfilled`. Totals are always
server-calculated; the UI may show an optimistic preview but never sends totals.

## Invoice — B owns

```js
/**
 * @typedef {Object} Invoice
 * @property {string} id
 * @property {string} invoiceNumber      "INV-2026-0117"
 * @property {string|null} salesOrderId
 * @property {string} customerId
 * @property {string} customerName
 * @property {string} issueDate          YYYY-MM-DD
 * @property {string} dueDate            YYYY-MM-DD
 * @property {LineItem[]} lines
 * @property {number} subtotal
 * @property {number} taxTotal
 * @property {number} grandTotal
 * @property {number} amountPaid
 * @property {number} amountDue          grandTotal - amountPaid
 * @property {string} currency
 * @property {'draft'|'sent'|'partially_paid'|'paid'|'overdue'|'void'} status
 * @property {string|null} notes
 * @property {string} createdAt
 * @property {string} updatedAt
 */
```

`overdue` is derived server-side from `dueDate` and `amountDue`. The UI displays
it; it does not compute it.

---

## Product — C owns

```js
/**
 * @typedef {Object} Product
 * @property {string} id
 * @property {string} sku                "PRD-0001"
 * @property {string} name
 * @property {string|null} description
 * @property {string} categoryId
 * @property {string} categoryName       denormalised
 * @property {string} unitOfMeasure      "pcs" | "kg" | "ltr" | "box"
 * @property {number} costPrice          integer, minor units
 * @property {number} sellingPrice       integer, minor units
 * @property {string} currency
 * @property {number} quantityOnHand
 * @property {number} quantityReserved   committed to approved orders
 * @property {number} quantityAvailable  onHand - reserved, server-calculated
 * @property {number} reorderLevel       triggers the low-stock badge
 * @property {string|null} barcode
 * @property {string|null} imageUrl
 * @property {'active'|'discontinued'} status
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} StockAdjustment
 * @property {string} id
 * @property {string} productId
 * @property {string} productName
 * @property {'increase'|'decrease'} direction
 * @property {number} quantity
 * @property {'purchase'|'sale'|'damage'|'loss'|'count_correction'|'return'} reason
 * @property {string|null} reference     e.g. a PO number
 * @property {string|null} notes
 * @property {string} createdBy
 * @property {string} createdAt
 */
```

Stock is never edited by typing a new `quantityOnHand`. It changes only through
an adjustment record, so there is always an audit trail. This is a real ERP
requirement and it shapes C's UI: the detail page gets an "Adjust stock" action,
not an editable quantity field.

## Supplier — C owns

```js
/**
 * @typedef {Object} Supplier
 * @property {string} id
 * @property {string} code               "SUP-0001"
 * @property {string} name
 * @property {string|null} tin
 * @property {string|null} email
 * @property {string|null} phone
 * @property {string|null} contactPerson
 * @property {Address} address
 * @property {number} paymentTermsDays
 * @property {string} currency
 * @property {number} balance            what we owe them, integer minor units
 * @property {'active'|'inactive'} status
 * @property {string|null} notes
 * @property {string} createdAt
 * @property {string} updatedAt
 */
```

## PurchaseOrder — C owns

```js
/**
 * @typedef {Object} PurchaseOrder
 * @property {string} id
 * @property {string} poNumber           "PO-2026-0031"
 * @property {string} supplierId
 * @property {string} supplierName
 * @property {string} orderDate          YYYY-MM-DD
 * @property {string|null} expectedDate
 * @property {PurchaseOrderLine[]} lines
 * @property {number} subtotal
 * @property {number} taxTotal
 * @property {number} grandTotal
 * @property {string} currency
 * @property {'draft'|'pending_approval'|'approved'|'partially_received'|'received'|'cancelled'} status
 * @property {string|null} notes
 * @property {string} createdBy
 * @property {string|null} approvedBy
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {LineItem & { quantityReceived: number }} PurchaseOrderLine
 */
```

`quantityReceived` is what drives the receive-goods flow and the
`partially_received` status. It is the one field that makes a PO line differ
from a sales order line.

---

## Deliberately out of scope

Named here so nobody builds them speculatively: accounting/general ledger,
payroll, manufacturing/BOM, multi-warehouse, multi-currency conversion,
serial/batch tracking, CRM pipeline. If the intern leader asks for one, it gets
added to this document first and assigned to one owner.
