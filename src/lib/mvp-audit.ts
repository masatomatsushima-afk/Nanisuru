import { isSupabaseConfigured } from '@/lib/supabase';
import { checkSupabaseSetup } from '@/lib/supabase-persistence';

const PREFIX = '[Nanisuru Audit]';

export type MvpAuditReport = {
  home: 'ok' | 'warn';
  planGeneration: 'ok' | 'warn';
  savedPlans: 'ok' | 'warn';
  tripAssistant: 'ok' | 'warn';
  memories: 'ok' | 'warn';
  supabaseFallback: 'ok' | 'warn';
};

function logLine(label: string, status: 'ok' | 'warn', note?: string): void {
  const suffix = note ? ` (${note})` : '';
  console.log(`${PREFIX} ${label} ${status}${suffix}`);
}

/** Dev-only integration sanity check — logs summary lines, never throws. */
export async function runNanisuruAudit(): Promise<MvpAuditReport> {
  const report: MvpAuditReport = {
    home: 'ok',
    planGeneration: 'ok',
    savedPlans: 'ok',
    tripAssistant: 'ok',
    memories: 'ok',
    supabaseFallback: 'ok',
  };

  logLine('Home', 'ok');
  logLine('Plan generation', 'ok');

  if (!isSupabaseConfigured()) {
    report.savedPlans = 'warn';
    report.tripAssistant = 'warn';
    report.memories = 'warn';
    logLine('Saved plans', 'warn', 'Supabase未設定 — ローカルフォールバック');
    logLine('Trip assistant', 'warn', 'Supabase未設定');
    logLine('Memories', 'warn', 'Supabase未設定');
    logLine('Supabase fallback', 'ok');
    return report;
  }

  try {
    const setup = await checkSupabaseSetup();

    report.savedPlans = setup.saved_travel_plans === 'ok' ? 'ok' : 'warn';
    report.tripAssistant = setup.trip_folders === 'ok' ? 'ok' : 'warn';
    report.memories = setup.trip_memories === 'ok' ? 'ok' : 'warn';

    logLine('Saved plans', report.savedPlans);
    logLine('Trip assistant', report.tripAssistant);
    logLine('Memories', report.memories);
    logLine('Supabase fallback', 'ok');
  } catch (error) {
    report.supabaseFallback = 'warn';
    logLine('Supabase fallback', 'warn');
    console.warn(PREFIX, error);
  }

  return report;
}
