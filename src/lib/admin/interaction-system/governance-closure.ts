/**
 * Read-only projection of Admin governance closure.
 *
 * Component ledgers remain the sources of truth. This module only composes
 * their blockers and fails closed when an inventoried module has no complete
 * closure ledger, so the umbrella cannot publish an independent Boolean.
 */

import { ADMIN_FORM_SYSTEM_CLOSURE } from "../form-system/adoption-manifest.ts";
import {
  ADMIN_COLLECTION_SURFACE_ADOPTION,
  ADMIN_ENTITY_PREVIEW_CAPABILITY_CLOSURE,
  ADMIN_INTERACTION_MODULES,
  ADMIN_INTERACTION_SYSTEM,
  ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION,
  deriveAdminGovernanceClosure,
  type AdminGovernanceClosureBlocker,
} from "./adoption-manifest.ts";

const ADMIN_SHARED_CAPABILITIES_CLOSURE = deriveAdminGovernanceClosure([
  ...scopedBlockers(
    "row-actions",
    ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION.globalClosureBlockers,
  ),
  ...scopedBlockers(
    "entity-preview",
    ADMIN_ENTITY_PREVIEW_CAPABILITY_CLOSURE.globalClosureBlockers,
  ),
]);

type AdminGovernanceClosureLedger = {
  globalClosed: boolean;
  globalClosureBlockers: readonly AdminGovernanceClosureBlocker[];
};

type AdminGovernanceModule = {
  id: string;
};

type AdminGovernanceComponentClosure = {
  moduleId: string;
  closure: AdminGovernanceClosureLedger;
};

function scopedBlockers(
  scope: string,
  blockers: readonly AdminGovernanceClosureBlocker[],
) {
  return blockers.map((blocker) => ({
    ...blocker,
    id: `${scope}:${blocker.id}`,
  }));
}

export function deriveAdminInteractionSystemClosure(input: {
  modules: readonly AdminGovernanceModule[];
  componentClosures: readonly AdminGovernanceComponentClosure[];
}) {
  const moduleIds = new Set(input.modules.map((module) => module.id));
  const registrationBlockers: AdminGovernanceClosureBlocker[] = [];
  const components = Object.fromEntries(
    input.modules.map((module) => {
      const registrations = input.componentClosures.filter(
        (candidate) => candidate.moduleId === module.id,
      );
      if (registrations.length === 1) {
        return [module.id, registrations[0]!.closure];
      }
      const registrationState =
        registrations.length === 0 ? "missing" : "duplicated";
      return [
        module.id,
        deriveAdminGovernanceClosure([
          {
            id: `module-closure-ledger:${module.id}:${registrationState}`,
            owner: module.id,
            evidence: "source_proven_only",
            rationale: `The inventoried ${module.id} module has ${registrationState} complete closure-ledger registration; the Admin Interaction umbrella must remain open.`,
          },
        ]),
      ];
    }),
  ) as Readonly<Record<string, AdminGovernanceClosureLedger>>;

  for (const registration of input.componentClosures) {
    if (!moduleIds.has(registration.moduleId)) {
      registrationBlockers.push({
        id: `module-closure-ledger:${registration.moduleId}:unregistered`,
        owner: registration.moduleId,
        evidence: "source_confirmed",
        rationale: `Closure ledger ${registration.moduleId} does not match an inventoried Admin Interaction module.`,
      });
    }
  }

  const globalClosureBlockers = [
    ...Object.entries(components).flatMap(([id, closure]) =>
      scopedBlockers(`module:${id}`, closure.globalClosureBlockers),
    ),
    ...registrationBlockers,
  ];

  return {
    proofBoundary: "derived_from_complete_module_inventory_and_component_ledgers",
    components,
    ...deriveAdminGovernanceClosure(globalClosureBlockers),
  } as const;
}

export const ADMIN_INTERACTION_SYSTEM_CLOSURE = {
  ...ADMIN_INTERACTION_SYSTEM,
  ...deriveAdminInteractionSystemClosure({
    modules: ADMIN_INTERACTION_MODULES,
    componentClosures: [
      {
        moduleId: "form_runtime",
        closure: ADMIN_FORM_SYSTEM_CLOSURE,
      },
      {
        moduleId: "collection_runtime",
        closure: ADMIN_COLLECTION_SURFACE_ADOPTION,
      },
      {
        moduleId: "shared_capabilities",
        closure: ADMIN_SHARED_CAPABILITIES_CLOSURE,
      },
    ],
  }),
} as const;
