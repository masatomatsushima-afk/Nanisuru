import { useEffect } from 'react';

import { checkSupabaseSetup } from '@/lib/supabase-persistence';

/** Runs Supabase table probes once on mount in dev builds. Renders nothing. */
export function DevSupabaseSetupProbe() {
  useEffect(() => {
    void checkSupabaseSetup();
  }, []);

  return null;
}
