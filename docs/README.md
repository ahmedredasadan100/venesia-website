# Venesia Canonical Documentation

This directory contains the small, authoritative documentation set for Venesia Website/CMS.

## Authority and reading order

1. Current explicit decision by the Project Owner
2. Approved ADR
3. `../AI_ARCHITECTURE_PRINCIPLES.md`
4. Typed contracts, adoption manifests, registries, and architecture guards
5. Current verified code, migrations, and tests
6. `CURRENT_PROJECT_STATE.md`
7. Other canonical documents in this directory
8. PR reports and historical evidence
9. Screenshots, old plans, and model memory

A lower source must not silently override a higher source.

## Canonical files

| File | Purpose | Volatility |
|---|---|---|
| `../AGENTS.md` | Mandatory entry point for coding agents | Low |
| `../AI_ARCHITECTURE_PRINCIPLES.md` | Architecture constitution, ownership, boundaries, ADRs, closure rules | Very low |
| `AI_WORKING_RULES.md` | Discovery, execution, QA, Git, Ready, Merge, and reporting contract | Low |
| `CURRENT_PROJECT_STATE.md` | Current baseline, active work, closed scope, and verified operational facts | High |
| `SYSTEMS_RUNTIMES_CAPABILITIES.md` | Canonical owner map and domain boundaries | Medium |
| `DATABASE_MIGRATIONS_STORAGE.md` | Database, migration provenance, atomicity, audit, and storage rules | Low |
| `QA_RELEASE_CLOSURE.md` | Test layers, Browser QA, evidence, delivery, and closure | Low |
| `ROADMAP_AND_DEBT_REGISTER.md` | Confirmed findings, approved exceptions, debt, and execution roadmap | High |
| `ADR_MEDIA_CATALOG_REFERENCE_SAFETY.md` | Accepted canonical identity, reference, deletion, and replacement decision for Media | Low |

The constitution embeds project-wide ADRs. A dedicated ADR file is allowed only for a bounded decision that needs operational detail; it must remain linked from this index and must not create a second constitutional owner.

## Update rules

### Architecture constitution

Change only when ownership, dependency direction, closure definitions, or architecture decisions change. A material change requires an ADR and Project Owner approval.

### Current project state

Update after:

- a relevant PR merges;
- the official baseline changes;
- a migration or deployment fact is proven;
- an audit is accepted;
- a broader closure claim changes.

Every fact must identify its evidence or explicitly remain unverified.

### Systems and capabilities map

Update when an owner, contract, adopter class, or bounded-context relationship changes. Do not hard-code volatile PR status here.

### Roadmap and debt register

Only confirmed, evidence-backed findings belong here. Ideas and product options must remain clearly separated from defects and required work.

### Contract drift review

When a current fact conflicts with a canonical document, compare the exact code, typed contracts, runtime validation, manifests, guards, consumers, GitHub state, and environment proof. Classify the conflict before editing: stale documentation, legacy implementation debt, incomplete adoption, or a new decision. Do not let either old prose or incidental code silently redefine the owner.

## Documentation anti-patterns

Do not add:

- per-PR closure reports as permanent docs;
- screenshots and generated QA JSON;
- dead-code scan dumps;
- one-off audit reports in the repository root;
- dated plans that remain after the workstream closes;
- binary Word files as an authority source;
- a second architecture constitution;
- duplicate descriptions of the same Runtime or Capability.

When a phase changes a canonical fact, update the existing canonical file. Do not create a new dated document.

## Historical evidence policy

Routine execution evidence belongs in the PR, CI, or local `.tmp-qa/`.

A historical file may remain in Git history. It does not need to remain in the active repository tree to preserve evidence.

## Documentation-only changes

A documentation reset must still prove:

- intended files only;
- no code, migration, environment, or data change;
- valid links and paths;
- `git diff --check`;
- accurate current state;
- no overclaiming.

A documentation-only PR must not be used to smuggle architecture, permission, migration, or runtime changes.
