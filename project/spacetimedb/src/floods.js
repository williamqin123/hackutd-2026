import { validateFlood } from '../../shared/validation.js';

export function importFloodRecords(ctx, rows) {
  if (!rows.length || rows.length > 100) throw new Error('Import between 1 and 100 rows per batch.');
  for (const row of rows) {
    validateFlood(row);
    if (!ctx.db.floods.id.find(row.id)) ctx.db.floods.insert(row);
  }
}
