# Current Database Security Contract

Owner: Database security and migration provenance. The executable declarations
start in migrations 107 and 108, then migration 110 records revision 3 after its
new Layout and Region objects exist. `scripts/lib/database-rls-security-contract.mts`
is their read only parser and verifier.

## Why the historical contract was brittle

The earlier revision treated the entire `pg_roles` inventory and every role
attribute as one platform snapshot. A legitimate Supabase image change could
therefore fail the application contract even when no application or public role
gained a privilege. The current format separates application invariants from
explicitly reviewed platform compatibility. Unknown roles and memberships still
fail closed.

## Role ownership

| Role family | Ownership | Required checks |
| --- | --- | --- |
| `anon`, `authenticated` | Application public | Required; no SUPERUSER, BYPASSRLS, CREATEROLE, CREATEDB or REPLICATION; no path to `service_role` or an owner |
| `service_role` | Application server | Required; exact reviewed attributes, memberships and object access |
| `postgres`, `supabase_admin` | Platform administration | Explicit attributes and memberships; no public or application membership path |
| `authenticator`, `supabase_*`, `pg_*` | Platform managed or PostgreSQL built in | Explicit presence rule, bounded attributes and exact membership tuples |
| `cli_login_postgres` | Conditional platform tooling | Optional; exact login attributes and `SET ROLE postgres` membership; credential, session, ownership and ACL checks |

`supabase_realtime_admin` is a classified platform role. Its three explicit
non inherited, non admin `SET ROLE` memberships to `anon`, `authenticated`, and
`service_role` are accepted. A new platform role or membership is rejected until
it receives a reviewed classification.

## Application invariants

The contract verifies one catalog snapshot for:

- every public application table, its owner, RLS state, policies, direct grants,
  grant options and effective client and column access;
- schema privileges, default table and sequence privileges, column ACLs and
  sequence ACLs;
- client function EXECUTE, SECURITY DEFINER reachability, grant options and
  default function privileges;
- role attributes and all role memberships, including INHERIT, SET ROLE and
  ADMIN options;
- absence of public role paths to privileged attributes, owners or
  `service_role`.

## Conditional CLI role

If `cli_login_postgres` exists, all of these conditions are required together:

1. It matches the exact reviewed Supabase CLI role and membership shape.
2. It has a configured credential and a documented expiry value.
3. It has no active session during verification.
4. It owns no application table, sequence or function.
5. It has no direct application object ACL.
6. No application or public role can reach it through membership.

Expiry alone is not accepted as security evidence. The migration does not
create, delete, alter or rotate this role.

## 107 and 108 disposition

Both files were never applied to Production and may be revised without changing
an applied receipt. Their old committed forms are retained as historical source
evidence. Migration 107 now adopts the platform aware revision 1 and migration
108 verifies and supersedes it with revision 2 after the later application
tables exist. Migration 110 verifies revision 2 and supersedes it with revision
3 so the same contract covers `page_composition_layouts`,
`page_composition_regions`, their sequence and the three Region validation
functions. The fresh database branches in migrations 86 and 99 recognize the
explicit historical, superseded fresh, and corrected source revisions. They do
not rewrite an existing registry row or invent an applied receipt.

## Production cutover plan

No step below is authorized by this document.

1. Read the Production migration registry and current catalog without writes.
2. Verify the expected 106 head, exact source revisions, table/RLS/grant state,
   role classifications, `cli_login_postgres` conditions and zero unexpected
   sessions.
3. Apply revised 107 through the official Supabase migration mechanism.
4. Apply revised 108 through the same mechanism and run the read only current
   contract verifier.
5. Apply 109 and 110 only after their Draft PR head and database contract are
   unchanged. Verify revision 3 plus the read only Feed and Region checks after
   110.
6. Stop before Ready, merge or deploy and report the new registry and runtime
   state.

Any catalog, source, session, registry or dependency difference stops before
the first write. There is no migration repair, fake receipt, role mutation,
manual grant, or hidden SQL path.
