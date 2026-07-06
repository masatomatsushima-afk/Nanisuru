import { useEffect } from 'react';

import { runNanisuruAudit } from '@/lib/mvp-audit';

/** Runs MVP integration audit once on mount in dev builds. Renders nothing. */
export function DevMvpAuditProbe() {
  useEffect(() => {
    void runNanisuruAudit();
  }, []);

  return null;
}
