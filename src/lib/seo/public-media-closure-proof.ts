/** Pure validation within the existing Global SEO Infrastructure owner. */
export type PublicMediaAuditCounts = Readonly<{ categories: number; items: number; seo: number }>;

export type PublicMediaInfrastructureEvidence = {
  singleSource: boolean | undefined;
  moduleContract: boolean | undefined;
  linkContract: boolean | undefined;
  counts: { categories: number | undefined; items: number | undefined; seo: number | undefined };
};

export type PublicMediaClosureProof =
  | {
      ok: true;
      path: "populated-legacy" | "validated-empty-legacy" | "historical-evidence-compatible";
      expectedAudits: PublicMediaAuditCounts;
      revisionAttested: boolean;
    }
  | { ok: false; reason: string };

const HISTORICAL_COUNTS: PublicMediaAuditCounts = Object.freeze({ categories: 13, items: 28, seo: 14 });
const EMPTY_COUNTS: PublicMediaAuditCounts = Object.freeze({ categories: 0, items: 0, seo: 0 });
const PROVENANCE_KEYS = [
  "contract_version", "migration_version", "migration_revision", "input_state",
  "source_counts", "expected_audits", "migration_registered", "structural_complete",
  "audit_counts", "historical_audit_total",
] as const;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function counts(value: unknown): PublicMediaAuditCounts | null {
  if (!record(value) || Object.keys(value).sort().join(",") !== "categories,items,seo") return null;
  const { categories, items, seo } = value;
  if (typeof categories !== "number" || typeof items !== "number" || typeof seo !== "number"
    || ![categories, items, seo].every((count) => Number.isSafeInteger(count) && count >= 0)) return null;
  return { categories, items, seo };
}

function equalCounts(actual: unknown, expected: PublicMediaAuditCounts): boolean {
  const parsed = counts(actual);
  return parsed !== null && parsed.categories === expected.categories
    && parsed.items === expected.items && parsed.seo === expected.seo;
}

function missingProvenanceFunction(error: unknown): boolean {
  // PGRST202 identifies the exact missing zero-argument endpoint. SQLSTATE42883
  // alone could originate inside a present function and is never a fallback.
  return record(error) && error.code === "PGRST202"
    && error.message === "Could not find the function public.public_media_closure_provenance without parameters in the schema cache";
}

/** No network calls or inference from zero counts: only the DB-owned receipt
 * can attest a completed empty path. Older databases retain their existing
 * strict evidence contract without claiming an attested migration revision. */
export function evaluatePublicMediaClosureProof(
  infrastructure: PublicMediaInfrastructureEvidence,
  response: { data: unknown; error: unknown },
): PublicMediaClosureProof {
  if (infrastructure.singleSource !== true || infrastructure.moduleContract !== true
    || infrastructure.linkContract !== true) return { ok: false, reason: "current_structure_unverified" };

  if (response.error !== null) {
    if (response.data !== null || !missingProvenanceFunction(response.error)) {
      return { ok: false, reason: "provenance_rpc_unavailable" };
    }
    return equalCounts(infrastructure.counts, HISTORICAL_COUNTS)
      ? { ok: true, path: "historical-evidence-compatible", expectedAudits: HISTORICAL_COUNTS, revisionAttested: false }
      : { ok: false, reason: "historical_evidence_unverified" };
  }

  const value = response.data;
  if (!record(value)
    || Object.keys(value).sort().join(",") !== [...PROVENANCE_KEYS].sort().join(",")
    || value.contract_version !== 1 || value.migration_version !== "20260804180000"
    || value.migration_revision !== "validated-legacy-input-v1"
    || (value.input_state !== "populated-legacy" && value.input_state !== "validated-empty-legacy")) {
    return { ok: false, reason: "provenance_contract_unrecognized" };
  }
  if (value.migration_registered !== true || value.structural_complete !== true) {
    return { ok: false, reason: "migration_completion_unverified" };
  }
  const expectedAudits = value.input_state === "populated-legacy" ? HISTORICAL_COUNTS : EMPTY_COUNTS;
  const expectedTotal = expectedAudits.categories + expectedAudits.items + expectedAudits.seo;
  if (!equalCounts(value.source_counts, expectedAudits) || !equalCounts(value.expected_audits, expectedAudits)
    || !equalCounts(value.audit_counts, expectedAudits) || !equalCounts(infrastructure.counts, expectedAudits)
    || value.historical_audit_total !== expectedTotal) {
    return { ok: false, reason: "migration_evidence_contradiction" };
  }
  return { ok: true, path: value.input_state, expectedAudits, revisionAttested: true };
}
