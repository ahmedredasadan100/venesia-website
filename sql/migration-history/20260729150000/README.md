# Migration 52 compatibility evidence

`historical-applied.sql` preserves the original, already-applied Migration 52
source. It is evidence only, outside the executable `sql/migrations/` corpus.
It must not be replayed, edited, or used to replace an existing registry row.

The single revision record is
`scripts/lib/migration-history-compatibility.json`. It binds this archive and
the corrected canonical file to separate SHA256 identities, after the existing
LF line-ending normalization. `scripts/lib/migration-provenance.mjs` consumes
that record for source verification and whole-file registry classification.

- Existing databases retain their recorded historical revision exactly. This
  correction requires no SQL, migration replay, constraint rename, or registry
  update on those databases.
- Fresh databases execute the corrected canonical Migration 52. It recognizes
  the three explicit Migration 50 identities only when their complete CHECK
  properties match. The original constraints remain unchanged.
- Unknown source or registry revisions fail closed. Both registry reconciliation
  modes preserve recognized Migration 52 history even when that version is
  explicitly selected for reconciliation.
- Official Supabase CLI parsed-statement receipts remain a distinct execution
  representation. The isolated lifecycle records the verified CLI binary,
  exact staged source hashes, actual statement-array hashes, and unchanged prior
  rows. It never rewrites those receipts into whole-file SQL or claims the two
  representations are identical.

The focused checks are `scripts/verify-migration-history-compatibility.mjs`,
`scripts/verify-selected-migration-registry.mts`, and
`scripts/verify-project-admin-data-entry.mts`. The isolated application handoff
uses `project-migration52-verification.mts` as a read-only before/after catalog
observer; application schema ownership remains with the migration itself.
