/** Postgres / PostgREST errors when a column has not been migrated yet. */
export function isMissingPostgresColumn(
  error: { message?: string } | null | undefined,
  column: string,
): boolean {
  if (!error?.message) return false;
  const message = error.message.toLowerCase();
  const col = column.toLowerCase();
  return message.includes(col) && message.includes('does not exist');
}

let showOnProfileColumnKnown = false;
let showOnProfileColumnAvailable = true;

export function noteShowOnProfileColumnMissing(
  error: { message?: string } | null | undefined,
): boolean {
  if (!isMissingPostgresColumn(error, 'show_on_profile')) return false;
  showOnProfileColumnKnown = true;
  showOnProfileColumnAvailable = false;
  return true;
}

/** When false, omit show_on_profile from SELECT and WHERE clauses. */
export function shouldUseShowOnProfileColumn(): boolean {
  return !showOnProfileColumnKnown || showOnProfileColumnAvailable;
}
