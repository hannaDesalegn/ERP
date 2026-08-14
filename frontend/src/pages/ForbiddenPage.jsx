/**
 * 403 — owned by A.
 *
 * Where a record's very existence is sensitive the API answers 404 instead, so
 * this page is for the case where the user may know the thing exists but not
 * act on it. docs/api-contract.md §1.
 */

import { ShieldOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui';

export function ForbiddenPage() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center">
      <ShieldOff size={32} className="text-text-muted" aria-hidden="true" />

      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-text">
          You do not have access to this page
        </h1>
        <p className="text-sm text-text-muted">
          Your account is missing the permission this page needs. Ask an
          administrator to grant it if you think that is wrong.
        </p>
      </div>

      <Button variant="secondary" onClick={() => navigate(-1)}>
        Go back
      </Button>
    </div>
  );
}
