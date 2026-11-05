// Code reaches the preview — and may reach production — before migration 0069
// is applied (Nic applies migrations on his own OK). Anything that touches the
// new columns or tables must therefore survive their absence: a crash or a bug
// report is never lost, and a screen never breaks, because of the gap.

type DbError = { code?: string } | null

/** Postgres / PostgREST codes for "that column or table doesn't exist (yet)". */
export function isMissingColumnOrTable(err: DbError): boolean {
  return !!err && ['42703', '42P01', 'PGRST204', 'PGRST205'].includes(err.code ?? '')
}

/**
 * Insert a row that carries `build_id`; if the column isn't there yet, insert
 * it again without — once. Any other error is returned untouched.
 */
export async function withoutBuildIdOnMissingColumn<R extends { build_id?: unknown }>(
  row: R,
  insert: (row: Record<string, unknown>) => Promise<{ error: DbError }>,
): Promise<{ error: DbError }> {
  const first = await insert(row)
  if (!first.error || !isMissingColumnOrTable(first.error) || !('build_id' in row)) return first
  const { build_id: _dropped, ...rest } = row
  return insert(rest)
}
