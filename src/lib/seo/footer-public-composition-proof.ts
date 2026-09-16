import { evaluateFooterReadiness } from "../footer/footer-settings-readiness";

/** Proof interpretation inside the existing Global SEO Infrastructure owner. */
export type FooterCompositionInfrastructureEvidence = {
  singleSource: boolean | undefined;
  orphanSettings: number | undefined;
  unresolvedReferences: number | undefined;
  historicalAudits: number | undefined;
  publishedHomeAssignments: number | undefined;
  mediaHubAssignments: number | undefined;
  mediaSidebarAssignments: number | undefined;
  mediaHeroAssignments: number | undefined;
};

export type FooterCompositionProof =
  | {
      ok: true;
      path: "proven_fresh" | "historical_configured" | "historical-evidence-compatible";
      expectedHistoricalAudits: 0 | 2;
      revisionAttested: boolean;
      homeStatus: "pass" | "warning" | "fail";
      footerStatus: "pass" | "warning" | null;
    }
  | { ok: false; reason: string };

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).sort().join(",") === [...keys].sort().join(",");
}

function nonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function historicalInventory(infrastructure: FooterCompositionInfrastructureEvidence): boolean {
  return infrastructure.historicalAudits === 2 && infrastructure.publishedHomeAssignments === 4
    && infrastructure.mediaHubAssignments === 5 && infrastructure.mediaSidebarAssignments === 18
    && infrastructure.mediaHeroAssignments === 6;
}

/** Fresh validity requires the DB-owned initialization receipt, never inferred
 * from empty counts. Footer input validity stays at the existing Footer owner. */
export function evaluateFooterCompositionProof(
  infrastructure: FooterCompositionInfrastructureEvidence,
  response: { data: unknown; error: unknown },
): FooterCompositionProof {
  if (infrastructure.singleSource !== true || infrastructure.orphanSettings !== 0
    || infrastructure.unresolvedReferences !== 0) {
    return { ok: false, reason: "current_structure_unverified" };
  }
  if (response.error !== null) {
    const missingFunction = record(response.error) && response.error.code === "PGRST202"
      && response.error.message === "Could not find the function public.footer_public_composition_provenance without parameters in the schema cache";
    if (response.data !== null || !missingFunction) return { ok: false, reason: "provenance_rpc_unavailable" };
    return historicalInventory(infrastructure)
      ? { ok: true, path: "historical-evidence-compatible", expectedHistoricalAudits: 2,
          revisionAttested: false, homeStatus: "pass", footerStatus: null }
      : { ok: false, reason: "historical_evidence_unverified" };
  }
  const value = response.data;
  if (!record(value) || !exactKeys(value, [
    "contract_version", "migration_version", "migration_revision", "input_state", "migration_registered",
    "structural_complete", "historical_audit_total", "historical_audit_counts", "expected_historical_audits", "home", "footer_settings",
  ]) || value.contract_version !== 1 || value.migration_version !== "20260805090000"
    || value.migration_revision !== "system-manageable-fresh-v1"
    || (value.input_state !== "proven_fresh" && value.input_state !== "historical_configured")) {
    return { ok: false, reason: "provenance_contract_unrecognized" };
  }
  if (value.migration_registered !== true || value.structural_complete !== true) {
    return { ok: false, reason: "migration_completion_unverified" };
  }
  const expectedHistoricalAudits = value.input_state === "proven_fresh" ? 0 : 2;
  const expectedPerAction = value.input_state === "proven_fresh" ? 0 : 1;
  const auditCounts = value.historical_audit_counts;
  if (value.expected_historical_audits !== expectedHistoricalAudits
    || value.historical_audit_total !== expectedHistoricalAudits
    || infrastructure.historicalAudits !== expectedHistoricalAudits
    || !record(auditCounts) || !exactKeys(auditCounts, ["footer_brand_removed", "composition_fallback_retired"])
    || auditCounts.footer_brand_removed !== expectedPerAction
    || auditCounts.composition_fallback_retired !== expectedPerAction) {
    return { ok: false, reason: "migration_evidence_contradiction" };
  }
  const home = value.home;
  if (!record(home) || !exactKeys(home, ["identity_count", "id", "slug", "path", "status", "assignment_count", "published_assignment_count"])
    || home.identity_count !== 1 || !nonnegativeInteger(home.id) || home.id === 0
    || home.slug !== "home" || home.path !== "/" || typeof home.status !== "string"
    || !["draft", "published", "hidden", "archived", "unpublished"].includes(home.status)
    || !nonnegativeInteger(home.assignment_count) || !nonnegativeInteger(home.published_assignment_count)
    || home.published_assignment_count > home.assignment_count
    || home.published_assignment_count !== infrastructure.publishedHomeAssignments
    || (home.status !== "published" && home.published_assignment_count !== 0)) {
    return { ok: false, reason: "home_structure_unverified" };
  }
  const footer = value.footer_settings;
  if (!record(footer) || !exactKeys(footer, ["footer.slots", "footer.contact_items", "footer.social_links", "footer.legal"])) {
    return { ok: false, reason: "footer_structure_unverified" };
  }
  const readiness = evaluateFooterReadiness({
    slots: footer["footer.slots"], contactItems: footer["footer.contact_items"],
    socialLinks: footer["footer.social_links"], legal: footer["footer.legal"],
  });
  if (!readiness.systemValid) return { ok: false, reason: "footer_structure_unverified" };

  // Historical configured databases retain the existing strict inventory proof.
  // A fresh database may be manageable before editorial publication is complete.
  const homeStatus = value.input_state === "historical_configured"
    ? historicalInventory(infrastructure) ? "pass" : "fail"
    : home.status !== "published" ? "warning" : home.published_assignment_count === 4 ? "pass" : "fail";
  return { ok: true, path: value.input_state, expectedHistoricalAudits, revisionAttested: true,
    homeStatus, footerStatus: readiness.publicationReady ? "pass" : "warning" };
}
