# Shared component kit — locked prop signatures

**These signatures are frozen. Implementation is not.**

That distinction is what unblocks the team: I ship an ugly-but-working v0 in the
first 2–3 days, B and C build against it immediately, and when I restyle
everything in week 2 their pages improve for free with zero merge conflicts.

Rules:

- `src/components/ui/` is A's folder. B and C **import from it, never edit it.**
- Need a prop that doesn't exist? Ask in the group chat. A adds it in a
  15-minute turnaround. Do not fork the component into your module folder.
- Need something module-specific? Build it in your own folder, prefixed:
  `CustomerTable` wrapping `DataTable`, not a second `DataTable`.

Import path alias is `@/` → `src/`.

---

## DataTable

The workhorse. Every list page in the app is this component.

```jsx
<DataTable
  columns={[
    { key: 'code',      label: 'Code',     sortable: true,  width: '120px' },
    { key: 'name',      label: 'Name',     sortable: true },
    { key: 'balance',   label: 'Balance',  sortable: true,  align: 'right',
      render: (row) => formatMoney(row.balance, row.currency) },
    { key: 'status',    label: 'Status',
      render: (row) => <StatusBadge status={row.status} variant="auto" /> },
  ]}
  data={customers}
  loading={isLoading}
  error={error}
  emptyState={<EmptyState ... />}

  // pagination — server-side, driven by meta from the API
  page={meta.page}
  perPage={meta.perPage}
  total={meta.total}
  onPageChange={setPage}
  onPerPageChange={setPerPage}

  // sorting
  sort={sort}                       // "-createdAt"
  onSortChange={setSort}

  // search + filters
  searchable
  searchValue={search}
  onSearchChange={setSearch}
  filters={<CustomerFilters />}     // your own node, rendered in the toolbar

  // interaction
  onRowClick={(row) => navigate(`/customers/${row.id}`)}
  rowActions={(row) => [
    { label: 'Edit',   icon: Pencil, onClick: () => {}, permission: 'customers.edit' },
    { label: 'Delete', icon: Trash,  onClick: () => {}, permission: 'customers.delete',
      destructive: true },
  ]}

  // bulk selection — omit selectable entirely if you don't need it
  selectable
  selectedIds={selected}
  onSelectionChange={setSelected}
  bulkActions={[{ label: 'Export', onClick: () => {} }]}

  // misc
  rowKey="id"
  stickyHeader
  density="comfortable"             // 'comfortable' | 'compact'
/>
```

**Column object:**

| Key | Type | Note |
|---|---|---|
| `key` | string | Field name. Also the sort key. |
| `label` | string | Header text. |
| `sortable` | boolean | Default false. |
| `align` | `'left'\|'center'\|'right'` | Money and numbers go right. |
| `width` | string | CSS width. Omit for auto. |
| `render` | `(row) => node` | Custom cell. Omit and it prints `row[key]`. |
| `hideBelow` | `'md'\|'lg'\|'xl'` | Responsive column dropping. |

`rowActions` entries carrying a `permission` are hidden when the user lacks it —
**hidden, not secured.** See `docs/security-notes.md`.

### useTableParams

Do not manage table state by hand. This hook syncs it to the URL so pages are
shareable and refresh-safe:

```js
const { page, perPage, sort, search, filters, setPage, setPerPage,
        setSort, setSearch, setFilters, queryParams } = useTableParams({
  defaults: { perPage: 25, sort: '-createdAt' },
  filterKeys: ['status', 'categoryId'],
});

const { data } = useQuery({
  queryKey: ['customers', 'list', queryParams],
  queryFn: () => fetchCustomers(queryParams),
});
```

---

## Forms

```jsx
<FormField
  label="Email"
  name="email"
  type="text"                      // text | email | password | number | textarea | date | tel
  value={value}
  onChange={onChange}
  error={errors.email?.message}
  required
  hint="Used for invoice delivery."
  disabled={false}
  placeholder="name@company.com"
/>

<FormSelect
  label="Status"
  name="status"
  value={value}
  onChange={onChange}
  options={[{ value: 'active', label: 'Active' }]}
  error={}
  required
  searchable                       // for long lists like product pickers
  clearable
  loading={}                       // async option loading
/>

<FormMoney
  label="Credit limit"
  name="creditLimit"
  value={149900}                   // integer minor units in, integer out
  currency="ETB"
  onChange={(minorUnits) => {}}
  error={}
/>

<FormDate      label="" name="" value="2026-08-08" onChange={} error={} min={} max={} />
<FormCheckbox  label="" name="" checked={} onChange={} error={} />
<FormTextarea  label="" name="" value={} onChange={} error={} rows={4} maxLength={} />

<FormSection title="Billing address" description="Optional.">…</FormSection>
<FormRow columns={2}>…</FormRow>
<FormActions submitLabel="Save customer" onCancel={} loading={isSubmitting} />
```

`FormMoney` takes and returns **integers in minor units**. It handles the
display formatting internally. Never wire a plain `FormField type="number"` to a
money field.

All of these work uncontrolled with React Hook Form via `register`, or controlled
via `Controller`. Use RHF + the Zod resolver — hand-rolled form state is banned
in this repo.

**Except `FormMoney`, which must use `Controller`, never `register`.** Its
`onChange` emits a number, not an event, so `register`'s event-based handler has
no `event.target.value` to read and will throw:

```jsx
<Controller
  name="creditLimit"
  control={control}
  render={({ field }) => <FormMoney {...field} label="Credit limit" />}
/>
```

---

## Overlays

```jsx
<Modal open={} onClose={} title="" description="" size="sm|md|lg|xl" footer={<…/>}>
  …
</Modal>

<Drawer open={} onClose={} title="" side="right" size="md">…</Drawer>

<ConfirmDialog
  open={} onClose={} onConfirm={}
  title="Delete customer?"
  description="This archives the customer. Existing orders are unaffected."
  confirmLabel="Delete"
  variant="destructive"
  loading={isDeleting}
/>

// toasts — imperative, no provider wiring needed in your module
import { toast } from '@/components/ui/toast';
toast.success('Customer saved');
toast.error('Could not save customer', { description: err.message });
```

Toast copy rule: the toast uses the **same verb as the button that caused it**.
Button says "Publish" → toast says "Published". Not "Success!".

---

## Display

```jsx
<StatusBadge status="pending_approval" variant="auto" />
```

`variant="auto"` maps known ERP statuses to colours centrally, so `approved` is
the same green in every module without three people picking three greens:

| Variant | Statuses |
|---|---|
| `success` | `active`, `approved`, `paid`, `received`, `fulfilled` |
| `warning` | `pending_approval`, `partially_paid`, `partially_received`, `low_stock` |
| `danger` | `overdue`, `blocked`, `cancelled`, `void`, `out_of_stock` |
| `neutral` | `draft`, `inactive`, `discontinued` |
| `info` | `sent`, `invited` |

Unknown status → `neutral` plus a console warning. If you add a status to
`entities.md`, tell A to map it.

```jsx
<KPICard title="Outstanding" value="ETB 1,204,900" icon={Wallet}
         trend={{ value: 12.4, direction: 'up', label: 'vs last month' }}
         loading={} onClick={} />

<EmptyState icon={Users} title="No customers yet"
            description="Customers you add will appear here."
            action={{ label: 'Add customer', onClick: () => {} }} />

<Skeleton variant="text|card|table|form" rows={5} />

<PageHeader title="Customers" description=""
            breadcrumbs={[{ label: 'Customers', path: '/customers' }]}
            actions={<Button>Add customer</Button>} />

<DateRangePicker value={{ from, to }} onChange={} presets />
<Button variant="primary|secondary|ghost|destructive" size="sm|md|lg"
        loading={} icon={} iconPosition="left" disabled={} />
```

### Empty state copy

An empty screen is an invitation to act, not an apology. "No customers yet" plus
an add button. Never "No data found." Never a sad face.

### Error copy

Errors say what happened and what to do. In the interface's voice, not a
person's. "Could not save — the SKU PRD-0001 is already in use." Not "Oops!
Something went wrong."

---

## Permissions

```jsx
import { Can, useCan } from '@/auth/AuthContext';

<Can permission="customers.delete">
  <Button variant="destructive">Delete</Button>
</Can>

<Can permission="orders.approve" fallback={<Tooltip>Requires approval rights</Tooltip>}>
  <Button>Approve</Button>
</Can>

const canDelete = useCan('customers.delete');
```

> **`<Can>` hides UI. It secures nothing.**
>
> Any user can open devtools, edit the bundle, or call the API directly with
> curl. If the backend does not independently enforce the same permission, the
> action is unprotected. Every `<Can>` in the codebase must have a matching
> server-side check listed in `docs/security-notes.md`.

This warning is repeated in the component's own JSDoc so it shows up on hover.

---

## Design tokens

Defined in `src/styles/tokens.css`, consumed through Tailwind. Do not hardcode a
hex value anywhere in a module.

```
--color-bg           page background
--color-surface      cards, table rows
--color-border
--color-text         --color-text-muted
--color-primary      --color-primary-hover   --color-primary-fg
--color-success --color-warning --color-danger --color-info   (+ -bg variants)

--color-ink   --color-ink-muted   --color-bone   ← auth screen only

--radius-sm 4px   --radius-md 6px   --radius-lg 10px
--space-*         4px scale
--font-sans       Inter
--font-mono       JetBrains Mono   ← SKUs, order numbers, IDs, quantities
--font-display    Anton            ← auth screen only
```

The three `ink`/`bone` colours and `--font-display` belong to `AuthLayout` and
nothing else. The login screen is the app's one loud surface; a poster face, a
near-black panel, or a tinted ground turning up on a list page is a bug, not a
flourish. `--color-surface` stays pure white so dense tables read on a neutral
ground — `--color-bone` is the login screen's off-white and does not migrate
inward.

Order numbers, SKUs, and codes render in the mono face. In a dense table it makes
`SO-2026-0042` scannable in a way a proportional font does not, and it is the one
typographic decision in this app that carries actual information.

Density: rows are 40px at `comfortable`, 32px at `compact`. ERP users are looking
at 25 rows at a time on a 1440px screen — this is not a marketing site and the
spacing should not pretend it is.

---

## Quality floor

Every kit component ships with:

- Visible keyboard focus. ERP power users navigate by keyboard; Radix gives most
  of this for free but focus rings must not be styled away.
- Correct labels and `aria-describedby` on errors.
- `prefers-reduced-motion` respected.
- Responsive down to 768px. Below that, `DataTable` renders as stacked cards.
- No `dangerouslySetInnerHTML`. ESLint fails the build on it — that rule is not
  disabled for any reason.
