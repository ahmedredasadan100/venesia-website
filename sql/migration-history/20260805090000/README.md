# Migration 60 history compatibility

`historical-applied.sql` is the unchanged previously applied revision. Its hash
and the corrected executable revision are bound in
`scripts/lib/migration-history-compatibility.json`. Existing databases keep
their recorded SQL. No replay or registry rewrite is required or authorized.

The corrected migration separates two inputs:

- **Historical configured:** the original Footer parity, published composition,
  and two actual retirement Audit events remain mandatory.
- **Proven fresh:** exact canonical migration 1–59 receipts, Migration 59's
  validated-empty provenance, required Page/Footer structure, and the canonical
  seeded application state must match. Missing configuration alone is never
  evidence of freshness. Partial or ambiguous state fails closed.

Seed-state fingerprints qualify the input; they neither seed data nor define
business defaults. Creation/update timestamps are excluded. The Media folder
owner generates UUIDs, so its two root folders are compared by their complete
logical payload and UNIQUE `normalized_path` identity, leaving UUIDs unchanged.

Fresh initialization uses the Footer owner's structural preset, without text,
contact/social/legal business values, enabled output, or legacy `footer.brand`.
Only exact qualified historical Footer seed values are cleared. Home is created
as `/` / `home`, system-owned and `draft`; the later publication normalization
turns that status into `unpublished`. No Home assignments are synthesized.

The read-only migration provenance function attests the path actually executed
and projects live configuration facts. Footer and Global SEO remain the only
readiness evaluators. System validity and publication readiness are distinct;
incomplete publication never becomes a fabricated historical closure event.

The executable SQL preset is checked against `createFreshFooterSettings()`.
Synthetic historical data exists only in the isolated verification helper and
is never part of fresh application handoff.
