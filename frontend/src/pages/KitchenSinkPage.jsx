/**
 * TEMPORARY — delete before the demo.
 *
 * Reference page for kit v0. B and C read this to see how the kit behaves, so
 * every example here is genuinely interactive: real useState, real callbacks.
 * The handful of examples that exist to show a fixed state are labelled
 * "Fixed state" so nobody mistakes them for something broken.
 *
 * All data is obviously fake, per docs/security-notes.md § Fake data only.
 */

import {
  Download,
  Pencil,
  Plus,
  RotateCw,
  Trash,
  Users,
  Wallet,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  Button,
  ConfirmDialog,
  DataTable,
  Drawer,
  EmptyState,
  FormActions,
  FormCheckbox,
  FormDate,
  FormField,
  FormMoney,
  FormRow,
  FormSection,
  FormSelect,
  FormTextarea,
  KPICard,
  Modal,
  PageHeader,
  Skeleton,
  StatusBadge,
  toast,
} from '@/components/ui';
import { formatMoney } from '@/lib/format';

const CUSTOMERS = [
  {
    code: 'CUS-0001',
    name: 'Acme Trading PLC',
    balance: 149900,
    status: 'active',
  },
  {
    code: 'CUS-0002',
    name: 'Blue Nile Supplies',
    balance: 0,
    status: 'inactive',
  },
  {
    code: 'CUS-0003',
    name: 'Habesha Distributors',
    balance: 2450000,
    status: 'blocked',
  },
  {
    code: 'CUS-0004',
    name: 'Rift Valley Logistics',
    balance: 87500,
    status: 'active',
  },
  {
    code: 'CUS-0005',
    name: 'Awash Metalworks',
    balance: 312000,
    status: 'active',
  },
  {
    code: 'CUS-0006',
    name: 'Sheba Textiles',
    balance: 45000,
    status: 'inactive',
  },
  {
    code: 'CUS-0007',
    name: 'Omo Valley Foods',
    balance: 1875000,
    status: 'active',
  },
  { code: 'CUS-0008', name: 'Danakil Minerals', balance: 0, status: 'blocked' },
  {
    code: 'CUS-0009',
    name: 'Simien Hardware',
    balance: 96300,
    status: 'active',
  },
  {
    code: 'CUS-0010',
    name: 'Bale Mountain Traders',
    balance: 528400,
    status: 'active',
  },
  {
    code: 'CUS-0011',
    name: 'Gondar Packaging',
    balance: 7200,
    status: 'inactive',
  },
  {
    code: 'CUS-0012',
    name: 'Tana Freight Services',
    balance: 1043000,
    status: 'active',
  },
].map((row, index) => ({
  ...row,
  id: `cus_${String(index + 1).padStart(2, '0')}`,
  email: `${row.code.toLowerCase()}@example-erp.test`,
  currency: 'ETB',
}));

const ALL_STATUSES = [
  'active',
  'approved',
  'paid',
  'received',
  'fulfilled',
  'pending_approval',
  'partially_paid',
  'partially_received',
  'low_stock',
  'overdue',
  'blocked',
  'cancelled',
  'void',
  'out_of_stock',
  'draft',
  'inactive',
  'discontinued',
  'sent',
  'invited',
];

const CURRENCY_OPTIONS = [
  { value: 'ETB', label: 'ETB — Ethiopian birr' },
  { value: 'USD', label: 'USD — US dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'blocked', label: 'Blocked' },
];

const PRODUCT_OPTIONS = [
  { value: 'prd_01', label: 'PRD-0001 — Steel bracket' },
  { value: 'prd_02', label: 'PRD-0002 — Copper wire 2.5mm' },
  { value: 'prd_03', label: 'PRD-0003 — Safety helmet' },
  { value: 'prd_04', label: 'PRD-0004 — Cement bag 50kg' },
];

const CATEGORY_OPTIONS = [
  { value: 'cat_01', label: 'Raw materials' },
  { value: 'cat_02', label: 'Finished goods' },
  { value: 'cat_03', label: 'Consumables' },
];

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function Section({ title, fixed = false, children }) {
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          {title}
        </h2>
        {fixed && <FixedStateLabel />}
      </div>
      {children}
    </section>
  );
}

/** Labelled cell for the Skeleton grid, so each variant is identifiable. */
function SkeletonSample({ label, children }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-xs text-text-muted">{label}</p>
      {children}
    </div>
  );
}

/** Marks an example that is deliberately frozen, so it does not read as a bug. */
function FixedStateLabel({ children = 'Fixed state — not interactive' }) {
  return (
    <span className="rounded-sm border border-border bg-bg px-1.5 py-0.5 text-xs font-normal normal-case text-text-muted">
      {children}
    </span>
  );
}

export function KitchenSinkPage() {
  // Timers used by the fake-async demos, cleared if the page unmounts mid-flight.
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));

  const [lastAction, setLastAction] = useState('—');

  // Button
  const [saving, setSaving] = useState(false);
  const save = () => {
    setSaving(true);
    setLastAction('Save started');
    later(() => {
      setSaving(false);
      setLastAction('Saved');
    }, 1500);
  };

  // FormField
  const [name, setName] = useState('');
  const [email, setEmail] = useState('not-an-email');
  const emailError =
    email && !EMAIL_PATTERN.test(email)
      ? 'Must be a valid email address.'
      : undefined;

  // FormMoney / FormTextarea / FormCheckbox
  const [creditLimit, setCreditLimit] = useState(149900);
  const [jpyAmount, setJpyAmount] = useState(1500);
  const [notes, setNotes] = useState('');
  const [taxExempt, setTaxExempt] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // FormSelect
  const [currency, setCurrency] = useState('ETB');
  const [status, setStatus] = useState('');
  const [productId, setProductId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  const loadCategories = () => {
    setCategoriesLoading(true);
    setCategories([]);
    setCategoryId('');
    later(() => {
      setCategories(CATEGORY_OPTIONS);
      setCategoriesLoading(false);
    }, 1200);
  };

  // FormDate
  const [orderDate, setOrderDate] = useState('2026-08-18');
  const [deliveryDate, setDeliveryDate] = useState('');
  // Plain string comparison is safe on YYYY-MM-DD, which is the only shape
  // <input type="date"> emits.
  const deliveryError =
    deliveryDate && deliveryDate < orderDate
      ? 'Delivery cannot be before the order date.'
      : undefined;

  // FormSection / FormRow / FormActions
  const [formSaving, setFormSaving] = useState(false);
  const submitDemoForm = (event) => {
    event.preventDefault();
    setFormSaving(true);
    setLastAction('Form submitted');
    later(() => {
      setFormSaving(false);
      toast.success('Saved Acme Trading PLC');
    }, 1500);
  };

  // Modal / ConfirmDialog
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerSide, setDrawerSide] = useState('right');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = () => {
    setDeleting(true);
    later(() => {
      setDeleting(false);
      setConfirmOpen(false);
      // Same verb as the button that caused it: "Delete" → "Deleted".
      toast.success('Deleted Acme Trading PLC');
      setLastAction('Customer deleted');
    }, 1500);
  };

  // DataTable
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('-balance');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [selected, setSelected] = useState([]);
  const [tableLoading, setTableLoading] = useState(false);

  // The real DataTable is server-driven: the API sorts, filters and paginates,
  // and the component just reports intent through these callbacks. This page has
  // no API, so it does that work locally to prove the callbacks are wired.
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = needle
      ? CUSTOMERS.filter((row) =>
          [row.code, row.name, row.email].some((field) =>
            field.toLowerCase().includes(needle),
          ),
        )
      : CUSTOMERS;

    const key = sort.startsWith('-') ? sort.slice(1) : sort;
    const direction = sort.startsWith('-') ? -1 : 1;

    return [...filtered].sort((a, b) => {
      const left = a[key];
      const right = b[key];
      if (typeof left === 'number' && typeof right === 'number') {
        return (left - right) * direction;
      }
      return String(left).localeCompare(String(right)) * direction;
    });
  }, [search, sort]);

  // Filtering can shrink the list under the current page — clamp rather than
  // render an empty page the user cannot navigate out of.
  const totalPages = Math.max(1, Math.ceil(rows.length / perPage));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice((safePage - 1) * perPage, safePage * perPage);

  const columns = [
    {
      key: 'code',
      label: 'Code',
      sortable: true,
      width: '120px',
      render: (row) => <span className="font-mono text-xs">{row.code}</span>,
    },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'email', label: 'Email', hideBelow: 'lg' },
    {
      key: 'balance',
      label: 'Balance',
      sortable: true,
      align: 'right',
      render: (row) => formatMoney(row.balance, row.currency),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge status={row.status} variant="auto" />,
    },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <PageHeader
        title="Kitchen sink"
        description="Temporary reference page. Every kit v0 component, wired to real state."
        actions={
          <>
            <Button
              variant="secondary"
              icon={Download}
              onClick={() => setLastAction('Export clicked')}
            >
              Export
            </Button>
            <Button
              icon={Plus}
              onClick={() => setLastAction('Add customer clicked')}
            >
              Add customer
            </Button>
          </>
        }
      />

      <p className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-muted">
        Last action: <span className="font-medium text-text">{lastAction}</span>
      </p>

      <Section title="Button">
        <div className="flex flex-wrap items-center gap-2">
          {['primary', 'secondary', 'ghost', 'destructive'].map((variant) => (
            <Button
              key={variant}
              variant={variant}
              onClick={() => setLastAction(`${variant} button clicked`)}
            >
              {variant[0].toUpperCase() + variant.slice(1)}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {['sm', 'md', 'lg'].map((size) => (
            <Button
              key={size}
              size={size}
              variant="secondary"
              onClick={() => setLastAction(`Size ${size} clicked`)}
            >
              Size {size}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Click it: loading runs for 1.5s and clears itself. */}
          <Button loading={saving} onClick={save}>
            {saving ? 'Saving' : 'Save'}
          </Button>
          <Button
            icon={Plus}
            onClick={() => setLastAction('Icon left clicked')}
          >
            Icon left
          </Button>
          <Button
            icon={Download}
            iconPosition="right"
            onClick={() => setLastAction('Icon right clicked')}
          >
            Icon right
          </Button>
          <span className="flex items-center gap-2">
            <Button disabled>Disabled</Button>
            <FixedStateLabel>Disabled on purpose</FixedStateLabel>
          </span>
        </div>
      </Section>

      <Section title="StatusBadge">
        <div className="flex flex-wrap items-center gap-2">
          {ALL_STATUSES.map((value) => (
            <StatusBadge key={value} status={value} variant="auto" />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status="not_a_real_status" variant="auto" />
          <FixedStateLabel>
            Unmapped status on purpose — falls back to neutral and logs an error
          </FixedStateLabel>
        </div>
      </Section>

      <Section title="KPICard">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {/* Up on a debt is bad news: isGood false paints it red while the
              arrow still points up. */}
          <KPICard
            title="Outstanding"
            value={formatMoney(120490000, 'ETB')}
            icon={Wallet}
            trend={{
              value: 12.4,
              direction: 'up',
              isGood: false,
              label: 'vs last month',
            }}
          />
          {/* No icon, on purpose — icon is optional. A fall in overdue is good
              news, so isGood true paints the decrease green. */}
          <KPICard
            title="Overdue invoices"
            value={formatMoney(31200000, 'ETB')}
            trend={{
              value: 4.1,
              direction: 'down',
              isGood: true,
              label: 'vs last month',
            }}
          />
          <KPICard title="Active customers" value="1,204" icon={Users} />
          {/* No isGood — the fallback, where direction alone decides. */}
          <KPICard
            title="Collected this month"
            value={formatMoney(88300000, 'ETB')}
            icon={Wallet}
            trend={{ value: 2.8, direction: 'up' }}
            onClick={() => setLastAction('KPICard clicked')}
          />
          <KPICard title="Loading" value="—" loading />
        </div>
        <p className="text-xs text-text-muted">
          icon, trend, loading and onClick are all optional. A card with{' '}
          <span className="font-mono">onClick</span> renders as a button, so it
          is keyboard-reachable; the rest render as plain divs.{' '}
          <span className="font-mono">loading</span> renders the kit&apos;s card
          Skeleton rather than a second pulse.
        </p>
        <p className="text-xs text-text-muted">
          <span className="font-mono">trend.isGood</span> decides the colour —
          true green, false red — and the arrow keeps following{' '}
          <span className="font-mono">direction</span> either way, so
          &ldquo;Outstanding&rdquo; above is a red arrow pointing up. Omit the
          field and direction decides, which is what &ldquo;Collected this
          month&rdquo; shows and what every card written before it still does.
        </p>
      </Section>

      <Section title="FormField">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            label="Customer name"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            placeholder="Acme Trading PLC"
            hint="Company or person name."
          />
          {/* Validates as you type — clear the bad value and the error goes. */}
          <FormField
            label="Email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={emailError}
            placeholder="name@example-erp.test"
          />
          <FormField
            label="Phone"
            name="phone"
            type="tel"
            placeholder="+251-900-000-001"
          />
          <FormField label="Order date" name="orderDate" type="date" />
          <FormField
            label="Payment terms (days)"
            name="paymentTermsDays"
            type="number"
            placeholder="30"
          />
          <div className="flex flex-col gap-1">
            <FormField
              label="Disabled"
              name="disabled"
              disabled
              value="Read only"
              readOnly
            />
            <FixedStateLabel>Disabled on purpose</FixedStateLabel>
          </div>
          <FormField
            label="Notes"
            name="notes"
            type="textarea"
            rows={3}
            placeholder="Anything worth recording."
            className="md:col-span-2"
          />
        </div>
      </Section>

      <Section title="FormSelect">
        <div className="grid gap-4 md:grid-cols-2">
          <FormSelect
            label="Currency"
            name="currency"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            options={CURRENCY_OPTIONS}
            required
          />
          {/* Error clears the moment a value is picked. */}
          <FormSelect
            label="Status"
            name="status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            options={STATUS_OPTIONS}
            error={status ? undefined : 'Select a status.'}
            clearable
          />
          <FormSelect
            label="Product (searchable + clearable)"
            name="productId"
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
            options={PRODUCT_OPTIONS}
            searchable
            clearable
          />
          <div className="flex flex-col gap-2">
            <FormSelect
              label="Category (async options)"
              name="categoryId"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              options={categories}
              loading={categoriesLoading}
            />
            <Button
              size="sm"
              variant="secondary"
              icon={RotateCw}
              onClick={loadCategories}
              disabled={categoriesLoading}
            >
              {categories.length ? 'Reload options' : 'Load options'}
            </Button>
          </div>
        </div>
      </Section>

      <Section title="FormMoney">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <FormMoney
              label="Credit limit"
              name="creditLimit"
              value={creditLimit}
              currency="ETB"
              onChange={setCreditLimit}
              hint="Type 1499.00 and watch the integer below."
            />
            {/* The whole point of the component, made visible: what the caller
                receives is an integer, never the string that was typed. */}
            <p className="font-mono text-xs text-text-muted">
              onChange → {String(creditLimit)} ({typeof creditLimit})
              <br />
              formatMoney → {formatMoney(creditLimit, 'ETB')}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <FormMoney
              label="Amount (zero-decimal currency)"
              name="jpyAmount"
              value={jpyAmount}
              currency="JPY"
              onChange={setJpyAmount}
              hint="JPY has no minor unit, so 1500 means ¥1,500."
            />
            <p className="font-mono text-xs text-text-muted">
              onChange → {String(jpyAmount)} ({typeof jpyAmount})
              <br />
              formatMoney → {formatMoney(jpyAmount, 'JPY')}
            </p>
          </div>
        </div>
        <p className="text-xs text-text-muted">
          Integer minor units in, integer minor units out — never a float. The
          currency decides the number of decimal places, so the same component
          handles ETB and JPY without the caller doing anything. Clearing the
          field emits <span className="font-mono">null</span>, not{' '}
          <span className="font-mono">0</span>.
        </p>
        <p className="text-xs text-text-muted">
          Use with <span className="font-mono">Controller</span>, never{' '}
          <span className="font-mono">register</span> — onChange emits a number
          rather than an event. See docs/components.md § Forms.
        </p>
      </Section>

      <Section title="FormTextarea">
        <div className="max-w-md">
          <FormTextarea
            label="Notes"
            name="notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            maxLength={200}
            hint="Capped at 200 characters."
          />
        </div>
        <p className="text-xs text-text-muted">
          Delegates to FormField with{' '}
          <span className="font-mono">type=&quot;textarea&quot;</span>, so there
          is one textarea in the kit rather than two. No character counter — see
          README § Known gaps. {notes.length}/200 typed.
        </p>
      </Section>

      <Section title="FormCheckbox">
        <div className="flex max-w-md flex-col gap-3">
          <FormCheckbox
            label="Customer is tax exempt"
            name="taxExempt"
            checked={taxExempt}
            onChange={(event) => setTaxExempt(event.target.checked)}
            hint="Removes VAT from every line on this customer's invoices."
          />
          <FormCheckbox
            label="I accept the terms"
            name="terms"
            checked={termsAccepted}
            onChange={(event) => setTermsAccepted(event.target.checked)}
            error={termsAccepted ? undefined : 'You must accept the terms.'}
          />
          <FormCheckbox label="Disabled" name="disabledBox" checked disabled />
        </div>
        <p className="text-xs text-text-muted">
          Label sits beside the box rather than above it. Works with{' '}
          <span className="font-mono">register</span> — RHF reads{' '}
          <span className="font-mono">event.target.checked</span>.
        </p>
      </Section>

      <Section title="FormDate">
        <div className="grid gap-4 md:grid-cols-2">
          <FormDate
            label="Order date"
            name="orderDate"
            value={orderDate}
            onChange={(event) => setOrderDate(event.target.value)}
            required
            hint="Stored and emitted as YYYY-MM-DD."
          />
          {/* min is the order date, so the picker itself refuses earlier days —
              type a bad one anyway and the error below appears. */}
          <FormDate
            label="Expected delivery"
            name="expectedDelivery"
            value={deliveryDate}
            onChange={(event) => setDeliveryDate(event.target.value)}
            min={orderDate}
            max="2027-12-31"
            error={deliveryError}
            hint="min is the order date; max is 2027-12-31."
          />
        </div>
        <p className="text-xs text-text-muted">
          Delegates to FormField with{' '}
          <span className="font-mono">type=&quot;date&quot;</span>, so there is
          one date input in the kit rather than two.{' '}
          <span className="font-mono">min</span> and{' '}
          <span className="font-mono">max</span> are not handled by the
          component — they ride FormField&apos;s prop spread straight onto the
          element.
        </p>
      </Section>

      <Section title="FormSection, FormRow and FormActions">
        {/* A real <form>, so FormActions' type="submit" is doing the
            submitting: press Enter in any field and it fires the same handler
            as the button. */}
        <form
          onSubmit={submitDemoForm}
          className="flex flex-col gap-6 rounded-md border border-border bg-surface p-4"
        >
          <FormSection
            title="Customer"
            description="Who the invoice is addressed to."
          >
            <FormRow>
              <FormField
                label="Customer name"
                name="sectionName"
                defaultValue="Acme Trading PLC"
              />
              <FormField
                label="TIN"
                name="sectionTin"
                defaultValue="0001234567"
              />
            </FormRow>

            <FormRow columns={3}>
              <FormField
                label="City"
                name="sectionCity"
                defaultValue="Addis Ababa"
              />
              <FormField
                label="Region"
                name="sectionRegion"
                defaultValue="Addis Ababa"
              />
              <FormField
                label="Postal code"
                name="sectionPostal"
                defaultValue="1000"
              />
            </FormRow>
          </FormSection>

          {/* description is optional. */}
          <FormSection title="Terms">
            <FormRow>
              <FormField
                label="Payment terms (days)"
                name="sectionTerms"
                type="number"
                defaultValue={30}
              />
              <FormField
                label="Purchase order reference"
                name="sectionPoRef"
                placeholder="Optional"
              />
            </FormRow>
          </FormSection>

          <FormActions
            submitLabel="Save customer"
            onCancel={() => setLastAction('Form cancelled')}
            loading={formSaving}
          />
        </form>

        <p className="text-xs text-text-muted">
          FormRow is one column below 768px whatever{' '}
          <span className="font-mono">columns</span> says — narrow the window
          and the three-across row stacks. Cancel is{' '}
          <span className="font-mono">type=&quot;button&quot;</span>: clicking
          it reports &ldquo;Form cancelled&rdquo; and never &ldquo;Form
          submitted&rdquo;, which is the whole point of it not defaulting to
          submit.
        </p>
      </Section>

      <Section title="DataTable">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setTableLoading(true);
              later(() => setTableLoading(false), 1200);
            }}
          >
            Show loading state
          </Button>
          <span className="text-xs text-text-muted">
            Search, sort and pagination are wired locally here so the callbacks
            visibly work. Real pages get all three from the server.
          </span>
        </div>

        {/* Row actions are filtered by the signed-in user's permissions — sign
            in as staff and Edit/Delete disappear. */}
        <DataTable
          columns={columns}
          data={tableLoading ? [] : pageRows}
          loading={tableLoading}
          page={safePage}
          perPage={perPage}
          total={rows.length}
          onPageChange={setPage}
          onPerPageChange={(value) => {
            setPerPage(value);
            setPage(1);
          }}
          sort={sort}
          onSortChange={setSort}
          searchable
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          onRowClick={(row) => setLastAction(`Row opened: ${row.code}`)}
          rowActions={(row) => [
            {
              label: 'Edit',
              icon: Pencil,
              permission: 'customers.edit',
              onClick: () => setLastAction(`Edit ${row.code}`),
            },
            {
              label: 'Delete',
              icon: Trash,
              permission: 'customers.delete',
              destructive: true,
              onClick: () => setLastAction(`Delete ${row.code}`),
            },
            // Hidden: the demo user has no orders.approve.
            {
              label: 'Approve',
              permission: 'orders.approve',
              onClick: () => {},
            },
          ]}
          selectable
          selectedIds={selected}
          onSelectionChange={setSelected}
          bulkActions={[
            {
              label: 'Export selected',
              onClick: () =>
                setLastAction(`Export ${selected.length} selected`),
            },
          ]}
          rowKey="id"
          stickyHeader
          density="comfortable"
        />
      </Section>

      <Section title="Modal">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setModalOpen(true)}>
            Open modal
          </Button>
          <span className="text-xs text-text-muted">
            Tab cycles inside the dialog, Escape closes it, and focus returns to
            the button that opened it.
          </span>
        </div>

        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Edit customer"
          description="Focus is trapped here until the dialog closes."
          size="md"
          footer={
            <>
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setModalOpen(false);
                  toast.success('Saved Acme Trading PLC');
                }}
              >
                Save
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <p className="text-text-muted">
              Two focusable fields, so tab-cycling is visible.
            </p>
            <FormField
              label="Customer name"
              name="modalName"
              defaultValue="Acme Trading PLC"
            />
            <FormField label="Email" name="modalEmail" type="email" />
          </div>
        </Modal>
      </Section>

      <Section title="Drawer">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setDrawerSide('right');
              setDrawerOpen(true);
            }}
          >
            Open drawer (right)
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setDrawerSide('left');
              setDrawerOpen(true);
            }}
          >
            Open drawer (left)
          </Button>
          <span className="text-xs text-text-muted">
            Same focus trap, Escape and scroll lock as Modal — both use
            useDialogFocus. Full width below 768px whatever the size.
          </span>
        </div>

        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title="Customer details"
          side={drawerSide}
          size="md"
        >
          <div className="flex flex-col gap-4">
            <p className="text-text-muted">
              Two focusable fields, so tab-cycling is visible.
            </p>
            <FormField
              label="Customer name"
              name="drawerName"
              defaultValue="Acme Trading PLC"
            />
            <FormField label="Email" name="drawerEmail" type="email" />
          </div>
        </Drawer>
      </Section>

      <Section title="ConfirmDialog">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
            Delete customer
          </Button>
          <span className="text-xs text-text-muted">
            Confirming runs a fake 1.5s delete — the dialog stays open and
            locked while it is in flight, then toasts.
          </span>
        </div>

        <ConfirmDialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={confirmDelete}
          title="Delete customer?"
          description="This archives the customer. Existing orders are unaffected."
          confirmLabel="Delete"
          variant="destructive"
          loading={deleting}
        />
      </Section>

      <Section title="Toast">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => toast.success('Customer saved')}
          >
            Success
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              toast.error('Could not save customer', {
                description: 'The code CUS-0001 is already in use.',
              })
            }
          >
            Error
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast.warning('Credit limit exceeded')}
          >
            Warning
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast.info('Export queued')}
          >
            Info
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              toast.info('This one stays until dismissed', { duration: 0 })
            }
          >
            Sticky
          </Button>
        </div>
        <p className="text-xs text-text-muted">
          Imperative — no provider wiring in module code. A single Toaster is
          mounted in providers.jsx. Toasts auto-dismiss after 5s unless{' '}
          <span className="font-mono">duration: 0</span>.
        </p>
      </Section>

      <Section title="DataTable — empty state" fixed>
        <DataTable columns={columns} data={[]} total={0} />
      </Section>

      <Section title="DataTable — error state" fixed>
        <DataTable
          columns={columns}
          data={[]}
          total={0}
          error={{ message: 'Could not load customers. Try again.' }}
        />
      </Section>

      <Section title="EmptyState">
        {/* Boxed so the centring is visible against a container edge. */}
        <div className="rounded-md border border-border bg-surface">
          <EmptyState
            icon={Users}
            title="No customers yet"
            description="Customers you add will appear here."
            action={{
              label: 'Add customer',
              onClick: () => setLastAction('EmptyState action clicked'),
            }}
          />
        </div>
        <p className="text-xs text-text-muted">
          <span className="font-mono">icon</span> and{' '}
          <span className="font-mono">action</span> are both optional. DataTable
          falls back to a title-and-description one when a module passes no{' '}
          <span className="font-mono">emptyState</span>, which is what the two
          sections above render.
        </p>
      </Section>

      <Section title="Skeleton">
        <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SkeletonSample label='variant="text" rows={4}'>
            <Skeleton variant="text" rows={4} />
          </SkeletonSample>

          <SkeletonSample label='variant="card"'>
            <Skeleton variant="card" />
          </SkeletonSample>

          <SkeletonSample label='variant="table" rows={5}'>
            <Skeleton variant="table" rows={5} />
          </SkeletonSample>

          <SkeletonSample label='variant="form"'>
            <Skeleton variant="form" />
          </SkeletonSample>
        </div>
        <p className="text-xs text-text-muted">
          <span className="font-mono">rows</span> applies to text and table only
          — card and form ignore it. The pulse is removed entirely under{' '}
          <span className="font-mono">prefers-reduced-motion</span>, not just
          shortened.
        </p>
      </Section>
    </div>
  );
}
