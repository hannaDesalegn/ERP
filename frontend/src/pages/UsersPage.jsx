/**
 * Users — owned by A. Account administration.
 *
 * The first real use of <RequireRole roles={['admin']}>, which wraps the whole
 * route in app/router.jsx. On top of that the row actions carry users.edit and
 * users.delete, so they disappear for anyone without them. Both are UX: the
 * server authorises every one of these calls independently, and refuses the
 * dangerous one on its own — docs/security-notes.md §2.
 *
 * Create and edit are one Drawer over the list rather than a route of their
 * own. An admin fixing five accounts should not lose their place in the table,
 * and the form is five fields.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash, UserCog } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Can, useAuth } from '@/auth/AuthContext';
import {
  Button,
  ConfirmDialog,
  DataTable,
  Drawer,
  EmptyState,
  FormField,
  FormSelect,
  PageHeader,
  StatusBadge,
  toast,
} from '@/components/ui';
import { apiClient } from '@/lib/apiClient';
import { formatDateTime } from '@/lib/format';
import { useTableParams } from '@/lib/useTableParams';

// ── API ──────────────────────────────────────────────────────────────────────
// Foundation pages are not modules and have no api.js to live in. These move to
// src/pages/api.js alongside the dashboard's call when settings lands and there
// are three of them; two does not yet pay for the file.

const RESOURCE = '/users';

const userKeys = {
  all: ['users'],
  lists: () => [...userKeys.all, 'list'],
  list: (params) => [...userKeys.lists(), params],
};

const roleKeys = { all: ['roles'], list: () => ['roles', 'list'] };

/** Returns the whole envelope — the caller needs `meta` for pagination. */
function fetchUsers(params) {
  return apiClient.get(RESOURCE, params);
}

async function fetchRoles() {
  const { data } = await apiClient.get('/roles');
  return data;
}

async function createUser(body) {
  const { data } = await apiClient.post(RESOURCE, body);
  return data;
}

async function updateUser(id, body) {
  const { data } = await apiClient.patch(`${RESOURCE}/${id}`, body);
  return data;
}

/** Returns nothing — the API answers 204. */
function deleteUser(id) {
  return apiClient.delete(`${RESOURCE}/${id}`);
}

// ── Validation ───────────────────────────────────────────────────────────────
// Zod here is UX; the server re-validates all of it. Server-managed fields are
// absent on purpose — id, roleName, permissions, lastLoginAt, createdAt,
// updatedAt. permissions especially: it follows the role, and a client that
// could send its own array could grant itself anything.

const userCreateSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter an email address.')
    .email('Must be a valid email address.'),
  firstName: z
    .string()
    .trim()
    .min(1, 'Enter a first name.')
    .max(100, 'First name is too long.'),
  lastName: z
    .string()
    .trim()
    .min(1, 'Enter a last name.')
    .max(100, 'Last name is too long.'),
  roleId: z.string().min(1, 'Choose a role.'),
  status: z.enum(['active', 'invited', 'suspended']),
});

/** PATCH: same rules, every field optional. Never restate the rules. */
const userUpdateSchema = userCreateSchema.partial();

/**
 * One field, one control, two option sets. Suspending an account that has never
 * been used is not a state worth reaching from the create form, so the third
 * option appears only on edit.
 */
const CREATE_STATUS_OPTIONS = [
  { value: 'invited', label: 'Invited' },
  { value: 'active', label: 'Active' },
];

const EDIT_STATUS_OPTIONS = [
  ...CREATE_STATUS_OPTIONS,
  { value: 'suspended', label: 'Suspended' },
];

const columns = [
  {
    key: 'lastName',
    label: 'Name',
    sortable: true,
    // Sorting is server-side and sorts a field, so the key is lastName. The
    // cell shows both names, which is what the header promises.
    render: (row) => `${row.firstName} ${row.lastName}`,
  },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'roleName', label: 'Role', sortable: true },
  {
    key: 'status',
    label: 'Status',
    render: (row) => <StatusBadge status={row.status} variant="auto" />,
  },
  {
    key: 'lastLoginAt',
    label: 'Last sign-in',
    sortable: true,
    hideBelow: 'xl',
    // null for an invited account who has never signed in → an em dash.
    render: (row) => formatDateTime(row.lastLoginAt),
  },
];

/**
 * Create and edit, one form.
 *
 * Mounted only while open and keyed on the user (see UsersPage), so each open
 * starts from fresh defaultValues. That is why there is no reset effect here —
 * the remount is the reset, and there is no second copy of the defaults to
 * drift out of step.
 */
function UserFormDrawer({ user, roleOptions, rolesLoading, onClose }) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(user);

  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(isEdit ? userUpdateSchema : userCreateSchema),
    defaultValues: {
      email: user?.email ?? '',
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      roleId: user?.roleId ?? '',
      // A new account is invited until the admin says otherwise.
      status: user?.status ?? 'invited',
    },
  });

  const save = useMutation({
    mutationFn: (values) =>
      isEdit ? updateUser(user.id, values) : createUser(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      // Same verb as the button that caused it — docs/components.md § Overlays.
      toast.success(isEdit ? 'User saved' : 'User created');
      onClose();
    },
    onError: (error) => {
      // 422 carries `fields`, which maps straight onto the inputs. Anything
      // else — a 409 on a duplicate email, a 500 — is one toast.
      if (error.fields) {
        Object.entries(error.fields).forEach(([name, message]) =>
          setError(name, { message }),
        );
        return;
      }
      toast.error(isEdit ? 'Could not save user' : 'Could not create user', {
        description: error.message,
      });
    },
  });

  return (
    <Drawer
      open
      onClose={onClose}
      title={isEdit ? 'Edit user' : 'Add user'}
      size="md"
    >
      <form
        onSubmit={handleSubmit((values) => save.mutate(values))}
        className="flex flex-col gap-4"
      >
        <FormField
          label="Email"
          type="email"
          required
          error={errors.email?.message}
          hint="This is the address they sign in with."
          {...register('email')}
        />

        <FormField
          label="First name"
          required
          error={errors.firstName?.message}
          {...register('firstName')}
        />

        <FormField
          label="Last name"
          required
          error={errors.lastName?.message}
          {...register('lastName')}
        />

        {/* Controller rather than register: FormSelect renders a controlled
            <select>, so it needs `value` fed back in. register supplies an
            onChange but no value, which pins the select to its placeholder.
            Same carve-out as FormMoney — docs/components.md § Forms. */}
        <Controller
          name="roleId"
          control={control}
          render={({ field }) => (
            <FormSelect
              label="Role"
              name={field.name}
              value={field.value ?? ''}
              onChange={field.onChange}
              options={roleOptions}
              loading={rolesLoading}
              required
              error={errors.roleId?.message}
              hint="Permissions come from the role, not from the account."
            />
          )}
        />

        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <FormSelect
              label="Status"
              name={field.name}
              value={field.value ?? ''}
              onChange={field.onChange}
              options={isEdit ? EDIT_STATUS_OPTIONS : CREATE_STATUS_OPTIONS}
              required
              error={errors.status?.message}
            />
          )}
        />

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={save.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending}>
            {isEdit ? 'Save user' : 'Create user'}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const {
    page,
    perPage,
    sort,
    search,
    setPage,
    setPerPage,
    setSort,
    setSearch,
    queryParams,
  } = useTableParams({
    defaults: { perPage: 25, sort: 'lastName' },
    filterKeys: ['status'],
  });

  const { data, isLoading, error } = useQuery({
    queryKey: userKeys.list(queryParams),
    queryFn: () => fetchUsers(queryParams),
    placeholderData: (previous) => previous,
  });

  // null = closed. { user: null } = create, { user } = edit.
  const [drawer, setDrawer] = useState(null);
  const [deleting, setDeleting] = useState(null);

  // Only the form reads roles, so nothing is fetched until it opens.
  const rolesQuery = useQuery({
    queryKey: roleKeys.list(),
    queryFn: fetchRoles,
    enabled: drawer !== null,
    staleTime: 5 * 60_000,
  });

  const roleOptions = (rolesQuery.data ?? []).map((role) => ({
    value: role.id,
    label: role.name,
  }));

  const remove = useMutation({
    mutationFn: (id) => deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
      toast.success('User deleted');
      setDeleting(null);
    },
    onError: (mutationError) => {
      // Includes the 409 for "that account is you". The UI already hides that
      // action, so reaching this means the server caught what the UI did not —
      // which is the whole point of the server owning the rule.
      toast.error('Could not delete user', {
        description: mutationError.message,
      });
      setDeleting(null);
    },
  });

  const rows = data?.data ?? [];
  const meta = data?.meta ?? { page, perPage, total: 0 };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 p-6">
      <PageHeader
        title="Users"
        description="Who can sign in, and what they can do."
        actions={
          <Can permission="users.create">
            <Button icon={Plus} onClick={() => setDrawer({ user: null })}>
              Add user
            </Button>
          </Can>
        }
      />

      <DataTable
        columns={columns}
        data={rows}
        loading={isLoading}
        error={error}
        page={meta.page}
        perPage={meta.perPage}
        total={meta.total}
        onPageChange={setPage}
        onPerPageChange={setPerPage}
        sort={sort}
        onSortChange={setSort}
        searchable
        searchValue={search}
        onSearchChange={setSearch}
        emptyState={
          <EmptyState
            icon={UserCog}
            title="No users match this search"
            description="Everyone with an account appears here."
            action={{
              label: 'Add user',
              onClick: () => setDrawer({ user: null }),
            }}
          />
        }
        rowActions={(row) => [
          {
            label: 'Edit',
            icon: Pencil,
            permission: 'users.edit',
            onClick: () => setDrawer({ user: row }),
          },
          // Your own row gets no Delete. The server refuses it too, with a 409 —
          // this only stops the UI offering something that cannot happen.
          ...(row.id === currentUser?.id
            ? []
            : [
                {
                  label: 'Delete',
                  icon: Trash,
                  permission: 'users.delete',
                  destructive: true,
                  onClick: () => setDeleting(row),
                },
              ]),
        ]}
        rowKey="id"
        stickyHeader
        density="comfortable"
      />

      {drawer && (
        <UserFormDrawer
          // Remount per target, so the form always opens with fresh defaults.
          key={drawer.user?.id ?? 'new'}
          user={drawer.user}
          roleOptions={roleOptions}
          rolesLoading={rolesQuery.isLoading}
          onClose={() => setDrawer(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => remove.mutate(deleting.id)}
        title="Delete this user?"
        description={
          deleting
            ? `${deleting.firstName} ${deleting.lastName} loses access immediately. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete user"
        variant="destructive"
        loading={remove.isPending}
      />
    </div>
  );
}
