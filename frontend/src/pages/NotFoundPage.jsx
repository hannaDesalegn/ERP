/**
 * 404 — owned by A.
 *
 * Copy says what happened and what to do, in the interface's voice.
 * Not "Oops!", not a sad face. docs/components.md § Error copy.
 */

import { FileQuestion } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui';

export function NotFoundPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center">
      <FileQuestion size={32} className="text-text-muted" aria-hidden="true" />

      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-text">Page not found</h1>
        <p className="text-sm text-text-muted">
          Nothing exists at{' '}
          <span className="font-mono text-xs text-text">{pathname}</span>. It
          may have been moved, or the link may be wrong.
        </p>
      </div>

      {/* Button renders a <button>, so navigate rather than nesting a <Link>. */}
      <Button variant="secondary" onClick={() => navigate('/dashboard')}>
        Back to dashboard
      </Button>
    </div>
  );
}
