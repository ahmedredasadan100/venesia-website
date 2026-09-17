# Migration 69 history compatibility

`historical-applied.sql` preserves the unchanged previously applied revision,
outside the executable migration corpus. Its LF-normalized SHA256 is
`4ac009d3f68e5efab454caff91cbe020081450b13cf7980e6f91b5d61e26eb9b`.
The separate corrected-source identity is registered in the existing
`scripts/lib/migration-history-compatibility.json` owner.

The original migration updates non-published Pages to `unpublished` before
replacing the baseline CHECK, which permits only `draft`, `published`, `hidden`,
and `archived`. Any Page in one of those non-published states exposes the order
conflict. A valid draft Home is one such input; its creation is not the defect.

The correction preserves the original Topics/Projects/Pages first-touch order.
Immediately before the existing Page update, it acquires an ACCESS EXCLUSIVE
Page table lock and verifies the legacy table, status column, single relevant
CHECK definition, column identity, validation and inheritance properties. A
missing, changed, inherited, or ambiguous contract fails closed.

Only then does the migration replace the legacy CHECK with the final binary
CHECK as NOT VALID. New and updated rows must satisfy that final CHECK; the
existing rows are normalized by the original UPDATE and validated at the
original constraint-finalization position. No transitional status policy,
union CHECK, skipped validation, or persistent helper is introduced. All other
publication mappings, defaults, functions, triggers, indexes and ACL operations
remain unchanged inside the original transaction.

Existing databases retain their exact recorded historical revision. They do not
replay Migration 69, rewrite registry statements, or receive permission/schema
repair through this compatibility entry. Fresh databases execute the separately
identified corrected revision. Unknown source or registry revisions fail closed.
Official CLI parsed-statement receipts remain distinct from whole-file registry
provenance; neither representation is rewritten into the other.
