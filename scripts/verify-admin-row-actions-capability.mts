import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";

import {
  ADMIN_ROW_ACTION_MORE_ORDER,
  ADMIN_ROW_ACTION_PRIMARY_ORDER,
} from "../src/lib/admin/interaction-system/admin-row-actions-capability.ts";
import {
  resolveClientPagination,
  slicePageRows,
} from "../src/lib/admin/entity-list/pagination.ts";
import { writeAdminBoundedClientPaginationParams } from "../src/lib/admin/entity-list/url-state.ts";
import {
  resolveAdminEntityListInteractionState,
  resolveAdminInstantMutationInteraction,
} from "../src/lib/admin/entity-list/data-engine/interaction-state.ts";
import {
  ADMIN_CURRENT_SHARED_CAPABILITY_SET,
  ADMIN_INTERACTION_MODULES,
  ADMIN_INTERACTION_SYSTEM,
  ADMIN_COLLECTION_FULL_ADOPTION_CLAIMS,
  ADMIN_COLLECTION_FULL_ADOPTION_REQUIRED_CONTRACTS,
  ADMIN_COLLECTION_SURFACE_ADOPTION,
  ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION,
  ADMIN_ROW_ACTIONS_EXISTING_OWNERS,
  adminSharedCapabilityKeys,
  type AdminCollectionFullAdoptionClaim,
  type AdminCollectionSemanticPresentationContract,
  type AdminCollectionSurfaceInventoryEntry,
  type AdminConsumerCapabilityAdoptionState,
  type AdminConsumerCapabilityAuditDeclaration,
  type AdminConsumerCapabilityKey,
  type AdminSharedConsumerCapabilityDefinition,
  type AdminRowActionsGovernedAction,
} from "../src/lib/admin/interaction-system/adoption-manifest.ts";
import {
  ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST,
  type AdminFormAdoptionEntry,
} from "../src/lib/admin/form-system/adoption-manifest.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (sourceFile: string) =>
  readFileSync(join(ROOT, sourceFile), "utf8");

let passed = 0;

function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

function closureStateIsConsistent(
  globalClosed: boolean,
  blockers: readonly string[],
) {
  return globalClosed ? blockers.length === 0 : blockers.length > 0;
}

function adoptionGapStateIsConsistent(
  globalClosed: boolean,
  gaps: readonly string[],
  partialSurfaceCount: number,
) {
  return globalClosed
    ? gaps.length === 0
    : gaps.length === partialSurfaceCount;
}

function sameOrderedValues(
  actual: readonly string[],
  expected: readonly string[],
) {
  return (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

function sameValueSet(actual: readonly string[], expected: readonly string[]) {
  return (
    actual.length === expected.length &&
    new Set(actual).size === actual.length &&
    expected.every((value) => actual.includes(value))
  );
}

function formatConsistencyContractLabel(contract: string) {
  return contract
    .split("_")
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function printManagementCollectionsConsistencyMatrix(input: {
  surfaceCount: number;
  fullAdoptionClaimCount: number;
  partialAdoptionCount: number;
  exactClaimCoverage: boolean;
  surfaceFailures: readonly string[];
  contractFailures: readonly string[];
  globalClosed: boolean;
}) {
  const rows = ADMIN_COLLECTION_FULL_ADOPTION_REQUIRED_CONTRACTS.map(
    (contract) => ({
      label: formatConsistencyContractLabel(contract),
      status: input.contractFailures.some((failure) =>
        failure.endsWith(`:${contract}`),
      )
        ? "FAIL"
        : "PASS",
    }),
  );
  const verificationPassed =
    input.exactClaimCoverage &&
    input.surfaceFailures.length === 0 &&
    input.contractFailures.length === 0;
  const labelWidth = Math.max(
    ...rows.map((row) => row.label.length),
    "Verification".length,
    "Adoption Closure".length,
  );
  const printRow = (label: string, status: string) =>
    console.log(`${label.padEnd(labelWidth + 2, ".")} ${status}`);

  console.log("\nManagement Collections Consistency\n");
  rows.forEach((row) => printRow(row.label, row.status));
  printRow("Verification", verificationPassed ? "PASS" : "FAIL");
  printRow("Adoption Closure", input.globalClosed ? "CLOSED" : "OPEN");
  console.log(
    `\nEvidence: ${input.surfaceCount} surfaces; Full Adoption claims: ${input.fullAdoptionClaimCount}; Partial Adoption entries: ${input.partialAdoptionCount}.`,
  );
}

function collectTsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = join(directory, entry.name);
    if (entry.isDirectory()) return collectTsxFiles(target);
    return entry.isFile() && entry.name.endsWith(".tsx") ? [target] : [];
  });
}

function relativeSourceFile(sourceFile: string) {
  return relative(ROOT, sourceFile).replaceAll("\\", "/");
}

function readCollectionSurfaceEvidence(
  surface: AdminCollectionSurfaceInventoryEntry,
) {
  return [
    ...new Set([
      ...surface.pageSourceFiles,
      ...surface.presentationSourceFiles,
    ]),
  ]
    .map(read)
    .join("\n");
}

type ConsumerCapabilityAuditBoundary = "collection" | "form";

type ConsumerCapabilityAuditRecord = {
  id: string;
  boundary: ConsumerCapabilityAuditBoundary;
  sourceFiles: readonly string[];
  declaration: AdminConsumerCapabilityAuditDeclaration;
  collectionSurface?: AdminCollectionSurfaceInventoryEntry;
  formEntry?: AdminFormAdoptionEntry;
};

type ResolvedConsumerCapabilityDecision = {
  capability: AdminConsumerCapabilityKey;
  state: AdminConsumerCapabilityAdoptionState;
  owner: string;
  rationale: string;
  approvedException?: {
    scope: string;
    approvingOwner: string;
    evidence: readonly string[];
    rationale: string;
  };
};

const currentSharedCapabilityKeys = adminSharedCapabilityKeys(
  ADMIN_CURRENT_SHARED_CAPABILITY_SET,
);

function projectSharedCapabilitySet<
  const TCapabilitySet extends Readonly<
    Record<string, AdminSharedConsumerCapabilityDefinition>
  >,
  TValue,
>(
  capabilitySet: TCapabilitySet,
  project: (capability: keyof TCapabilitySet & string) => TValue,
) {
  return Object.fromEntries(
    adminSharedCapabilityKeys(capabilitySet).map((capability) => [
      capability,
      project(capability),
    ]),
  ) as Record<keyof TCapabilitySet & string, TValue>;
}

function collectionBaseCapabilities(
  surface: AdminCollectionSurfaceInventoryEntry,
) {
  const capabilities = new Set<AdminConsumerCapabilityKey>();
  if (surface.collectionAdoption === "adopted") capabilities.add("collection");
  if (surface.gridOwner !== "not_applicable") {
    capabilities.add("table");
    capabilities.add("scrollbar");
  }
  if (surface.filtersOrToolbar) {
    capabilities.add("toolbar");
    capabilities.add("search");
  }
  if (surface.paginationState === "adopted") capabilities.add("pagination");
  if (surface.columnVisibility === "shared_optional_columns") {
    capabilities.add("column_visibility");
  }
  if (surface.rowActionsState === "adopted") capabilities.add("row_actions");
  if (surface.feedbackOwner === "AdminFeedbackProvider")
    capabilities.add("feedback");
  if (surface.confirmationOwner === "AdminConfirmDialog") {
    capabilities.add("confirmation");
  }
  if (surface.collectionAdoption === "adopted") capabilities.add("busy_state");

  const visibilityAdopted = surface.dataRegistryEntities.some((entity) =>
    ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION.entities.some(
      (entry) =>
        entry.entity === entity && entry.actions.visibility === "adopted",
    ),
  );
  if (visibilityAdopted) capabilities.add("visibility");
  return capabilities;
}

function formBaseCapabilities(entry: AdminFormAdoptionEntry) {
  const capabilities = new Set<AdminConsumerCapabilityKey>();
  if (
    entry.classification === "shared_reference" ||
    entry.classification === "shared_adopter"
  ) {
    capabilities.add("form_runtime");
    capabilities.add("feedback");
    capabilities.add("confirmation");
    capabilities.add("busy_state");
  }
  return capabilities;
}

function resolveConsumerCapabilityAudit(
  consumer: ConsumerCapabilityAuditRecord,
) {
  const source = consumerCapabilitySource(consumer);
  const baseCapabilities = consumer.collectionSurface
    ? collectionBaseCapabilities(consumer.collectionSurface)
    : formBaseCapabilities(consumer.formEntry!);
  const detectedCapabilities = directlyDetectedCapabilities(
    source,
  );
  const applicableCapabilities = directlyApplicableCapabilities(
    source,
  );
  const decisions = projectSharedCapabilitySet(
    ADMIN_CURRENT_SHARED_CAPABILITY_SET,
    (capability): ResolvedConsumerCapabilityDecision => {
      const definition = ADMIN_CURRENT_SHARED_CAPABILITY_SET[capability];
      const supportsBoundary = (
        definition.consumerBoundaries as readonly ConsumerCapabilityAuditBoundary[]
      ).includes(consumer.boundary);
      const applicable =
        supportsBoundary &&
        (baseCapabilities.has(capability) ||
          applicableCapabilities.has(capability));
      const adopted =
        supportsBoundary &&
        (baseCapabilities.has(capability) ||
          detectedCapabilities.has(capability));
      const existingException = resolveExistingConsumerException(
        consumer,
        capability,
      );
      const localImplementation =
        localImplementationMatches(capability, source).length > 0;
      const state: AdminConsumerCapabilityAdoptionState =
        supportsBoundary &&
        existingException &&
        localImplementation &&
        !baseCapabilities.has(capability)
          ? "approved_exception"
          : !applicable
        ? "not_applicable"
        : definition.ownerAvailability === "owner_extension_required"
          ? "owner_extension_required"
          : adopted
            ? "adopted"
            : "missing_adoption";
      return {
        capability,
        state,
        owner: definition.owner,
        approvedException:
          existingException && state === "approved_exception"
            ? existingException
            : undefined,
        rationale: !applicable
          ? definition.absenceMeansNotApplicable
            ? `The capability applicability contract found no ${capability} behavior in this consumer.`
            : "Capability applicability is unresolved."
          : definition.ownerAvailability === "owner_extension_required"
            ? "The behavior is applicable, but the current platform has no canonical owner that can be adopted without an owner extension."
            : adopted
              ? "The existing contract and canonical source proof establish adoption."
              : "The behavior is applicable, but canonical owner adoption is missing.",
      };
    },
  );

  for (const capability of currentSharedCapabilityKeys) {
    const override = consumer.declaration.overrides[capability];
    if (!override) continue;
    decisions[capability] = {
      capability,
      state: override.state,
      owner: ADMIN_CURRENT_SHARED_CAPABILITY_SET[capability].owner,
      rationale: override.rationale,
      approvedException:
        override.state === "approved_exception"
          ? {
              scope: override.scope,
              approvingOwner: override.approvingOwner,
              evidence: override.evidence,
              rationale: override.rationale,
            }
          : undefined,
    };
  }

  return decisions;
}

function resolveExistingConsumerException(
  consumer: ConsumerCapabilityAuditRecord,
  capability: AdminConsumerCapabilityKey,
) {
  if (
    consumer.formEntry &&
    ["specialized_exception", "explicit_exception"].includes(
      consumer.formEntry.classification,
    )
  ) {
    return {
      scope: `${consumer.id}:${capability}`,
      approvingOwner: "Admin Form System adoption manifest",
      evidence: consumer.formEntry.sourceFiles,
      rationale: consumer.formEntry.rationale,
    };
  }
  const surface = consumer.collectionSurface;
  if (
    surface &&
    (surface.collectionAdoption === "not_applicable" ||
      surface.workflowClassification ===
        "specialized_data_owner_shared_collection_presentation")
  ) {
    return {
      scope: `${consumer.id}:${capability}`,
      approvingOwner: "Admin Collection adoption manifest",
      evidence: [...surface.pageSourceFiles, ...surface.presentationSourceFiles],
      rationale: surface.exceptionRationale ?? surface.rationale,
    };
  }
  return undefined;
}

function consumerCapabilitySource(consumer: ConsumerCapabilityAuditRecord) {
  return [...new Set(consumer.sourceFiles)].map(read).join("\n");
}

function directlyDetectedCapabilities(source: string) {
  const compactSource = source.replace(/\s+/gu, "");
  return new Set(
    currentSharedCapabilityKeys.filter((capability) =>
      ADMIN_CURRENT_SHARED_CAPABILITY_SET[capability].sourceProofTokens.some(
        (token) =>
          source.includes(token) ||
          compactSource.includes(token.replace(/\s+/gu, "")),
      ),
    ),
  );
}

function directlyApplicableCapabilities(source: string) {
  const compactSource = source.replace(/\s+/gu, "");
  return new Set(
    currentSharedCapabilityKeys.filter((capability) =>
      ADMIN_CURRENT_SHARED_CAPABILITY_SET[
        capability
      ].applicabilitySourceTokens.some(
        (token) =>
          source.includes(token) ||
          compactSource.includes(token.replace(/\s+/gu, "")),
      ),
    ),
  );
}

function localImplementationMatches(
  capability: AdminConsumerCapabilityKey,
  source: string,
) {
  return ADMIN_CURRENT_SHARED_CAPABILITY_SET[
    capability
  ].localImplementationPatterns.filter((pattern) =>
    new RegExp(pattern, "u").test(source),
  );
}

function hasCapabilitySourceProof(
  consumer: ConsumerCapabilityAuditRecord,
  capability: AdminConsumerCapabilityKey,
  source: string,
) {
  const detected = directlyDetectedCapabilities(source);
  if (detected.has(capability)) return true;
  if (consumer.collectionSurface) {
    return collectionBaseCapabilities(consumer.collectionSurface).has(
      capability,
    );
  }
  return formBaseCapabilities(consumer.formEntry!).has(capability);
}

function collectConsumerCapabilityAuditFailures(
  consumer: ConsumerCapabilityAuditRecord,
  phase: "applicability" | "source_proof",
  sourceOverride?: string,
) {
  const failures: string[] = [];
  const decisions = resolveConsumerCapabilityAudit(consumer);
  const source = sourceOverride ?? consumerCapabilitySource(consumer);

  if (consumer.declaration.phase !== "capability_applicability") {
    failures.push("missing_applicability_phase");
  }
  if (
    Object.keys(decisions).length !== currentSharedCapabilityKeys.length ||
    !currentSharedCapabilityKeys.every((capability) => decisions[capability])
  ) {
    failures.push("unclassified_capability_axis");
  }
  for (const capability of currentSharedCapabilityKeys) {
    const decision = decisions[capability];
    if (!decision.owner.trim() || !decision.rationale.trim()) {
      failures.push(`${capability}:missing_owner_or_rationale`);
    }
    if (
      !ADMIN_CURRENT_SHARED_CAPABILITY_SET[capability]
        .absenceMeansNotApplicable &&
      decision.state === "not_applicable"
    ) {
      failures.push(`${capability}:unresolved_applicability`);
    }
    const override = consumer.declaration.overrides[capability];
    if (override?.state === "approved_exception") {
      if (
        !override.scope?.trim() ||
        !override.approvingOwner?.trim() ||
        !Array.isArray(override.evidence) ||
        override.evidence.length === 0 ||
        override.evidence.some((item) => !item.trim()) ||
        !override.rationale?.trim()
      ) {
        failures.push(`${capability}:invalid_approved_exception_contract`);
      }
    }
    if (decision.state === "approved_exception") {
      const exception = decision.approvedException;
      if (
        !exception?.scope.trim() ||
        !exception.approvingOwner.trim() ||
        exception.evidence.length === 0 ||
        exception.evidence.some((item) => !item.trim()) ||
        !exception.rationale.trim()
      ) {
        failures.push(`${capability}:invalid_approved_exception_contract`);
      }
    }
    if (
      override?.state === "adopted" &&
      ADMIN_CURRENT_SHARED_CAPABILITY_SET[capability].ownerAvailability ===
        "owner_extension_required"
    ) {
      failures.push(`${capability}:unavailable_owner_claimed_adopted`);
    }
    if (
      !ADMIN_CURRENT_SHARED_CAPABILITY_SET[capability].sourceFiles.every(
        (sourceFile) => existsSync(join(ROOT, sourceFile)),
      )
    ) {
      failures.push(`${capability}:missing_owner_source`);
    }
  }

  if (phase === "applicability") return [...new Set(failures)];

  for (const capability of currentSharedCapabilityKeys) {
    const decision = decisions[capability];
    const localMatches = localImplementationMatches(capability, source);
    const locallyApprovedPresentation =
      consumer.collectionSurface?.semanticPresentation.explicitSurfaceContracts.some(
        (contract) => contract.state === capability,
      ) ?? false;
    if (
      !(
        ADMIN_CURRENT_SHARED_CAPABILITY_SET[capability]
          .consumerBoundaries as readonly ConsumerCapabilityAuditBoundary[]
      ).includes(consumer.boundary)
    ) {
      continue;
    }
    if (
      decision.state === "adopted" &&
      !hasCapabilitySourceProof(consumer, capability, source)
    ) {
      failures.push(`${capability}:missing_source_proof`);
    }
    if (decision.state === "missing_adoption") {
      failures.push(`${capability}:missing_adoption`);
    }
    if (
      localMatches.length > 0 &&
      !locallyApprovedPresentation &&
      decision.state !== "approved_exception" &&
      decision.state !== "owner_extension_required"
    ) {
      failures.push(
        `${capability}:${hasCapabilitySourceProof(consumer, capability, source) ? "parallel" : "local"}_implementation`,
      );
    }
  }
  return [...new Set(failures)];
}

const consumerCapabilityAuditRecords: ConsumerCapabilityAuditRecord[] = [
  ...ADMIN_COLLECTION_SURFACE_ADOPTION.surfaces.map((surface) => ({
    id: surface.id,
    boundary: "collection" as const,
    sourceFiles: [
      ...surface.pageSourceFiles,
      ...surface.presentationSourceFiles,
    ],
    declaration: surface.capabilityAudit,
    collectionSurface: surface,
  })),
  ...ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST.map((entry) => ({
    id: entry.id,
    boundary: "form" as const,
    sourceFiles: entry.sourceFiles,
    declaration: entry.capabilityAudit,
    formEntry: entry,
  })),
];

const FUTURE_SHARED_CAPABILITY_FIXTURE = "future_capability_fixture" as const;
const futureSharedCapabilitySetFixture = {
  ...ADMIN_CURRENT_SHARED_CAPABILITY_SET,
  [FUTURE_SHARED_CAPABILITY_FIXTURE]: {
    owner: "Future shared owner fixture",
    sourceFiles: ["src/lib/admin/interaction-system/adoption-manifest.ts"],
    sourceProofTokens: ["FutureSharedOwnerFixture"],
    applicabilitySourceTokens: ["FutureSharedOwnerFixture"],
    localImplementationPatterns: [],
    ownerAvailability: "available",
    absenceMeansNotApplicable: false,
    consumerBoundaries: ["collection", "form"],
  },
} as const satisfies Readonly<
  Record<string, AdminSharedConsumerCapabilityDefinition>
>;
const futureSharedCapabilityKeysFixture = adminSharedCapabilityKeys(
  futureSharedCapabilitySetFixture,
);
const futureConsumerAuditProjectionFixtures = [
  ...consumerCapabilityAuditRecords.map(
    (consumer) => `${consumer.boundary}:${consumer.id}`,
  ),
  "future_consumer_fixture",
].map((consumer) => ({
  consumer,
  decisions: projectSharedCapabilitySet(
    futureSharedCapabilitySetFixture,
    () => "not_applicable" as const,
  ),
}));

function readCliOption(option: string) {
  const optionIndex = process.argv.indexOf(option);
  return optionIndex >= 0 ? process.argv[optionIndex + 1] : undefined;
}

function runConsumerCapabilityAuditPreflight() {
  if (!process.argv.includes("--consumer-capability-audit")) return;

  const consumerId = readCliOption("--consumer");
  const requestedAllConsumers = process.argv.includes("--all");
  const auditAllConsumers = requestedAllConsumers || !consumerId;
  const requestedBoundary = readCliOption("--boundary");
  const requestedPhase =
    readCliOption("--phase") ??
    (auditAllConsumers ? "source_proof" : "applicability");
  assert.ok(
    consumerId || auditAllConsumers,
    "Consumer Capability Adoption Audit requires --consumer <manifest-id> or --all.",
  );
  assert.ok(
    !(consumerId && requestedAllConsumers),
    "Use either --consumer <manifest-id> or --all, not both.",
  );
  assert.ok(
    requestedBoundary === undefined ||
      requestedBoundary === "collection" ||
      requestedBoundary === "form",
    "--boundary must be collection or form when supplied.",
  );
  assert.ok(
    requestedPhase === "applicability" || requestedPhase === "source_proof",
    "--phase must be applicability or source_proof.",
  );

  if (auditAllConsumers) {
    assert.equal(
      requestedBoundary,
      undefined,
      "--boundary is only valid with --consumer <manifest-id>.",
    );
    const failures = consumerCapabilityAuditRecords.flatMap((consumer) =>
      collectConsumerCapabilityAuditFailures(consumer, requestedPhase).map(
        (failure) => `${consumer.boundary}:${consumer.id}:${failure}`,
      ),
    );
    console.log("Consumer Capability Adoption Audit: all consumers");
    console.log(`Phase: ${requestedPhase}`);
    console.log(
      `Current Shared Capability Set: ${currentSharedCapabilityKeys.length} derived axes`,
    );
    console.log(`Consumers: ${consumerCapabilityAuditRecords.length}`);
    assert.deepEqual(
      failures,
      [],
      `Consumer Capability Adoption Audit failed: ${failures.join(", ")}`,
    );
    console.log("Consumer Capability Adoption Audit passed.");
    process.exit(0);
  }

  const matches = consumerCapabilityAuditRecords.filter(
    (consumer) =>
      consumer.id === consumerId &&
      (requestedBoundary === undefined ||
        consumer.boundary === requestedBoundary),
  );
  assert.equal(
    matches.length,
    1,
    `Expected one manifest consumer for ${requestedBoundary ? `${requestedBoundary}:` : ""}${consumerId}; found ${matches.length}.`,
  );

  const consumer = matches[0];
  const failures = collectConsumerCapabilityAuditFailures(
    consumer,
    requestedPhase,
  );
  const decisions = resolveConsumerCapabilityAudit(consumer);
  console.log(
    `Consumer Capability Adoption Audit: ${consumer.boundary}:${consumer.id}`,
  );
  console.log(`Phase: ${requestedPhase}`);
  for (const capability of currentSharedCapabilityKeys) {
    const decision = decisions[capability];
    console.log(
      `${capability.padEnd(20)} ${decision.state.padEnd(24)} ${decision.owner}`,
    );
  }
  assert.deepEqual(
    failures,
    [],
    `Consumer Capability Adoption Audit failed: ${failures.join(", ")}`,
  );
  console.log("Consumer Capability Adoption Audit passed.");
  process.exit(0);
}

runConsumerCapabilityAuditPreflight();

type CollectionSourceOverrides = ReadonlyMap<string, string>;

const CANONICAL_COLLECTION_OWNER =
  "src/components/admin/entity-list/AdminEntityList.tsx";
const CANONICAL_DATA_RUNTIME_OWNER =
  "src/lib/admin/entity-list/data-engine/instant-mutation.ts";
const CANONICAL_QUERY_RUNTIME_OWNER =
  "src/lib/admin/entity-list/data-engine/client-controller.ts";
const CANONICAL_COLUMN_PREFERENCES_OWNER =
  "src/lib/admin/preferences/admin-column-preferences.ts";
const CANONICAL_PRIMARY_COLUMN_OWNER =
  "src/components/admin/ui/AdminDataGrid.tsx";

function normalizeSourcePath(sourceFile: string) {
  return sourceFile.replaceAll("\\", "/");
}

function sourceTextForEvidence(
  sourceFile: string,
  sourceOverrides?: CollectionSourceOverrides,
) {
  return sourceOverrides?.get(sourceFile) ?? read(sourceFile);
}

function resolveEvidenceModule(
  importer: string,
  moduleSpecifier: string,
  sourceOverrides?: CollectionSourceOverrides,
) {
  if (!moduleSpecifier.startsWith(".")) return null;
  const absoluteBase = resolve(ROOT, dirname(importer), moduleSpecifier);
  const candidates = extname(absoluteBase)
    ? [absoluteBase]
    : [
        `${absoluteBase}.ts`,
        `${absoluteBase}.tsx`,
        `${absoluteBase}.js`,
        `${absoluteBase}.mjs`,
        join(absoluteBase, "index.ts"),
        join(absoluteBase, "index.tsx"),
        join(absoluteBase, "index.js"),
      ];
  for (const candidate of candidates) {
    const relativeCandidate = normalizeSourcePath(relative(ROOT, candidate));
    if (sourceOverrides?.has(relativeCandidate) || existsSync(candidate)) {
      return relativeCandidate;
    }
  }
  return null;
}

function parseEvidenceSource(sourceFile: string, source: string) {
  return ts.createSourceFile(
    sourceFile,
    source,
    ts.ScriptTarget.Latest,
    true,
    sourceFile.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

type SemanticPresentationOccurrence = {
  component: string;
  ancestors: readonly string[];
  expression: string;
};

function rootIdentifierName(expression: ts.Expression): string | null {
  let current = expression;
  while (
    ts.isPropertyAccessExpression(current) ||
    ts.isElementAccessExpression(current)
  ) {
    current = current.expression;
  }
  return ts.isIdentifier(current) ? current.text : null;
}

function collectSemanticPresentationOccurrences(
  sourceFile: string,
  source: string,
  contract: Pick<
    AdminCollectionSemanticPresentationContract,
    "sourceObjectNames" | "sourceFieldNames"
  >,
) {
  const parsed = parseEvidenceSource(sourceFile, source);
  const sourceObjects = new Set(contract.sourceObjectNames);
  const sourceFields = new Set(contract.sourceFieldNames);
  const variableDeclarations = new Map<string, ts.VariableDeclaration[]>();
  const collectDeclarations = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const declarations = variableDeclarations.get(node.name.text) ?? [];
      declarations.push(node);
      variableDeclarations.set(node.name.text, declarations);
    }
    ts.forEachChild(node, collectDeclarations);
  };
  collectDeclarations(parsed);

  const functionScopeChain = (node: ts.Node) => {
    const scopes: ts.Node[] = [];
    let current: ts.Node | undefined = node.parent;
    while (current) {
      if (ts.isFunctionLike(current)) scopes.push(current);
      current = current.parent;
    }
    scopes.push(parsed);
    return scopes;
  };
  const declarationScope = (declaration: ts.VariableDeclaration) => {
    let current: ts.Node | undefined = declaration.parent;
    while (current && !ts.isFunctionLike(current)) current = current.parent;
    return current ?? parsed;
  };
  const resolveVariableDeclaration = (identifier: ts.Identifier) => {
    const scopes = functionScopeChain(identifier);
    return (variableDeclarations.get(identifier.text) ?? [])
      .filter(
        (declaration) =>
          declaration.initializer &&
          declaration.getStart(parsed) < identifier.getStart(parsed) &&
          scopes.includes(declarationScope(declaration)),
      )
      .sort((left, right) => {
        const scopeDifference =
          scopes.indexOf(declarationScope(left)) -
          scopes.indexOf(declarationScope(right));
        return scopeDifference !== 0
          ? scopeDifference
          : right.getStart(parsed) - left.getStart(parsed);
      })[0];
  };

  const referencesSemanticState = (
    node: ts.Node,
    resolvingDeclarations = new Set<number>(),
  ) => {
    let found = false;
    const visit = (current: ts.Node) => {
      if (found) return;
      if (
        current !== node &&
        (ts.isFunctionLike(current) ||
          ts.isJsxElement(current) ||
          ts.isJsxSelfClosingElement(current) ||
          ts.isJsxFragment(current))
      ) {
        return;
      }
      if (
        ts.isPropertyAccessExpression(current) &&
        sourceFields.has(current.name.text) &&
        sourceObjects.has(rootIdentifierName(current.expression) ?? "")
      ) {
        found = true;
        return;
      }
      if (ts.isElementAccessExpression(current)) {
        const field = current.argumentExpression;
        if (
          field &&
          ts.isStringLiteralLike(field) &&
          sourceFields.has(field.text) &&
          sourceObjects.has(rootIdentifierName(current.expression) ?? "")
        ) {
          found = true;
          return;
        }
      }
      if (ts.isIdentifier(current)) {
        const declaration = resolveVariableDeclaration(current);
        const declarationPosition = declaration?.getStart(parsed);
        if (
          declaration?.initializer &&
          declarationPosition !== undefined &&
          !resolvingDeclarations.has(declarationPosition)
        ) {
          const nestedResolution = new Set(resolvingDeclarations);
          nestedResolution.add(declarationPosition);
          if (
            referencesSemanticState(declaration.initializer, nestedResolution)
          ) {
            found = true;
            return;
          }
        }
      }
      ts.forEachChild(current, visit);
    };
    visit(node);
    return found;
  };

  const occurrences: SemanticPresentationOccurrence[] = [];
  const visitJsx = (node: ts.Node, ancestors: readonly string[]) => {
    if (ts.isJsxElement(node)) {
      const component = node.openingElement.tagName.getText(parsed);
      const nested = [...ancestors, component];
      node.openingElement.attributes.properties.forEach((attribute) =>
        visitJsx(attribute, nested),
      );
      node.children.forEach((child) => visitJsx(child, nested));
      return;
    }
    if (ts.isJsxSelfClosingElement(node)) {
      const component = node.tagName.getText(parsed);
      const nested = [...ancestors, component];
      node.attributes.properties.forEach((attribute) =>
        visitJsx(attribute, nested),
      );
      return;
    }
    if (
      ts.isJsxExpression(node) &&
      node.expression &&
      referencesSemanticState(node.expression)
    ) {
      occurrences.push({
        component: ancestors.at(-1) ?? "unknown",
        ancestors,
        expression: node.expression.getText(parsed).replaceAll(/\s+/g, " "),
      });
    }
    ts.forEachChild(node, (child) => visitJsx(child, ancestors));
  };
  visitJsx(parsed, []);
  return occurrences;
}

function collectSemanticPresentationContractFailures(
  surface: AdminCollectionSurfaceInventoryEntry,
  sourceOverrides?: CollectionSourceOverrides,
) {
  const contract = surface.semanticPresentation;
  if (contract.owner === "not_applicable") {
    const noEvidence = contract.governedStates.length === 0 &&
      contract.sourceFiles.length === 0 &&
      contract.sourceObjectNames.length === 0 &&
      contract.sourceFieldNames.length === 0 &&
      contract.explicitSurfaceContracts.length === 0;
    if (!noEvidence) return ["not_applicable_contract_has_evidence"];
    return surface.workflowClassification === "full_collection_adoption" &&
      surface.rowActionsState === "adopted"
      ? ["missing_full_adoption_contract"]
      : [];
  }

  const failures: string[] = [];
  if (
    contract.primaryCellContract !== "identity_primary_content_only" ||
    contract.governedStates.length === 0 ||
    contract.sourceFiles.length === 0 ||
    contract.sourceObjectNames.length === 0 ||
    contract.sourceFieldNames.length === 0 ||
    new Set(contract.sourceFiles).size !== contract.sourceFiles.length ||
    new Set(contract.sourceObjectNames).size !== contract.sourceObjectNames.length ||
    new Set(contract.sourceFieldNames).size !== contract.sourceFieldNames.length
  ) {
    failures.push("incomplete_contract");
  }

  for (const exception of contract.explicitSurfaceContracts) {
    if (
      !contract.governedStates.includes(exception.state) ||
      !contract.sourceFiles.includes(exception.sourceFile) ||
      exception.component !== "AdminStatusPill" ||
      exception.surface !== "dedicated_status_column" ||
      exception.rationale.trim().length === 0
    ) {
      failures.push(`invalid_exception:${exception.sourceFile}`);
    }
  }

  const surfaceGraph = collectCollectionSourceGraph(surface, sourceOverrides);
  if (
    contract.owner === "shared_admin_row_actions" &&
    ![...surfaceGraph.values()].some((source) =>
      source.includes("<AdminDataGridRowActions"),
    )
  ) {
    failures.push("missing_shared_owner");
  }
  for (const sourceFile of contract.sourceFiles) {
    if (!sourceOverrides?.has(sourceFile) && !existsSync(join(ROOT, sourceFile))) {
      failures.push(`missing_source:${sourceFile}`);
      continue;
    }
    if (!surfaceGraph.has(sourceFile)) {
      failures.push(`outside_surface_graph:${sourceFile}`);
    }
    const source = sourceTextForEvidence(sourceFile, sourceOverrides);
    const allowedStatusPill = contract.explicitSurfaceContracts.some(
      (exception) => exception.sourceFile === sourceFile,
    );
    const occurrences = collectSemanticPresentationOccurrences(
      sourceFile,
      source,
      contract,
    );
    if (allowedStatusPill && !source.includes("<AdminStatusPill")) {
      failures.push(`missing_explicit_surface:${sourceFile}`);
    }
    for (const occurrence of occurrences) {
      if (occurrence.ancestors.includes("AdminDataGridPrimaryCell")) {
        failures.push(
          `primary_cell_parallel_presentation:${sourceFile}:${occurrence.expression}`,
        );
        continue;
      }
      if (occurrence.ancestors.includes("AdminDataGridRowActions")) continue;
      if (
        occurrence.ancestors.includes("AdminStatusPill") &&
        allowedStatusPill
      ) {
        continue;
      }
      failures.push(
        `undeclared_presenter:${sourceFile}:${occurrence.component}:${occurrence.expression}`,
      );
    }
  }
  return [...new Set(failures)];
}

function collectSourceGraph(
  entrySourceFiles: readonly string[],
  sourceOverrides?: CollectionSourceOverrides,
) {
  const graph = new Map<string, string>();
  const queue = [...new Set(entrySourceFiles)];
  while (queue.length > 0) {
    const sourceFile = normalizeSourcePath(queue.shift()!);
    if (graph.has(sourceFile)) continue;
    const absoluteSourceFile = join(ROOT, sourceFile);
    if (!sourceOverrides?.has(sourceFile) && !existsSync(absoluteSourceFile)) {
      continue;
    }
    const source = sourceTextForEvidence(sourceFile, sourceOverrides);
    graph.set(sourceFile, source);
    const parsed = parseEvidenceSource(sourceFile, source);
    parsed.forEachChild((node) => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const dependency = resolveEvidenceModule(
          sourceFile,
          node.moduleSpecifier.text,
          sourceOverrides,
        );
        if (dependency && !graph.has(dependency)) queue.push(dependency);
      }
    });
  }
  return graph;
}

function collectCollectionSourceGraph(
  surface: AdminCollectionSurfaceInventoryEntry,
  sourceOverrides?: CollectionSourceOverrides,
) {
  return collectSourceGraph(
    [...surface.pageSourceFiles, ...surface.presentationSourceFiles],
    sourceOverrides,
  );
}

function evidenceGraphHasJsxAttribute(
  graph: ReadonlyMap<string, string>,
  elementName: string,
  attributeName: string,
) {
  return [...graph].some(([sourceFile, source]) => {
    const parsed = parseEvidenceSource(sourceFile, source);
    let found = false;
    const visit = (node: ts.Node) => {
      if (found) return;
      if (
        (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
        node.tagName.getText(parsed) === elementName &&
        node.attributes.properties.some(
          (attribute) =>
            ts.isJsxAttribute(attribute) &&
            attribute.name.getText(parsed) === attributeName,
        )
      ) {
        found = true;
        return;
      }
      ts.forEachChild(node, visit);
    };
    visit(parsed);
    return found;
  });
}

function evidenceGraphCallsCanonicalImport(
  graph: ReadonlyMap<string, string>,
  importedName: string,
  canonicalOwner: string,
) {
  return [...graph].some(([sourceFile, source]) => {
    if (sourceFile === canonicalOwner) return false;
    const parsed = parseEvidenceSource(sourceFile, source);
    const localNames = new Set<string>();
    parsed.forEachChild((node) => {
      if (
        !ts.isImportDeclaration(node) ||
        !ts.isStringLiteral(node.moduleSpecifier) ||
        resolveEvidenceModule(sourceFile, node.moduleSpecifier.text) !==
          canonicalOwner
      ) {
        return;
      }
      const bindings = node.importClause?.namedBindings;
      if (!bindings || !ts.isNamedImports(bindings)) return;
      bindings.elements.forEach((binding) => {
        if ((binding.propertyName ?? binding.name).text === importedName) {
          localNames.add(binding.name.text);
        }
      });
    });
    if (localNames.size === 0) return false;
    let called = false;
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        localNames.has(node.expression.text)
      ) {
        called = true;
        return;
      }
      if (!called) ts.forEachChild(node, visit);
    };
    visit(parsed);
    return called;
  });
}

function evidenceGraphUsesPrimaryColumnPreset(
  graph: ReadonlyMap<string, string>,
) {
  return [...graph].some(([sourceFile, source]) => {
    if (sourceFile === CANONICAL_PRIMARY_COLUMN_OWNER) return false;
    const parsed = parseEvidenceSource(sourceFile, source);
    let used = false;
    const visit = (node: ts.Node) => {
      if (
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS"
      ) {
        used = true;
        return;
      }
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        [
          "getAdminDataGridPrimaryColumnWidth",
          "getAdminDataGridHierarchyPrimaryColumnWidth",
        ].includes(node.expression.text)
      ) {
        used = true;
        return;
      }
      if (!used) ts.forEachChild(node, visit);
    };
    visit(parsed);
    return used;
  });
}

function evidenceGraphUsesBulkMutationLifecycle(
  graph: ReadonlyMap<string, string>,
) {
  return [...graph].some(([sourceFile, source]) => {
    if (sourceFile === CANONICAL_DATA_RUNTIME_OWNER) return false;
    const parsed = parseEvidenceSource(sourceFile, source);
    let used = false;
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "mutateAsync" &&
        node.arguments.some(
          (argument) =>
            ts.isObjectLiteralExpression(argument) &&
            argument.properties.some(
              (property) =>
                ts.isPropertyAssignment(property) &&
                property.name.getText(parsed) === "bulk" &&
                property.initializer.kind === ts.SyntaxKind.TrueKeyword,
            ),
        )
      ) {
        used = true;
        return;
      }
      if (!used) ts.forEachChild(node, visit);
    };
    visit(parsed);
    return used;
  });
}

function evidenceGraphDeclaresBulkMutationScope(
  graph: ReadonlyMap<string, string>,
) {
  return [...graph].some(([sourceFile, source]) => {
    if (sourceFile === CANONICAL_DATA_RUNTIME_OWNER) return false;
    const parsed = parseEvidenceSource(sourceFile, source);
    let declared = false;
    const visit = (node: ts.Node) => {
      if (
        ts.isPropertyAssignment(node) &&
        node.name.getText(parsed) === "bulk" &&
        node.initializer.kind !== ts.SyntaxKind.FalseKeyword
      ) {
        declared = true;
        return;
      }
      if (!declared) ts.forEachChild(node, visit);
    };
    visit(parsed);
    return declared;
  });
}

function evidenceGraphHasLocalBulkLifecycleOwner(
  graph: ReadonlyMap<string, string>,
) {
  return [...graph].some(([sourceFile, source]) => {
    if (sourceFile === CANONICAL_DATA_RUNTIME_OWNER) return false;
    const parsed = parseEvidenceSource(sourceFile, source);
    let found = false;
    const visit = (node: ts.Node) => {
      if (
        ts.isVariableDeclaration(node) &&
        node.initializer &&
        ts.isCallExpression(node.initializer) &&
        ts.isIdentifier(node.initializer.expression) &&
        ["useState", "useRef"].includes(node.initializer.expression.text) &&
        /bulk.*pending|pending.*bulk/iu.test(node.name.getText(parsed))
      ) {
        found = true;
        return;
      }
      if (!found) ts.forEachChild(node, visit);
    };
    visit(parsed);
    return found;
  });
}

function collectCollectionSurfaceComplianceFailures(
  surface: AdminCollectionSurfaceInventoryEntry,
  source = readCollectionSurfaceEvidence(surface),
) {
  const failures: string[] = [];
  const usesEntityList = /<AdminEntityList(?:\s|<)/u.test(source);
  const usesDataGrid = /<AdminDataGrid(?:\s|>)/u.test(source);
  const usesNativeTable = /<table(?:\s|>)/u.test(source);
  const usesSharedToolbar = source.includes("AdminEntityListFilters");
  const usesSharedRowActions = source.includes("AdminDataGridRowActions");
  const usesSharedPagination = source.includes("AdminTablePagination");
  const usesBoundedClientRuntime = source.includes(
    "useAdminBoundedClientPagination",
  );
  const usesSharedColumnControls =
    source.includes("AdminColumnVisibilityMenu") &&
    source.includes("visibleColumns=") &&
    source.includes("defaultColumns=") &&
    source.includes("onChange=") &&
    source.includes("onPersist=") &&
    source.includes("onRestore=");

  if (!surface.rationale.trim() || !surface.sourceOwner.trim()) {
    failures.push("ownership_rationale");
  }

  if (surface.workflowClassification === "auth_out_of_scope") {
    if (
      surface.generic ||
      surface.pageChromeAdoption !== "auth_out_of_scope" ||
      surface.collectionAdoption !== "not_applicable" ||
      surface.headerOwner !== "not_applicable" ||
      surface.headerState !== "auth_out_of_scope" ||
      surface.gridOwner !== "not_applicable" ||
      surface.dataRegistryEntities.length > 0 ||
      surface.paginationState !== "not_required" ||
      surface.paginationOwner !== "not_applicable" ||
      surface.requiredAdoption.length > 0 ||
      !surface.exceptionRationale ||
      surface.genuineExceptions.length === 0 ||
      usesEntityList ||
      usesDataGrid
    ) {
      failures.push("auth_exception_contract");
    }
    return [...new Set(failures)];
  }

  if (
    surface.pageChromeAdoption !== "adopted" ||
    surface.headerOwner !== "AdminPageContextHeader" ||
    surface.headerState !== "adopted"
  ) {
    failures.push("shared_page_contract");
  }

  if (
    surface.workflowClassification === "full_collection_adoption" ||
    surface.workflowClassification === "partial_collection_adoption"
  ) {
    if (
      !surface.generic ||
      surface.collectionAdoption !== "adopted" ||
      surface.gridOwner !== "AdminEntityList" ||
      !usesEntityList ||
      surface.queryMode !== "server-page" ||
      surface.paginationState !== "adopted" ||
      surface.paginationOwner !== "AdminTablePagination" ||
      surface.dataRegistryEntities.length === 0
    ) {
      failures.push("generic_collection_contract");
    }

    if (
      surface.workflowClassification === "full_collection_adoption" &&
      (surface.requiredAdoption.length > 0 ||
        surface.exceptionRationale !== null)
    ) {
      failures.push("false_full_adoption");
    }

    if (
      surface.workflowClassification === "partial_collection_adoption" &&
      (surface.requiredAdoption.length === 0 ||
        surface.exceptionRationale === null)
    ) {
      failures.push("unproven_partial_adoption");
    }

    return [...new Set(failures)];
  }

  if (usesEntityList) {
    failures.push("generic_collection_misclassified_as_exception");
  }

  if (
    surface.workflowClassification ===
    "specialized_data_owner_shared_collection_presentation"
  ) {
    if (
      surface.generic ||
      surface.collectionAdoption !== "adopted" ||
      !["AdminDataGrid", "MediaCatalog"].includes(surface.gridOwner) ||
      surface.dataRegistryEntities.length > 0 ||
      surface.requiredAdoption.length > 0
    ) {
      failures.push("specialized_collection_contract");
    }

    if (
      (surface.gridOwner === "AdminDataGrid" && !usesDataGrid) ||
      (surface.gridOwner === "MediaCatalog" &&
        !source.includes("MediaCatalog"))
    ) {
      failures.push("specialized_grid_evidence");
    }

    if (
      !["bounded-client", "specialized"].includes(surface.queryMode) ||
      (surface.queryMode === "bounded-client" && !usesBoundedClientRuntime)
    ) {
      failures.push("specialized_query_contract");
    }

    if (surface.filtersOrToolbar && !usesSharedToolbar) {
      failures.push("specialized_toolbar_contract");
    }

    if (
      (surface.paginationState === "adopted" &&
        (surface.paginationOwner !== "AdminTablePagination" ||
          !usesSharedPagination)) ||
      (surface.paginationState === "not_required" &&
        (surface.paginationOwner !== "not_applicable" ||
          usesSharedPagination))
    ) {
      failures.push("specialized_pagination_contract");
    }

    if (
      (surface.rowActionsState === "adopted" &&
        (surface.rowActionsOwner !== "shared_admin_row_actions" ||
          !usesSharedRowActions)) ||
      (surface.rowActionsState !== "adopted" &&
        surface.rowActionsOwner === "shared_admin_row_actions")
    ) {
      failures.push("specialized_row_actions_contract");
    }

    if (
      surface.columnVisibility === "shared_optional_columns" &&
      !usesSharedColumnControls
    ) {
      failures.push("specialized_columns_contract");
    }

    return [...new Set(failures)];
  }

  if (surface.workflowClassification === "fixed_structure_not_paginated") {
    if (
      surface.generic ||
      surface.collectionAdoption !== "not_applicable" ||
      surface.gridOwner !== "not_applicable" ||
      surface.dataRegistryEntities.length > 0 ||
      surface.paginationState !== "not_required" ||
      surface.paginationOwner !== "not_applicable" ||
      surface.requiredAdoption.length > 0 ||
      !surface.exceptionRationale ||
      surface.genuineExceptions.length === 0
    ) {
      failures.push("fixed_structure_exception_contract");
    }

    if (
      usesDataGrid &&
      (usesSharedRowActions || usesSharedPagination || usesBoundedClientRuntime)
    ) {
      failures.push("collection_misclassified_as_fixed_structure");
    }

    return [...new Set(failures)];
  }

  if (surface.workflowClassification === "page_system_only") {
    if (
      surface.generic ||
      surface.collectionAdoption !== "not_applicable" ||
      surface.gridOwner !== "not_applicable" ||
      surface.dataRegistryEntities.length > 0 ||
      surface.paginationState !== "not_required" ||
      surface.paginationOwner !== "not_applicable" ||
      surface.queryMode !== "specialized" ||
      surface.requiredAdoption.length > 0 ||
      usesDataGrid ||
      (usesNativeTable &&
        (surface.rowActionsState !== "read_only_no_row_commands" ||
          surface.rowActionsOwner !== "not_applicable" ||
          !surface.exceptionRationale))
    ) {
      failures.push("page_system_exception_contract");
    }
  }

  return [...new Set(failures)];
}

function extractRegistryEntities(source: string) {
  const registry = source.match(
    /adminEntityListAdapterRegistry\s*=\s*\{([\s\S]*?)\}\s*as const/,
  )?.[1];
  if (!registry) return [];

  return Array.from(
    registry.matchAll(/^\s*([a-z][a-zA-Z0-9_]*)\s*:/gm),
    (match) => match[1],
  );
}

const collectionSurfaces: readonly AdminCollectionSurfaceInventoryEntry[] =
  ADMIN_COLLECTION_SURFACE_ADOPTION.surfaces;
const declaredDataRegistryEntities = collectionSurfaces
  .filter((surface) => surface.generic)
  .flatMap((surface) => surface.dataRegistryEntities);
const expectedRowActionEntities = collectionSurfaces
  .filter((surface) => surface.generic && surface.rowActionsState === "adopted")
  .flatMap((surface) => surface.dataRegistryEntities);
const expectedPrimaryOrder = ["edit", "preview", "more"] as const;
const expectedMoreOrder = [
  "information",
  "copyPublicLink",
  "visibility",
  "featured",
  "duplicate",
  "archive",
  "delete",
] as const;
const governedActionOrder = [
  "edit",
  "preview",
  ...expectedMoreOrder,
] as const satisfies readonly AdminRowActionsGovernedAction[];
const mutatingActions = [
  "visibility",
  "featured",
  "duplicate",
  "archive",
  "delete",
] as const satisfies readonly AdminRowActionsGovernedAction[];
const dangerousActions = [
  "archive",
  "delete",
] as const satisfies readonly AdminRowActionsGovernedAction[];

const paths = {
  manifest: "src/lib/admin/interaction-system/adoption-manifest.ts",
  registry: "src/lib/admin/entity-list/data-engine/registry.ts",
  capability:
    "src/lib/admin/interaction-system/admin-row-actions-capability.ts",
  renderer: "src/components/admin/ui/AdminDataGridRowActions.tsx",
  dataGrid: "src/components/admin/ui/AdminDataGrid.tsx",
  entityListSurface:
    "src/components/admin/entity-list/AdminEntityListSurface.tsx",
  entityList: "src/components/admin/entity-list/AdminEntityList.tsx",
  entityListTable:
    "src/components/admin/entity-list/AdminEntityListTable.tsx",
  confirmation: "src/components/admin/ui/AdminConfirmDialog.tsx",
  floatingLayer:
    "src/components/admin/entity-list/AdminFloatingLayerContext.tsx",
  floatingPosition:
    "src/components/admin/ui/useAdminFloatingMenuPosition.ts",
  instantMutation:
    "src/lib/admin/entity-list/data-engine/instant-mutation.ts",
  dataAdapter: "src/lib/admin/entity-list/data-engine/adapter.ts",
  dataController:
    "src/lib/admin/entity-list/data-engine/client-controller.ts",
  adminListSearch: "src/lib/admin/admin-list-search.ts",
  topics: "src/components/admin/content/UnifiedContentRowActions.tsx",
  topicsList: "src/components/admin/content/TopicsListClient.tsx",
  topicsColumns: "src/components/admin/content/unified-content-columns.tsx",
  categories: "src/app/admin/content/categories/CategoryRowActions.tsx",
  categoriesList:
    "src/app/admin/content/categories/CategoriesListClient.tsx",
  categoriesColumns:
    "src/app/admin/content/categories/categories-columns.tsx",
  series: "src/app/admin/content/series/series-columns.tsx",
  seriesList: "src/app/admin/content/series/SeriesTableClient.tsx",
  pages: "src/app/admin/pages-blocks/pages/PagesTableClient.tsx",
  projectsList: "src/app/admin/projects/ProjectsTableClient.tsx",
  projects:
    "src/app/admin/projects/projects-table/ReferenceProjectsTable.tsx",
  projectsAdapter: "src/lib/admin/projects/entity-list-adapter.ts",
  projectPublishing:
    "sql/migrations/20260803120000_project_publishing_visibility_capability.sql",
  projectLocations:
    "src/app/admin/projects/locations/ProjectLocationsManagementClient.tsx",
  redirects: "src/app/admin/seo/redirects/RedirectsClient.tsx",
  pagesConfig: "src/lib/admin/pages/pages-list-config.ts",
  pagesPreferences:
    "src/app/admin/pages-blocks/pages/page-actions/column-preferences.ts",
  pagination: "src/components/admin/ui/AdminTablePagination.tsx",
  boundedPagination:
    "src/lib/admin/entity-list/bounded-client-pagination.ts",
  pageAssignments:
    "src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx",
  pageAssignmentsGrid:
    "src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksAssignmentsGrid.tsx",
  pageAssignmentRow:
    "src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksAssignmentRow.tsx",
  pageActions: "src/app/admin/pages-blocks/pages/actions.ts",
  pageActionIndex:
    "src/app/admin/pages-blocks/pages/page-actions/index.ts",
  menuItems:
    "src/app/admin/pages-blocks/menus/MenuItemsTableClient.tsx",
  menuActions: "src/app/admin/pages-blocks/menus/actions.ts",
  menuActionIndex:
    "src/app/admin/pages-blocks/menus/menu-actions/index.ts",
  footerLinks:
    "src/app/admin/pages-blocks/footer/FooterLinksDataGrid.tsx",
  blockModuleManager:
    "src/components/admin/page-blocks/BlockModuleManagerClient.tsx",
  contentBlockManager:
    "src/app/admin/pages-blocks/blocks/content/ContentBlocksTableClient.tsx",
  heroBlockManager:
    "src/app/admin/pages-blocks/blocks/hero/HeroManagerClient.tsx",
  blockTemplateSummary:
    "src/app/admin/pages-blocks/blocks/BlockTemplateSummaryListClient.tsx",
  pageExperience: "src/components/admin/ui/AdminPageExperience.tsx",
  pageHeader: "src/components/admin/ui/AdminPageContextHeader.tsx",
  shell: "src/components/admin/AdminShell.tsx",
  activityLog: "src/app/admin/activity-log/ActivityLogClient.tsx",
  topicsWithoutImage:
    "src/app/admin/reports/topics-without-image/TopicsWithoutImageReportClient.tsx",
  redirectsFilters: "src/app/admin/seo/redirects/RedirectsListFilters.tsx",
  redirectsActions: "src/app/admin/seo/redirects/actions.ts",
  redirectsAdapter: "src/lib/admin/redirects/entity-list-adapter.ts",
  activityAdapter: "src/lib/admin/audit/entity-list-adapter.ts",
  activityLoader: "src/lib/admin/audit/list-admin-audit-logs.ts",
  reportAdapter:
    "src/lib/admin/media-catalog/topics-without-image-entity-list-adapter.ts",
  reportQuery: "src/lib/admin/media-catalog/reports.ts",
  mediaRecovery:
    "src/app/admin/settings/media/MediaRecoveryCenter.tsx",
  usersRoles: "src/app/admin/users-roles/UsersManagementClient.tsx",
  usersForm: "src/app/admin/users-roles/AdminUserFormModal.tsx",
  usersActions: "src/app/admin/users-roles/actions.ts",
} as const;

const capabilityManifestSource = read(
  "src/lib/admin/interaction-system/adoption-manifest.ts",
);
const capabilitySetDefinitionFailures = currentSharedCapabilityKeys.filter(
  (capability) => {
    const definition: AdminSharedConsumerCapabilityDefinition =
      ADMIN_CURRENT_SHARED_CAPABILITY_SET[capability];
    return (
      !definition.owner.trim() ||
      definition.applicabilitySourceTokens.length === 0 ||
      definition.consumerBoundaries.length === 0 ||
      typeof definition.absenceMeansNotApplicable !== "boolean" ||
      (definition.ownerAvailability === "available" &&
        (definition.sourceFiles.length === 0 ||
          definition.sourceProofTokens.length === 0))
    );
  },
);

const capabilityApplicabilityFailures = consumerCapabilityAuditRecords.flatMap(
  (consumer) =>
    collectConsumerCapabilityAuditFailures(consumer, "applicability").map(
      (failure) => `${consumer.boundary}:${consumer.id}:${failure}`,
    ),
);
const capabilitySourceProofFailures = consumerCapabilityAuditRecords.flatMap(
  (consumer) =>
    collectConsumerCapabilityAuditFailures(consumer, "source_proof").map(
      (failure) => `${consumer.boundary}:${consumer.id}:${failure}`,
    ),
);

if (capabilityApplicabilityFailures.length > 0) {
  console.error(
    `Consumer Capability Applicability failures:\n${capabilityApplicabilityFailures.join("\n")}`,
  );
}
if (capabilitySourceProofFailures.length > 0) {
  console.error(
    `Consumer Capability Source Proof failures:\n${capabilitySourceProofFailures.join("\n")}`,
  );
}

const capabilityFixtureConsumer = consumerCapabilityAuditRecords[0];
assert.ok(capabilityFixtureConsumer);
const invalidApprovedExceptionConsumer = {
  ...capabilityFixtureConsumer,
  declaration: {
    phase: "capability_applicability",
    overrides: {
      confirmation: {
        state: "approved_exception",
        scope: "",
        approvingOwner: "",
        evidence: [],
        rationale: "",
      },
    },
  },
} as ConsumerCapabilityAuditRecord;
const missingAdoptionConsumer = {
  ...capabilityFixtureConsumer,
  declaration: {
    phase: "capability_applicability",
    overrides: {
      confirmation: {
        state: "missing_adoption",
        rationale: "Negative fixture: applicable behavior has no adoption.",
      },
    },
  },
} as ConsumerCapabilityAuditRecord;
const genericLocalImplementationSource = `${consumerCapabilitySource(capabilityFixtureConsumer)}\nwindow.confirm("fixture");`;

check(
  "Current Shared Capability Set is the single dynamic source for audit axes, owners, and source proof",
  currentSharedCapabilityKeys.length > 0 &&
    capabilitySetDefinitionFailures.length === 0 &&
    capabilityManifestSource.includes(
      "keyof typeof ADMIN_CURRENT_SHARED_CAPABILITY_SET",
    ) &&
    !capabilityManifestSource.includes("ADMIN_CONSUMER_CAPABILITY_KEYS"),
);
check(
  "a future shared capability automatically enters every consumer audit without a fixed count or audit branch",
  futureSharedCapabilityKeysFixture.length ===
    currentSharedCapabilityKeys.length + 1 &&
    futureSharedCapabilityKeysFixture.includes(
      FUTURE_SHARED_CAPABILITY_FIXTURE,
    ) &&
    futureConsumerAuditProjectionFixtures.every(
      ({ decisions }) =>
        Object.hasOwn(decisions, FUTURE_SHARED_CAPABILITY_FIXTURE) &&
        Object.keys(decisions).length ===
          futureSharedCapabilityKeysFixture.length,
    ),
);
check(
  "Approved Exception verification fails closed unless Scope, Approving Owner, Evidence, and Rationale are present",
  collectConsumerCapabilityAuditFailures(
    invalidApprovedExceptionConsumer,
    "applicability",
  ).includes("confirmation:invalid_approved_exception_contract"),
);
check(
  "applicable behavior without canonical adoption cannot disappear inside not_applicable",
  collectConsumerCapabilityAuditFailures(
    missingAdoptionConsumer,
    "source_proof",
  ).includes("confirmation:missing_adoption"),
);
check(
  "local and parallel implementation detection is projected generically from capability metadata",
  localImplementationMatches(
    "confirmation",
    genericLocalImplementationSource,
  ).length === 1,
);

check(
  "every registered Admin consumer completes Capability Applicability across the canonical capability axes",
  consumerCapabilityAuditRecords.length > 0 &&
    capabilityApplicabilityFailures.length === 0,
);
check(
  "every adopted Admin consumer capability has canonical Source Proof with no local or parallel rendering",
  capabilitySourceProofFailures.length === 0,
);

for (const [id, sourceFile] of Object.entries(paths)) {
  check(`${id} canonical source exists`, existsSync(join(ROOT, sourceFile)));
}

const registryEntities = extractRegistryEntities(read(paths.registry));
const manifestEntries = ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION.entities;
const manifestEntities = manifestEntries.map((entry) => entry.entity);
const manifestEntitySet = new Set<string>(manifestEntities);
const sharedCapabilitiesModule = ADMIN_INTERACTION_MODULES.find(
  (module) => module.id === "shared_capabilities",
);

check(
  "Shared Capabilities inventory registers the Row Actions contract and renderer",
  [paths.capability, paths.renderer].every((sourceFile) =>
    sharedCapabilitiesModule?.sourceFiles.includes(sourceFile),
  ),
);
check(
  "Admin Interaction System publishes a fail-closed adoption state",
  ADMIN_INTERACTION_SYSTEM.globalClosed ===
    ADMIN_COLLECTION_SURFACE_ADOPTION.globalClosed &&
    closureStateIsConsistent(
      ADMIN_INTERACTION_SYSTEM.globalClosed,
      ADMIN_INTERACTION_SYSTEM.globalClosureBlockers,
    ),
);

check(
  "Entity List registry and manifest contain the same generic Data Runtime adopters",
  sameValueSet(registryEntities, declaredDataRegistryEntities) &&
    new Set(declaredDataRegistryEntities).size ===
      declaredDataRegistryEntities.length,
);
check(
  "Row Actions adoption ledger covers only generic collections with row commands",
  sameValueSet(manifestEntities, expectedRowActionEntities) &&
    manifestEntities.every((entity) =>
      new Set<string>(registryEntities).has(entity),
    ),
);
check(
  "Row Actions adoption ledger entity IDs are unique",
  new Set(manifestEntities).size === manifestEntities.length,
);
check(
  "generic Row Actions adoption is globally closed after authenticated Browser QA",
  ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION.globalClosed === true &&
    ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION.globalClosureBlockers.length === 0,
);
check(
  "none of the generic collections claims Manual Order support",
  manifestEntries.every((entry) => entry.manualOrder === false),
);

check(
  "primary row-action order is Edit, Preview, More",
  sameOrderedValues(ADMIN_ROW_ACTION_PRIMARY_ORDER, expectedPrimaryOrder) &&
    sameOrderedValues(
      ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION.canonicalOrders.primary,
      expectedPrimaryOrder,
    ),
);
check(
  "More order is Information, Copy Public Link, Visibility, Featured, Duplicate, Archive, Delete",
  sameOrderedValues(ADMIN_ROW_ACTION_MORE_ORDER, expectedMoreOrder) &&
    sameOrderedValues(
      ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION.canonicalOrders.more,
      expectedMoreOrder,
    ),
);

const dataGridSource = read(paths.dataGrid);
const rendererSource = read(paths.renderer);
check(
  "DataGrid primitive publishes the same fixed primary order",
  /actionOrder:\s*\[\s*["']edit["']\s*,\s*["']preview["']\s*,\s*["']more["']\s*\]/m.test(
    dataGridSource,
  ),
);
check(
  "shared renderer resolves More items only through the canonical order",
  rendererSource.includes("ADMIN_ROW_ACTION_MORE_ORDER.map") &&
    rendererSource.includes('label: "نسخ الرابط العام"') &&
    dataGridSource.includes('| "copy-link"'),
);
check(
  "More uses the existing floating-layer infrastructure with viewport collision",
  rendererSource.includes("useAdminFloatingLayer") &&
    rendererSource.includes("useAdminFloatingMenuPosition") &&
    rendererSource.includes("createPortal(") &&
    rendererSource.includes("max-w-[calc(100vw-24px)]") &&
    rendererSource.includes('dir="rtl"'),
);
check(
  "More exposes the shared keyboard and focus contract",
  ["ArrowDown", "ArrowUp", "Home", "End", "Escape", "Tab"].every(
    (key) => rendererSource.includes(`"${key}"`),
  ) &&
    rendererSource.includes("event.shiftKey") &&
    rendererSource.includes("focusAdjacentToTrigger") &&
    rendererSource.includes("const wrapped = backwards") &&
    rendererSource.includes("next ?? wrapped ?? fallback") &&
    rendererSource.includes("focus-visible:outline"),
);
check(
  "More focuses its requested enabled item during layout without a cancellable frame race",
  rendererSource.includes("type PanelFocusIntent") &&
    rendererSource.includes("useLayoutEffect(() => {") &&
    rendererSource.includes(
      "const focusIntent = panelFocusIntentRef.current",
    ) &&
    rendererSource.includes("document.activeElement === focusTarget") &&
    rendererSource.includes("panelFocusIntentRef.current = null") &&
    !rendererSource.includes("focusMenuOnOpenRef"),
);
check(
  "new Row Actions focus sessions supersede stale restoration callbacks across rows and unmount",
  rendererSource.includes("type ResolvedFocusRestoreHandle") &&
    rendererSource.includes("let activeResolvedFocusRestore") &&
    rendererSource.includes("function cancelPendingResolvedFocus") &&
    rendererSource.includes("activeResolvedFocusRestore !== handle") &&
    rendererSource.includes("focusRestoreHandleRef.current") &&
    /function openWithFocus[\s\S]{0,500}cancelPendingResolvedFocus\(\);[\s\S]{0,500}setIsOpen\(true\)/.test(
      rendererSource,
    ) &&
    rendererSource.includes("window.cancelAnimationFrame") &&
    rendererSource.includes(
      "const pendingRestore = focusRestoreHandleRef.current",
    ) &&
    rendererSource.includes("pendingRestore?.isPending()") &&
    rendererSource.includes("pendingRestore?.cancel()") &&
    rendererSource.includes("activeElement !== document.body") &&
    rendererSource.includes(
      "const immediateFocusTarget = resolveReturnFocus()",
    ),
);
check(
  "Information focus and return use explicit targets with a visible title fallback",
  rendererSource.includes('"information-panel"') &&
    rendererSource.includes('"information-menu-item"') &&
    rendererSource.includes("informationBackRef.current") &&
    rendererSource.includes("informationTitleRef.current") &&
    rendererSource.includes('data-admin-row-actions-information-title=""') &&
    rendererSource.includes("tabIndex={-1}") &&
    rendererSource.includes(
      '[data-admin-row-action-menu-item="information"]:not([aria-disabled="true"])',
    ),
);
check(
  "Escape, outside close, and removed-row cleanup share a visible non-body focus resolver",
  rendererSource.includes("const createReturnFocusResolver = useCallback") &&
    rendererSource.includes("closeAndReturnFocus();") &&
    rendererSource.includes(
      "const immediateFocusTarget = resolveReturnFocus()",
    ) &&
    rendererSource.includes("restoreResolvedFocus(resolveReturnFocus)") &&
    rendererSource.includes("firstVisibleMore") &&
    rendererSource.includes("isVisibleFocusTarget(surface)") &&
    rendererSource.includes("const needsImmediateFallback") &&
    rendererSource.includes("if (!needsImmediateFallback) return") &&
    !rendererSource.includes("document.body.focus"),
);
check(
  "shared presentation exposes disabled and pending semantics",
  rendererSource.includes("aria-disabled={!enabled}") &&
    rendererSource.includes("aria-busy={target.pending || undefined}") &&
    rendererSource.includes("data-admin-row-action-state") &&
    rendererSource.includes("disabled={!enabled}"),
);
check(
  "More remains a menu trigger while pending stays scoped to its target command",
  rendererSource.includes("const menuItems = resolveMenuItems(capability)") &&
    !rendererSource.includes("const morePending") &&
    !/action="more"[\s\S]{0,500}pending=\{/u.test(rendererSource),
);

for (const entry of manifestEntries) {
  check(
    `${entry.entity} declares its consumer boundary in its governed source inventory`,
    entry.sourceFiles.some(
      (sourceFile) => sourceFile === entry.consumerSourceFile,
    ),
  );
  check(
    `${entry.entity} relevant sources all exist`,
    entry.sourceFiles.length >= (entry.auditedActions.length > 0 ? 3 : 1) &&
      entry.sourceFiles.every((sourceFile) =>
        existsSync(join(ROOT, sourceFile)),
      ),
  );

  const consumer = read(entry.consumerSourceFile);
  check(
    `${entry.entity} imports and renders the shared Row Actions capability`,
    consumer.includes("AdminDataGridRowActions") &&
      /<AdminDataGridRowActions\b/.test(consumer),
  );
  check(
    `${entry.entity} declares every governed action exactly once`,
    sameValueSet(Object.keys(entry.actions), governedActionOrder),
  );
  const staticHiddenActions = governedActionOrder.filter((action) =>
    new RegExp(
      `\\b${action}\\s*:\\s*\\{\\s*access\\s*:\\s*["']hidden["']\\s*\\}`,
      "m",
    ).test(consumer),
  );
  const manifestHiddenActions = governedActionOrder.filter(
    (action) => entry.actions[action] === "hidden",
  );
  check(
    `${entry.entity} manifest matches its statically hidden actions`,
    sameValueSet(staticHiddenActions, manifestHiddenActions),
  );
  check(
    `${entry.entity} delegates to the existing shared owners`,
    entry.owners.presentation ===
      ADMIN_ROW_ACTIONS_EXISTING_OWNERS.presentation &&
      entry.owners.data === ADMIN_ROW_ACTIONS_EXISTING_OWNERS.data &&
      entry.owners.feedback === ADMIN_ROW_ACTIONS_EXISTING_OWNERS.feedback &&
      entry.owners.confirmation ===
        ADMIN_ROW_ACTIONS_EXISTING_OWNERS.confirmation &&
      entry.owners.audit === ADMIN_ROW_ACTIONS_EXISTING_OWNERS.audit,
  );

  const supportedMutations = mutatingActions.filter(
    (action) => entry.actions[action] !== "hidden",
  );
  check(
    `${entry.entity} declares Audit ownership for every supported mutation`,
    sameValueSet(entry.auditedActions, supportedMutations),
  );

  const supportedDangerousActions = dangerousActions.filter(
    (action) => entry.actions[action] !== "hidden",
  );
  check(
    `${entry.entity} declares Confirmation ownership for every dangerous action`,
    sameValueSet(entry.confirmationActions, supportedDangerousActions),
  );

  const relevantSource = entry.sourceFiles.map(read).join("\n");
  const sharedConfirmationDeclaration =
    /confirmation\s*:\s*\{[\s\S]{0,240}?mode\s*:\s*["']shared["']/.test(
      consumer,
    );
  const delegatedConfirmationDeclaration =
    /confirmation\s*:\s*\{[\s\S]{0,240}?mode\s*:\s*["']delegated["'][\s\S]{0,240}?owner\s*:\s*["']confirmation_runtime["']/.test(
      consumer,
    );
  if (supportedMutations.length > 0) {
    const retainsServerAuditIntegration =
      relevantSource.includes("recordCmsAdminAudit") ||
      relevantSource.includes("recordAdminAuditEvent");
    check(
      `${entry.entity} retains server-side Audit integration in its domain sources`,
      retainsServerAuditIntegration,
    );
    check(
      `${entry.entity} keeps action-targeted pending with its declared Data owner`,
      relevantSource.includes("useAdminEntityInstantMutation") &&
        relevantSource.includes("instant.getRowInteraction") &&
        consumer.includes("interaction.pendingAction") &&
        !consumer.includes("interaction.isBlocked"),
    );
  }
  if (supportedDangerousActions.length > 0) {
    check(
      `${entry.entity} uses the shared Confirmation owner and no native confirm`,
      (sharedConfirmationDeclaration || delegatedConfirmationDeclaration) &&
        !relevantSource.includes("window.confirm"),
    );
  }
  if (entry.actions.delete === "adopted") {
    check(
      `${entry.entity} rejects failed shared-confirmation commands after publishing feedback`,
      consumer.includes("if (!result.ok) throw") || consumer.includes("throw "),
    );
  }
}

const ownerSourceFiles = Object.values(
  ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION.ownerSourceFiles,
).flat();
check(
  "all declared Row Actions owner sources exist",
  ownerSourceFiles.every((sourceFile) => existsSync(join(ROOT, sourceFile))),
);
check(
  "owner source declarations are unique within each responsibility",
  Object.values(ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION.ownerSourceFiles).every(
    (sourceFiles) => new Set(sourceFiles).size === sourceFiles.length,
  ),
);

const topicsSource = read(paths.topics);
check(
  "Topics row path has no local mutation transition or refresh owner",
  !topicsSource.includes("useTransition") &&
    !topicsSource.includes("pendingRef") &&
    !/\brouter\s*\.\s*refresh\s*\(/.test(topicsSource),
);

const pagesSource = read(paths.pages);
check(
  "Pages has no local AdminNotice feedback owner",
  !/<AdminNotice\b|\buseAdminFeedback\b|\bsetFeedback\b/.test(pagesSource),
);
check(
  "Pages duplicate is not a direct server-action form",
  !/\baction\s*=\s*\{\s*duplicatePage\s*\}/.test(pagesSource),
);

const sharedCoreSource = [
  read(paths.capability),
  rendererSource,
  dataGridSource,
].join("\n");
const entityLiteralPattern =
  /["'`](?:topics|categories|series|pages|projects|redirects)["'`]/i;
const entityRoutePattern =
  /\/(?:admin\/content|admin\/pages-blocks|admin\/projects|topics|projects)(?:\/|\?|["'`])/i;
check(
  "shared Row Actions core contains no registered-entity hardcoding",
  !entityLiteralPattern.test(sharedCoreSource) &&
    !entityRoutePattern.test(sharedCoreSource),
);

const capabilityAndRendererSource = [
  read(paths.capability),
  rendererSource,
].join("\n");
check(
  "shared capability owns no mutation, feedback, or audit runtime and delegates confirmation",
  !capabilityAndRendererSource.includes("useAdminEntityInstantMutation") &&
    !capabilityAndRendererSource.includes("recordCmsAdminAudit") &&
    !capabilityAndRendererSource.includes("AdminFeedbackProvider") &&
    rendererSource.includes("AdminConfirmDialog") &&
    !capabilityAndRendererSource.includes("window.confirm") &&
    !/<form\b/.test(capabilityAndRendererSource),
);

const instantMutationSource = read(paths.instantMutation);
check(
  "existing Data Runtime owns optimism, row-scoped duplicate-click protection, safe sequencing, rollback, and targeted invalidation",
  instantMutationSource.includes("request.optimistic(helpers)") &&
    instantMutationSource.includes("pendingRowsRef.current.has(rowId)") &&
    instantMutationSource.includes("queueRef.current.then") &&
    instantMutationSource.includes("restoreSnapshot(context.snapshot)") &&
    instantMutationSource.includes("invalidateQueries({") &&
    instantMutationSource.includes("adminEntityListQueryKeys.entity(entity)"),
);
const confirmationSource = read(paths.confirmation);
check(
  "existing Confirmation Runtime owns focus trapping and pending invocation lock",
  confirmationSource.includes("FOCUSABLE_SELECTOR") &&
    confirmationSource.includes("invokingRef.current") &&
    confirmationSource.includes("returnFocusRef") &&
    confirmationSource.includes('aria-modal="true"'),
);

const entityListSurfaceSource = read(paths.entityListSurface);
const entityListSource = read(paths.entityList);
const entityListTableSource = read(paths.entityListTable);
const floatingLayerSource = read(paths.floatingLayer);
const floatingPositionSource = read(paths.floatingPosition);
const topicsColumnsSource = read(paths.topicsColumns);
const categoriesListSource = read(paths.categoriesList);
const categoriesColumnsSource = read(paths.categoriesColumns);
const seriesColumnsSource = read(paths.series);
const projectsColumnsSource = read(paths.projects);

check(
  "shared Row Actions geometry fixes three compact buttons at 144px",
  dataGridSource.includes("buttonCount: 3") &&
    dataGridSource.includes("buttonPx: 40") &&
    dataGridSource.includes("gapPx: 4") &&
    dataGridSource.includes("cellInlinePaddingPx: 6") &&
    dataGridSource.includes("borderSafetyPx: 4") &&
    dataGridSource.includes("ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH") &&
    dataGridSource.includes("cellInlinePaddingPx * 2") &&
    dataGridSource.includes("borderSafetyPx"),
);
check(
  "actions header, body, and colgroup share width/minWidth/maxWidth",
  dataGridSource.includes("getAdminDataGridFixedColumnStyle") &&
    dataGridSource.includes("minWidth: width") &&
    dataGridSource.includes("maxWidth: width") &&
    entityListTableSource.includes(
      "getAdminDataGridFixedColumnStyle(actionsColumnWidth)",
    ) &&
    entityListTableSource.includes("<AdminDataGridStickyActionsHeaderCell") &&
    entityListTableSource.includes("<AdminDataGridStickyActionsCell"),
);
check(
  "fixed data tracks stay fixed while opt-in presentation spacers can fill the remaining viewport width",
  entityListTableSource.includes("const flexibleColumnKey =") &&
    entityListTableSource.includes("const explicitFlexibleColumnKey =") &&
    entityListTableSource.includes("implicitFlexibleColumn?: boolean") &&
    entityListTableSource.includes("implicitFlexibleColumn = true") &&
    entityListTableSource.includes("explicitFlexibleColumnKey ??") &&
    entityListTableSource.includes("(implicitFlexibleColumn") &&
    entityListTableSource.includes("!column.primary") &&
    entityListTableSource.includes(": undefined);") &&
    entityListTableSource.includes("function getColumnBaseWidth") &&
    entityListTableSource.includes("const tableMinWidth =") &&
    entityListTableSource.includes('className="w-full table-fixed') &&
    entityListTableSource.includes("column.key === flexibleColumnKey") &&
    entityListTableSource.includes("fillAvailableWidth?: boolean") &&
    entityListTableSource.includes("fillAvailableWidth = false") &&
    entityListTableSource.includes(
      "const showFillSpacer = fillAvailableWidth && flexibleColumnKey === undefined",
    ) &&
    entityListTableSource.includes("data-admin-table-fill-spacer") &&
    entityListTableSource.includes(
      "flexibleColumnKey === undefined && !showFillSpacer",
    ) &&
    !entityListTableSource.includes("w-max min-w-full table-fixed"),
);
check(
  "shared grid cells own equal 6px logical inline padding",
  dataGridSource.includes('actionCellInlinePadding: "px-1.5"') &&
    dataGridSource.includes('cellInlinePadding: "px-1.5"') &&
    dataGridSource.includes(
      "cellInlinePaddingPx: ADMIN_DATA_GRID_ROW_ACTIONS_CONTRACT.cellInlinePaddingPx",
    ) &&
    dataGridSource.includes("ADMIN_DATA_GRID_HEADER_ROW_CELL_CLASSES") &&
    dataGridSource.includes("ADMIN_DATA_GRID_BODY_ROW_CELL_CLASSES"),
);

const geometryConsumers = [
  topicsColumnsSource,
  categoriesColumnsSource,
  seriesColumnsSource,
  pagesSource,
  projectsColumnsSource,
  read(paths.redirects),
];
check(
  "all generic consumers use the shared actions width without local constants",
  [
    topicsColumnsSource,
    categoriesColumnsSource,
    seriesColumnsSource,
    projectsColumnsSource,
    pagesSource,
    read(paths.redirects),
  ].every((source) =>
    source.includes("ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH"),
  ) &&
    geometryConsumers.every(
      (source) =>
        !/(?:ACTION|ACTIONS)[A-Z0-9_]*_COLUMN_WIDTH\s*=\s*(?:132|144|156)\b/.test(
          source,
        ),
    ),
);
check(
  "Pages delegates padded sticky action placement to AdminEntityListTable",
  pagesSource.includes("<AdminEntityList<") &&
    pagesSource.includes('sticky: "end"') &&
    pagesSource.includes('sticky: "end-adjacent"') &&
    pagesSource.includes("ADMIN_DATA_GRID_ROW_ACTIONS_COLUMN_WIDTH") &&
    entityListTableSource.includes('column.sticky === "end-adjacent"') &&
    entityListTableSource.includes("insetInlineEnd: actionsColumnWidth") &&
    entityListTableSource.includes(
      'data-admin-grid-sticky="inline-end-adjacent"',
    ) &&
    !pagesSource.includes("AdminDataGridActionsHeaderCell") &&
    !pagesSource.includes("flushInlineEnd"),
);

check(
  "shared primary-column contract budgets 200px before ellipsis",
  dataGridSource.includes("textBudgetPx: 200") &&
    dataGridSource.includes("ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS") &&
    dataGridSource.includes("textOnly:") &&
    dataGridSource.includes("compactIcon:") &&
    dataGridSource.includes("standardIcon:"),
);
check(
  "Topics, Series, Projects, and Pages consume shared primary presets",
  topicsColumnsSource.includes(
    "ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS.compactIcon",
  ) &&
    seriesColumnsSource.includes(
      "ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS.standardIcon",
    ) &&
    projectsColumnsSource.includes(
      "ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS.standardIcon",
    ) &&
    pagesSource.includes("ADMIN_DATA_GRID_PRIMARY_COLUMN_PRESETS.textOnly"),
);
check(
  "Categories derives one hierarchy-aware width from maximum visible depth",
  dataGridSource.includes("getAdminDataGridHierarchyPrimaryColumnWidth") &&
    dataGridSource.includes("hierarchyDepthStepPx: 28") &&
    categoriesColumnsSource.includes(
      "getAdminDataGridHierarchyPrimaryColumnWidth(maxVisibleDepth)",
    ) &&
    categoriesListSource.includes("const maxVisibleDepth = pageRows.reduce") &&
    categoriesListSource.includes("{ maxVisibleDepth }") &&
    !categoriesColumnsSource.includes("width: row.depth"),
);

const listConsumerSources = [
  read(paths.topicsList),
  categoriesListSource,
  read(paths.seriesList),
  pagesSource,
  read(paths.projectsList),
  read(paths.redirects),
  read(paths.activityLog),
  read(paths.topicsWithoutImage),
];
check(
  "all generic consumers removed local Surface spacing",
  listConsumerSources.every(
    (source) =>
      !/<AdminEntityListSurface\b[^>]*className\s*=\s*["'][^"']*space-y-4/.test(
        source,
      ),
  ),
);
check(
  "shared list parents attach Toolbar to Grid while preserving outer 28px and table-footer 16px cadence",
  entityListSurfaceSource.includes("AdminEntityListPrimarySection") &&
    entityListSurfaceSource.includes(
      'SURFACE_LAYOUT_CLASSES = "flex flex-col gap-7"',
    ) &&
    entityListSurfaceSource.includes("AdminEntityListTableRegion") &&
    entityListSurfaceSource.includes(
      'TABLE_REGION_LAYOUT_CLASSES = "flex flex-col gap-4"',
    ) &&
    entityListSurfaceSource.includes(
      'data-admin-entity-list-table-region=""',
    ) &&
    !entityListSurfaceSource.includes("mt-3") &&
    entityListSurfaceSource.includes("AdminEntityListPageLayout") &&
    entityListSurfaceSource.includes("gap-7") &&
    entityListSource.includes("AdminEntityListPrimarySection") &&
    entityListSource.includes('toolbar ? "gap-0" : "gap-7"') &&
    entityListSource.includes("<AdminEntityListFilters") &&
    entityListSource.includes(
      'toolbar ? "!rounded-t-none !border-t-0" : undefined',
    ) &&
    !entityListSource.includes("primary-section]:mt-") &&
    !read(paths.pagination).includes("className={`mt-4") &&
    read(paths.pagination).includes('data-admin-table-pagination=""') &&
    read(paths.pageExperience).includes("flex flex-col gap-7") &&
    listConsumerSources.every(
      (source) =>
        source.includes("AdminEntityListTableRegion") &&
        /<AdminEntityListTableRegion\b[\s\S]*?<AdminTablePagination\b[\s\S]*?<\/AdminEntityListTableRegion>/.test(
          source,
        ),
    ),
);

check(
  "More icon is vertical at the shared icon owner",
  dataGridSource.includes('<circle cx="12" cy="5" r="1.7" />') &&
    dataGridSource.includes('<circle cx="12" cy="12" r="1.7" />') &&
    dataGridSource.includes('<circle cx="12" cy="19" r="1.7" />') &&
    !dataGridSource.includes('<circle cx="5" cy="12"') &&
    !dataGridSource.includes('<circle cx="19" cy="12"'),
);
check(
  "Pages uses shared page cadence, columns persistence, and Entity List",
  pagesSource.includes("<AdminEntityListPageLayout") &&
    pagesSource.includes("<AdminEntityListTableRegion") &&
    pagesSource.includes("enableColumnManagement") &&
    pagesSource.includes("savePagesTablePreferences") &&
    read(paths.pagesConfig).includes("PAGES_PREFERENCE_COLUMN_KEYS") &&
    read(paths.pagesPreferences).includes("saveAdminColumnPreferences") &&
    !pagesSource.includes("ADMIN_LIST_PAGE.wrapper"),
);

const collectionIds = collectionSurfaces.map((surface) => surface.id);
const classifiedPresentationSources = collectionSurfaces.flatMap((surface) =>
  surface.presentationSourceFiles.map((sourceFile) => ({
    id: surface.id,
    sourceFile,
  })),
);
const presentationSourceCounts = new Map<string, number>();
for (const { sourceFile } of classifiedPresentationSources) {
  presentationSourceCounts.set(
    sourceFile,
    (presentationSourceCounts.get(sourceFile) ?? 0) + 1,
  );
}
const scannedCollectionPresentationSources = [
  ...collectTsxFiles(join(ROOT, "src/app/admin")),
  ...collectTsxFiles(join(ROOT, "src/components/admin")),
]
  .filter((sourceFile) => {
    const source = readFileSync(sourceFile, "utf8");
    const relative = relativeSourceFile(sourceFile);
    const isTopLevelCardCatalog =
      relative.startsWith("src/app/admin/") &&
      relative.endsWith("/page.tsx") &&
      /<AdminCard\b/.test(source) &&
      /\.map\s*\(/.test(source);
    const isMappedCommandQueue =
      relative.startsWith("src/app/admin/") &&
      /<article\b/.test(source) &&
      /\ballowedActions\.map\s*\(/.test(source);
    return (
      /<AdminEntityList(?:\s|<)|<AdminDataGrid(?:\s|>)|<table(?:\s|>)/.test(
        source,
      ) ||
      isTopLevelCardCatalog ||
      isMappedCommandQueue
    );
  })
  .map(relativeSourceFile)
  .filter(
    (sourceFile) =>
      sourceFile !==
      "src/components/admin/entity-list/AdminEntityListTable.tsx",
  )
  .sort();

check(
  "Collection inventory IDs and concrete presentation ownership are unique",
  new Set(collectionIds).size === collectionIds.length &&
    [...presentationSourceCounts.values()].every((count) => count === 1),
);
check(
  "Collection inventory owns only concrete collection/list workflows",
  !Object.hasOwn(ADMIN_COLLECTION_SURFACE_ADOPTION, "outOfScopePages") &&
    collectionSurfaces.every(
      (surface) =>
        surface.routes.length > 0 &&
        surface.pageSourceFiles.length > 0 &&
        "workflowClassification" in surface,
    ),
);
check(
  "every inventoried Collection page and presentation source exists",
  collectionSurfaces.every((surface) =>
    [...surface.pageSourceFiles, ...surface.presentationSourceFiles].every(
      (sourceFile) => existsSync(join(ROOT, sourceFile)),
    ),
  ),
);
const activeCollectionSurfaces = collectionSurfaces.filter(
  (surface) => surface.lifecycle !== "deprecated",
);
const deprecatedCollectionSurfaces = collectionSurfaces.filter(
  (surface) => surface.lifecycle === "deprecated",
);
const unreachableActiveConsumerSources = activeCollectionSurfaces.flatMap(
  (surface) => {
    const pageGraphs = surface.pageSourceFiles.map((pageSourceFile) =>
      collectSourceGraph([pageSourceFile]),
    );
    return surface.presentationSourceFiles
      .filter(
        (presentationSourceFile) =>
          !pageGraphs.some((graph) => graph.has(presentationSourceFile)),
      )
      .map(
        (presentationSourceFile) =>
          `${surface.id}:${presentationSourceFile}`,
      );
  },
);
check(
  "every active Collection consumer is reachable from an inventoried route and deprecated consumers carry explicit evidence",
  unreachableActiveConsumerSources.length === 0 &&
    deprecatedCollectionSurfaces.every(
      (surface) =>
        surface.deprecationEvidence !== undefined &&
        surface.deprecationEvidence.owner.trim().length > 0 &&
        surface.deprecationEvidence.evidence.length > 0 &&
        surface.deprecationEvidence.evidence.every((item) => item.trim()),
    ),
);
check(
  "every Collection entry declares the requested ownership and adoption axes",
  collectionSurfaces.every(
    (surface) =>
      surface.sourceOwner.trim().length > 0 &&
      (surface.workflowClassification === "auth_out_of_scope"
        ? surface.headerOwner === "not_applicable" &&
          surface.headerState === "auth_out_of_scope"
        : surface.headerOwner === "AdminPageContextHeader" &&
          surface.headerState === "adopted") &&
      ["adopted", "auth_out_of_scope"].includes(surface.pageChromeAdoption) &&
      ["adopted", "not_applicable"].includes(surface.collectionAdoption) &&
      "rowActionsState" in surface &&
      "paginationState" in surface &&
      "paginationOwner" in surface &&
      "gridOwner" in surface &&
      "feedbackOwner" in surface &&
      "confirmationOwner" in surface &&
      "reorderOwner" in surface &&
      "semanticPresentation" in surface &&
      Array.isArray(surface.consumerAdoptionEvidence) &&
      "queryMode" in surface &&
      Array.isArray(surface.genuineExceptions) &&
      Array.isArray(surface.requiredAdoption) &&
      (surface.exceptionRationale === null ||
        surface.exceptionRationale.trim().length > 0),
  ),
);
const semanticPresentationFailures = collectionSurfaces.flatMap((surface) =>
  collectSemanticPresentationContractFailures(surface).map(
    (failure) => `${surface.id}:${failure}`,
  ),
);
check(
  `semantic state presentation is owned by Shared Row Actions or an explicit dedicated Status column contract${semanticPresentationFailures.length > 0 ? `: ${semanticPresentationFailures.join(", ")}` : ""}`,
  semanticPresentationFailures.length === 0,
);
const semanticPresentationFixtureContract = {
  sourceObjectNames: ["row"],
  sourceFieldNames: ["status", "is_visible"],
} as const;
const primaryCellFixtureOccurrences = collectSemanticPresentationOccurrences(
  "fixtures/semantic-primary-cell.tsx",
  `const Fixture = ({ row }) => {
    const published = row.status === "published";
    return <AdminDataGridPrimaryCell><span>{published ? "Published" : "Draft"}</span></AdminDataGridPrimaryCell>;
  };`,
  semanticPresentationFixtureContract,
);
const localBadgeFixtureOccurrences = collectSemanticPresentationOccurrences(
  "fixtures/semantic-local-badge.tsx",
  `const Fixture = ({ row }) => <LocalStatusBadge visible={row.is_visible} />;`,
  semanticPresentationFixtureContract,
);
check(
  "semantic presentation guard rejects primary-cell and undeclared local badge fixtures",
  primaryCellFixtureOccurrences.some((occurrence) =>
    occurrence.ancestors.includes("AdminDataGridPrimaryCell"),
  ) &&
    localBadgeFixtureOccurrences.some(
      (occurrence) => occurrence.component === "LocalStatusBadge",
    ),
);
const pageBlockAssignmentSurface = collectionSurfaces.find(
  (surface) => surface.id === "page-block-assignments",
);
check(
  "Page Block assignment identity cell is free of publication and visibility presentation",
  pageBlockAssignmentSurface?.semanticPresentation.owner ===
    "shared_admin_row_actions" &&
    pageBlockAssignmentSurface.semanticPresentation.primaryCellContract ===
      "identity_primary_content_only" &&
    pageBlockAssignmentSurface.semanticPresentation.explicitSurfaceContracts
      .length === 0,
);
check(
  "surface workflow classifications use only the approved six-value contract",
  collectionSurfaces.every((surface) =>
    [
      "full_collection_adoption",
      "partial_collection_adoption",
      "specialized_data_owner_shared_collection_presentation",
      "page_system_only",
      "fixed_structure_not_paginated",
      "auth_out_of_scope",
    ].includes(surface.workflowClassification),
  ) &&
    !read(paths.manifest).includes("specialized_exception"),
);
check(
  "Collection classifications resolve to a concrete shared grid owner",
  collectionSurfaces.every((surface) => {
    if (
      surface.workflowClassification === "full_collection_adoption" ||
      surface.workflowClassification === "partial_collection_adoption"
    ) {
      return (
        surface.collectionAdoption === "adopted" &&
        surface.gridOwner === "AdminEntityList"
      );
    }
    if (
      surface.workflowClassification ===
      "specialized_data_owner_shared_collection_presentation"
    ) {
      return (
        surface.collectionAdoption === "adopted" &&
        ["AdminDataGrid", "MediaCatalog"].includes(surface.gridOwner)
      );
    }
    return surface.collectionAdoption === "not_applicable";
  }),
);
const collectionSurfaceComplianceFailures = collectionSurfaces.flatMap(
  (surface) =>
    collectCollectionSurfaceComplianceFailures(surface).map(
      (failure) => `${surface.id}:${failure}`,
    ),
);
check(
  "every Collection, specialized adopter, and explicit exception proves its classification from the existing contracts",
  collectionSurfaceComplianceFailures.length === 0,
);
const blockTemplateLibraries = collectionSurfaces.find(
  (surface) => surface.id === "block-template-libraries",
);
const groupedConsumerEvidenceFailures = collectionSurfaces.flatMap(
  (surface) => {
    if (surface.consumerAdoptionEvidence.length === 0) return [];
    const failures: string[] = [];
    if (
      !sameValueSet(
        surface.consumerAdoptionEvidence.map((consumer) => consumer.route),
        surface.routes,
      )
    ) {
      failures.push(`${surface.id}:route_coverage`);
    }
    for (const consumer of surface.consumerAdoptionEvidence) {
      const graph = collectSourceGraph([consumer.pageSourceFile]);
      const source = [...graph.values()].join("\n");
      if (
        !surface.pageSourceFiles.includes(consumer.pageSourceFile) ||
        !surface.presentationSourceFiles.includes(
          consumer.presentationOwner,
        ) ||
        !graph.has(consumer.presentationOwner)
      ) {
        failures.push(`${surface.id}:${consumer.id}:reachability`);
      }
      if (
        consumer.applicability.phase !== "capability_applicability" ||
        consumer.sourceProofTokens.length === 0
      ) {
        failures.push(`${surface.id}:${consumer.id}:applicability`);
      }
      for (const token of consumer.sourceProofTokens) {
        if (!source.includes(token)) {
          failures.push(
            `${surface.id}:${consumer.id}:source_proof:${token}`,
          );
        }
      }
      if (
        consumer.dataRegistryEntities.some(
          (entity) => !surface.dataRegistryEntities.includes(entity),
        )
      ) {
        failures.push(`${surface.id}:${consumer.id}:data_registry`);
      }
      if (consumer.requiredAdoption.length > 0) {
        failures.push(`${surface.id}:${consumer.id}:missing_adoption`);
      }
    }
    if (
      !sameValueSet(
        surface.consumerAdoptionEvidence.flatMap(
          (consumer) => consumer.dataRegistryEntities,
        ),
        surface.dataRegistryEntities,
      )
    ) {
      failures.push(`${surface.id}:aggregated_data_registry_claim`);
    }
    return failures;
  },
);
check(
  "each grouped Collection consumer owns independent applicability, adoption, reachability, and Source Proof",
  groupedConsumerEvidenceFailures.length === 0,
);
const blockTemplateConsumerContracts = [
  "collection",
  "table",
  "toolbar",
  "search",
  "filters",
  "header",
  "columns",
  "sort",
  "row_actions",
  "bulk",
  "selection",
  "pagination",
  "runtime",
  "data_registry",
] as const;
const blockTemplateContractTokens = {
  collection: "AdminDataGrid",
  table: "AdminDataGridHeader",
  toolbar: "AdminEntityListFilters",
  search: "search={{",
  filters: "AdminEntityListFilters",
  header: "AdminPageContextHeader",
  columns: "AdminColumnVisibilityMenu",
  sort: "AdminDataGridSortLabel",
  row_actions: "AdminDataGridRowActions",
  bulk: "AdminBulkActionBar",
  selection: "useAdminGridSelection",
  pagination: "AdminTablePagination",
  runtime: "useAdminBoundedClientInstantMutation",
} as const;
const blockTemplateConsumerFailures = blockTemplateLibraries?.consumerAdoptionEvidence.flatMap(
  (consumer) => {
    const failures: string[] = [];
    if (
      !blockTemplateLibraries.routes.includes(consumer.route) ||
      !blockTemplateLibraries.pageSourceFiles.includes(
        consumer.pageSourceFile,
      ) ||
      !existsSync(join(ROOT, consumer.pageSourceFile)) ||
      !existsSync(join(ROOT, consumer.presentationOwner))
    ) {
      failures.push(`${consumer.id}:source_ownership`);
      return failures;
    }
    const source = `${read(consumer.pageSourceFile)}\n${read(consumer.presentationOwner)}`;
    for (const contract of blockTemplateConsumerContracts) {
      const state = consumer.contracts[contract];
      if (!state) {
        failures.push(`${consumer.id}:${contract}:missing_claim`);
        continue;
      }
      if (contract === "data_registry") {
        if (state !== "not_required") failures.push(`${consumer.id}:${contract}:false_claim`);
        continue;
      }
      if (state !== "adopted" || !source.includes(blockTemplateContractTokens[contract])) {
        failures.push(`${consumer.id}:${contract}:missing_evidence`);
      }
    }
    if (consumer.requiredAdoption.length > 0) {
      failures.push(`${consumer.id}:partial_adoption`);
    }
    return failures;
  }) ?? ["block-template-libraries:missing_surface"];
check(
  "each Block Template library proves its own Collection capabilities instead of inheriting a grouped claim",
  blockTemplateLibraries?.consumerAdoptionEvidence.length === 8 &&
    sameValueSet(
      blockTemplateLibraries.consumerAdoptionEvidence.map(
        (consumer) => consumer.route,
      ),
      blockTemplateLibraries.routes,
    ) &&
    blockTemplateConsumerFailures.length === 0,
);
check(
  "every generic list primitive, top-level card catalog, and mapped command queue is classified exactly once",
  scannedCollectionPresentationSources.every(
    (sourceFile) => presentationSourceCounts.get(sourceFile) === 1,
  ),
);
check(
  "generic inventory and Data Runtime registry cover the same consumers",
  sameValueSet(
    collectionSurfaces
      .filter((surface) => surface.generic)
      .flatMap((surface) => surface.dataRegistryEntities),
    registryEntities,
  ),
);
check(
  "generic headers render their declared uppercase Engine Label and no fourth context line remains",
  collectionSurfaces
    .filter((surface) => surface.generic)
    .every((surface) => {
      const source = [
        ...surface.pageSourceFiles,
        ...surface.presentationSourceFiles,
      ]
        .map(read)
        .join("\n");
      return source.includes(`eyebrow="${surface.engineLabel}"`);
    }) &&
    !collectTsxFiles(join(ROOT, "src")).some((sourceFile) =>
      readFileSync(sourceFile, "utf8").includes("contextLine"),
    ) &&
    !read(paths.pageHeader).includes("contextLine") &&
    read(paths.shell).includes(
      'className="flex min-w-0 flex-1 flex-col gap-7 px-4 py-4 sm:px-6 lg:px-7"',
    ) &&
    !read(paths.shell).includes("admin-premium-card mb-5"),
);

const fullAdoptionSurfaces = collectionSurfaces.filter(
  (surface) => surface.workflowClassification === "full_collection_adoption",
);
const partialAdoptionSurfaces = collectionSurfaces.filter(
  (surface) => surface.workflowClassification === "partial_collection_adoption",
);
const fullAdoptionClaims: readonly AdminCollectionFullAdoptionClaim[] =
  ADMIN_COLLECTION_FULL_ADOPTION_CLAIMS;

function hasExactFullAdoptionClaimCoverage(
  surfaces: readonly AdminCollectionSurfaceInventoryEntry[],
  claims: readonly AdminCollectionFullAdoptionClaim[],
) {
  const surfaceIds = surfaces.map((surface) => surface.id);
  const claimIds = claims.map((claim) => claim.surfaceId);
  return (
    sameValueSet(surfaceIds, claimIds) &&
    new Set(claimIds).size === claimIds.length
  );
}

function collectFullAdoptionContractFailures(
  surface: AdminCollectionSurfaceInventoryEntry,
  claim: AdminCollectionFullAdoptionClaim,
  options: {
    source?: string;
    registryEntities?: readonly string[];
    sourceOverrides?: CollectionSourceOverrides;
  } = {},
) {
  const failures: string[] = [];
  const sourceGraph = collectCollectionSourceGraph(
    surface,
    options.sourceOverrides,
  );
  const source =
    options.source ??
    [...surface.pageSourceFiles, ...surface.presentationSourceFiles]
      .map(read)
      .join("\n");
  const registeredEntities = options.registryEntities ?? registryEntities;
  const contractIds = Object.keys(claim.contracts);

  if (
    claim.surfaceId !== surface.id ||
    surface.workflowClassification !== "full_collection_adoption"
  ) {
    failures.push("false_full_adoption");
  }

  if (
    !sameValueSet(
      contractIds,
      ADMIN_COLLECTION_FULL_ADOPTION_REQUIRED_CONTRACTS,
    )
  ) {
    failures.push("manifest_contract_axes");
  }

  for (const requiredContract of [
    "collection",
    "table",
    "toolbar",
    "header",
    "columns",
    "runtime",
    "data_registry",
  ] as const) {
    if (claim.contracts[requiredContract] !== "adopted") {
      failures.push(requiredContract);
    }
  }

  if (
    surface.collectionAdoption !== "adopted" ||
    !source.includes("AdminEntityListSurface") ||
    !source.includes("AdminEntityListTableRegion")
  ) {
    failures.push("collection");
  }

  if (
    surface.gridOwner !== "AdminEntityList" ||
    !/<AdminEntityList(?:\s|<)/u.test(source)
  ) {
    failures.push("table");
  }

  if (!surface.filtersOrToolbar || !source.includes("toolbar=")) {
    failures.push("toolbar");
  }

  if (
    surface.pageChromeAdoption !== "adopted" ||
    surface.headerOwner !== "AdminPageContextHeader" ||
    surface.headerState !== "adopted" ||
    typeof surface.engineLabel !== "string" ||
    (!source.includes("AdminPageContextHeader") &&
      !source.includes("AdminPageHeader")) ||
    !source.includes(`eyebrow="${surface.engineLabel}"`)
  ) {
    failures.push("header");
  }

  if (
    surface.columnVisibility !== "shared_optional_columns" ||
    !source.includes("columns=") ||
    !source.includes("enableColumnManagement") ||
    !source.includes("onPersistColumns=") ||
    !evidenceGraphCallsCanonicalImport(
      sourceGraph,
      "saveAdminColumnPreferences",
      CANONICAL_COLUMN_PREFERENCES_OWNER,
    ) ||
    !evidenceGraphUsesPrimaryColumnPreset(sourceGraph)
  ) {
    failures.push("columns");
  }

  if (claim.contracts.sort === "adopted") {
    if (!source.includes("sortMode=") || source.includes("sort={null}")) {
      failures.push("sort");
    }
  } else if (
    claim.contracts.sort !== "not_required" ||
    !source.includes("sort={null}") ||
    source.includes("sortable: true")
  ) {
    failures.push("sort");
  }

  if (claim.contracts.row_actions === "adopted") {
    if (
      surface.rowActionsState !== "adopted" ||
      surface.rowActionsOwner !== "shared_admin_row_actions" ||
      !surface.dataRegistryEntities.every((entity) =>
        manifestEntitySet.has(entity),
      )
    ) {
      failures.push("row_actions");
    }
  } else if (
    claim.contracts.row_actions !== "not_required" ||
    surface.rowActionsState !== "read_only_no_row_commands" ||
    surface.rowActionsOwner !== "not_applicable" ||
    surface.dataRegistryEntities.some((entity) => manifestEntitySet.has(entity))
  ) {
    failures.push("row_actions");
  }

  if (claim.contracts.bulk === "adopted") {
    if (
      !source.includes("bulkOptions=") ||
      !source.includes("onBulkExecute=") ||
      !source.includes("getBulkConfirmation=") ||
      source.includes("enableSelection={false}") ||
      !evidenceGraphHasJsxAttribute(
        sourceGraph,
        "AdminEntityList",
        "bulkInteraction",
      ) ||
      !evidenceGraphCallsCanonicalImport(
        sourceGraph,
        "useAdminEntityInstantMutation",
        CANONICAL_DATA_RUNTIME_OWNER,
      ) ||
      !evidenceGraphUsesBulkMutationLifecycle(sourceGraph) ||
      evidenceGraphHasLocalBulkLifecycleOwner(sourceGraph)
    ) {
      failures.push("bulk");
    }
  } else if (
    claim.contracts.bulk !== "not_required" ||
    !source.includes("enableSelection={false}") ||
    source.includes("bulkOptions=") ||
    source.includes("onBulkExecute=") ||
    source.includes("getBulkConfirmation=") ||
    evidenceGraphHasJsxAttribute(
      sourceGraph,
      "AdminEntityList",
      "bulkInteraction",
    )
  ) {
    failures.push("bulk");
  }

  if (
    surface.queryMode !== "server-page" ||
    !evidenceGraphCallsCanonicalImport(
      sourceGraph,
      "useAdminEntityListController",
      CANONICAL_QUERY_RUNTIME_OWNER,
    ) ||
    surface.paginationState !== "adopted" ||
    surface.paginationOwner !== "AdminTablePagination"
  ) {
    failures.push("runtime");
  }

  if (
    surface.dataRegistryEntities.length === 0 ||
    new Set(surface.dataRegistryEntities).size !==
      surface.dataRegistryEntities.length ||
    !surface.dataRegistryEntities.every((entity) =>
      registeredEntities.includes(entity),
    )
  ) {
    failures.push("data_registry");
  }

  if (
    surface.requiredAdoption.length > 0 ||
    surface.exceptionRationale !== null
  ) {
    failures.push("unresolved_adoption");
  }

  return [...new Set(failures)];
}

check(
  "Full Adoption classifications and executable claims have exact one-to-one coverage",
  hasExactFullAdoptionClaimCoverage(fullAdoptionSurfaces, fullAdoptionClaims) &&
    fullAdoptionClaims.every((claim) =>
      fullAdoptionSurfaces.some((surface) => surface.id === claim.surfaceId),
    ),
);

const fullAdoptionContractFailures = fullAdoptionClaims.flatMap((claim) => {
  const surface = fullAdoptionSurfaces.find(
    (candidate) => candidate.id === claim.surfaceId,
  );
  if (!surface) return [`${claim.surfaceId}:missing_surface`];
  return collectFullAdoptionContractFailures(surface, claim).map(
    (contract) => `${claim.surfaceId}:${contract}`,
  );
});

const collectionRuntimeOwnerGraph = new Map([
  [CANONICAL_COLLECTION_OWNER, read(CANONICAL_COLLECTION_OWNER)],
]);
check(
  "Collection Runtime owns Bulk selection and presentation but delegates the execution lifecycle to Data Runtime",
  !evidenceGraphHasLocalBulkLifecycleOwner(collectionRuntimeOwnerGraph) &&
    read(CANONICAL_COLLECTION_OWNER).includes(
      "AdminEntityListBulkExecutionProps",
    ) &&
    read(CANONICAL_COLLECTION_OWNER).includes(
      "bulkInteraction: AdminInstantMutationBulkInteraction",
    ) &&
    read(CANONICAL_COLLECTION_OWNER).includes("bulkInteraction.isBlocked"),
);
const specializedBulkConsumerSources = collectTsxFiles(join(ROOT, "src"))
  .map(relativeSourceFile)
  .filter(
    (sourceFile) =>
      sourceFile !== CANONICAL_COLLECTION_OWNER &&
      read(sourceFile).includes("<AdminBulkActionBar"),
  );
const specializedBulkConsumerFailures = specializedBulkConsumerSources.filter(
  (sourceFile) => {
    const sourceGraph = collectSourceGraph([sourceFile]);
    return (
      !read(sourceFile).includes("instant.bulkInteraction.isBlocked") ||
      !evidenceGraphCallsCanonicalImport(
        sourceGraph,
        "useAdminBoundedClientInstantMutation",
        CANONICAL_DATA_RUNTIME_OWNER,
      ) ||
      !evidenceGraphDeclaresBulkMutationScope(sourceGraph) ||
      evidenceGraphHasLocalBulkLifecycleOwner(sourceGraph)
    );
  },
);
check(
  "every specialized Bulk presentation delegates pending, blocking, snapshot, rollback, reconciliation, and invalidation to Data Runtime",
  specializedBulkConsumerSources.length > 0 &&
    specializedBulkConsumerFailures.length === 0,
);

check(
  "every Full Adoption claim proves Collection, Table, Toolbar, Header, Columns, Sort, Row Actions, Bulk, Runtime, and Data Registry contracts",
  fullAdoptionContractFailures.length === 0,
);
check(
  "partial generic adopters cannot publish a Full Adoption claim",
  partialAdoptionSurfaces.every(
      (surface) =>
        surface.generic &&
        surface.collectionAdoption === "adopted" &&
        surface.requiredAdoption.length > 0 &&
        surface.exceptionRationale !== null &&
        !fullAdoptionClaims.some((claim) => claim.surfaceId === surface.id),
    ) &&
    collectionSurfaces
      .filter((surface) => surface.generic)
      .every((surface) =>
        ["full_collection_adoption", "partial_collection_adoption"].includes(
          surface.workflowClassification,
        ),
      ),
);

const fullAdoptionFailureClaim = fullAdoptionClaims.find(
  (claim) => claim.contracts.bulk === "not_required",
);
const fullAdoptionFailureFixture = fullAdoptionSurfaces.find(
  (surface) => surface.id === fullAdoptionFailureClaim?.surfaceId,
);
assert.ok(fullAdoptionFailureFixture && fullAdoptionFailureClaim);
const fullAdoptionFailureSource = [
  ...fullAdoptionFailureFixture.pageSourceFiles,
  ...fullAdoptionFailureFixture.presentationSourceFiles,
]
  .map(read)
  .join("\n");

check(
  "failure path rejects a Full Adoption claim with missing Toolbar evidence",
  collectFullAdoptionContractFailures(
    fullAdoptionFailureFixture,
    fullAdoptionFailureClaim,
    { source: fullAdoptionFailureSource.replaceAll("toolbar=", "toolbarGap=") },
  ).includes("toolbar"),
);
check(
  "failure path rejects a Full Adoption claim with missing Column evidence",
  collectFullAdoptionContractFailures(
    fullAdoptionFailureFixture,
    fullAdoptionFailureClaim,
    {
      source: fullAdoptionFailureSource.replaceAll(
        "enableColumnManagement",
        "columnManagementGap",
      ),
    },
  ).includes("columns"),
);
check(
  "failure path rejects a Full Adoption claim with Data Registry drift",
  collectFullAdoptionContractFailures(
    fullAdoptionFailureFixture,
    fullAdoptionFailureClaim,
    {
      registryEntities: registryEntities.filter(
        (entity) => entity !== fullAdoptionFailureFixture.dataRegistryEntities[0],
      ),
    },
  ).includes("data_registry"),
);
check(
  "failure path rejects a false shared Bulk contract claim",
  collectFullAdoptionContractFailures(fullAdoptionFailureFixture, {
    ...fullAdoptionFailureClaim,
    contracts: {
      ...fullAdoptionFailureClaim.contracts,
      bulk: "adopted",
    },
  }).includes("bulk"),
);
check(
  "failure path rejects Manifest drift when a Full Adoption claim is missing",
  !hasExactFullAdoptionClaimCoverage(
    fullAdoptionSurfaces,
    fullAdoptionClaims.filter(
      (claim) => claim.surfaceId !== fullAdoptionFailureClaim.surfaceId,
    ),
  ),
);

const bulkAdoptionFailureClaim = fullAdoptionClaims.find(
  (claim) => claim.contracts.bulk === "adopted",
);
const bulkAdoptionFailureFixture = fullAdoptionSurfaces.find(
  (surface) => surface.id === bulkAdoptionFailureClaim?.surfaceId,
);
assert.ok(bulkAdoptionFailureFixture && bulkAdoptionFailureClaim);
const bulkAdoptionSourceGraph = collectCollectionSourceGraph(
  bulkAdoptionFailureFixture,
);
const localBulkOwnerSourceFile =
  bulkAdoptionFailureFixture.presentationSourceFiles[0];
const localBulkOwnerOverrides = new Map<string, string>([
  ...bulkAdoptionSourceGraph,
]);
localBulkOwnerOverrides.set(
  localBulkOwnerSourceFile,
  `${localBulkOwnerOverrides.get(localBulkOwnerSourceFile)}\nfunction LocalBulkOwnerFixture() { const [bulkPending] = useState(false); return bulkPending; }`,
);
check(
  "failure path rejects a local Bulk lifecycle owner",
  collectFullAdoptionContractFailures(
    bulkAdoptionFailureFixture,
    bulkAdoptionFailureClaim,
    { sourceOverrides: localBulkOwnerOverrides },
  ).includes("bulk"),
);

const directBulkBypassOverrides = new Map(
  [...bulkAdoptionSourceGraph].map(([sourceFile, source]) => [
    sourceFile,
    source.replaceAll("bulk: true", "bulk: false"),
  ]),
);
check(
  "failure path rejects a direct Bulk lifecycle bypass",
  collectFullAdoptionContractFailures(
    bulkAdoptionFailureFixture,
    bulkAdoptionFailureClaim,
    { sourceOverrides: directBulkBypassOverrides },
  ).includes("bulk"),
);

const columnPreferenceSourceGraph = collectCollectionSourceGraph(
  fullAdoptionFailureFixture,
);
const localColumnPreferenceOverrides = new Map(
  [...columnPreferenceSourceGraph].map(([sourceFile, source]) => [
    sourceFile,
    source.replaceAll(
      "saveAdminColumnPreferences",
      "saveLocalColumnPreferences",
    ),
  ]),
);
check(
  "failure path rejects a local Column Preferences owner",
  collectFullAdoptionContractFailures(
    fullAdoptionFailureFixture,
    fullAdoptionFailureClaim,
    { sourceOverrides: localColumnPreferenceOverrides },
  ).includes("columns"),
);

const localRuntimeOverrides = new Map(
  [...columnPreferenceSourceGraph].map(([sourceFile, source]) => [
    sourceFile,
    source.replaceAll(
      "useAdminEntityListController",
      "useLocalEntityListController",
    ),
  ]),
);
check(
  "failure path rejects a local Collection query Runtime owner",
  collectFullAdoptionContractFailures(
    fullAdoptionFailureFixture,
    fullAdoptionFailureClaim,
    { sourceOverrides: localRuntimeOverrides },
  ).includes("runtime"),
);

check(
  "failure path rejects a false Full Adoption claim for another surface",
  collectFullAdoptionContractFailures(fullAdoptionFailureFixture, {
    ...fullAdoptionFailureClaim,
    surfaceId: "false-full-adoption-fixture",
  }).includes("false_full_adoption"),
);
const genericClassificationFailureFixture = fullAdoptionSurfaces[0];
assert.ok(genericClassificationFailureFixture);
const genericClassificationFailureSource = readCollectionSurfaceEvidence(
  genericClassificationFailureFixture,
);
check(
  "failure path rejects an AdminEntityList consumer disguised as an explicit exception",
  collectCollectionSurfaceComplianceFailures(
    {
      ...genericClassificationFailureFixture,
      workflowClassification: "page_system_only",
      generic: false,
      collectionAdoption: "not_applicable",
      gridOwner: "not_applicable",
      dataRegistryEntities: [],
      paginationState: "not_required",
      paginationOwner: "not_applicable",
      queryMode: "specialized",
    },
    genericClassificationFailureSource,
  ).includes("generic_collection_misclassified_as_exception"),
);

const specializedClassificationFailureFixture = collectionSurfaces.find(
  (surface) =>
    surface.workflowClassification ===
      "specialized_data_owner_shared_collection_presentation" &&
    surface.gridOwner === "AdminDataGrid" &&
    surface.queryMode === "bounded-client" &&
    surface.columnVisibility === "shared_optional_columns" &&
    surface.rowActionsState === "adopted",
);
assert.ok(specializedClassificationFailureFixture);
const specializedClassificationFailureSource = readCollectionSurfaceEvidence(
  specializedClassificationFailureFixture,
);
check(
  "failure path rejects Specialized Adoption without shared Grid evidence",
  collectCollectionSurfaceComplianceFailures(
    specializedClassificationFailureFixture,
    specializedClassificationFailureSource.replaceAll(
      "<AdminDataGrid",
      "<MissingAdminDataGrid",
    ),
  ).includes("specialized_grid_evidence"),
);
check(
  "failure path rejects Specialized Adoption without bounded-client Runtime evidence",
  collectCollectionSurfaceComplianceFailures(
    specializedClassificationFailureFixture,
    specializedClassificationFailureSource.replaceAll(
      "useAdminBoundedClientPagination",
      "missingBoundedClientPagination",
    ),
  ).includes("specialized_query_contract"),
);
check(
  "failure path rejects Specialized Adoption without shared Toolbar evidence",
  collectCollectionSurfaceComplianceFailures(
    specializedClassificationFailureFixture,
    specializedClassificationFailureSource.replaceAll(
      "AdminEntityListFilters",
      "MissingEntityListFilters",
    ),
  ).includes("specialized_toolbar_contract"),
);
check(
  "failure path rejects Specialized Adoption without shared Columns evidence",
  collectCollectionSurfaceComplianceFailures(
    specializedClassificationFailureFixture,
    specializedClassificationFailureSource.replaceAll(
      "AdminColumnVisibilityMenu",
      "MissingColumnVisibilityMenu",
    ),
  ).includes("specialized_columns_contract"),
);
check(
  "failure path rejects Specialized Adoption without shared Row Actions evidence",
  collectCollectionSurfaceComplianceFailures(
    specializedClassificationFailureFixture,
    specializedClassificationFailureSource.replaceAll(
      "AdminDataGridRowActions",
      "MissingDataGridRowActions",
    ),
  ).includes("specialized_row_actions_contract"),
);
check(
  "failure path rejects Specialized Adoption without shared Pagination evidence",
  collectCollectionSurfaceComplianceFailures(
    specializedClassificationFailureFixture,
    specializedClassificationFailureSource.replaceAll(
      "AdminTablePagination",
      "MissingTablePagination",
    ),
  ).includes("specialized_pagination_contract"),
);

const explicitExceptionFailureFixture = collectionSurfaces.find(
  (surface) =>
    surface.workflowClassification === "fixed_structure_not_paginated",
);
assert.ok(explicitExceptionFailureFixture);
check(
  "failure path rejects an explicit fixed-structure exception without architectural evidence",
  collectCollectionSurfaceComplianceFailures({
    ...explicitExceptionFailureFixture,
    genuineExceptions: [],
    exceptionRationale: null,
  }).includes("fixed_structure_exception_contract"),
);
check(
  "dashboard, card catalog, report, and recovery inventory states match their concrete commands",
  collectionSurfaces.find(
    (surface) => surface.id === "dashboard-recent-content",
  )?.sourceOwner ===
    "src/lib/admin/dashboard/load-admin-dashboard.ts#loadAdminDashboard" &&
    collectionSurfaces
      .find((surface) => surface.id === "dashboard-recent-content")
      ?.presentationSourceFiles.includes(
        "src/components/admin/dashboard/AdminDashboardView.tsx",
      ) &&
    collectionSurfaces.find(
      (surface) => surface.id === "dashboard-recent-content",
    )?.workflowClassification === "fixed_structure_not_paginated" &&
    collectionSurfaces.find(
      (surface) => surface.id === "dashboard-recent-content",
    )?.rowActionsState === "not_applicable" &&
    collectionSurfaces
      .find((surface) => surface.id === "blocks-library-hub")
      ?.presentationSourceFiles.includes(
        "src/app/admin/pages-blocks/blocks/page.tsx",
      ) &&
    collectionSurfaces.find(
      (surface) => surface.id === "topics-without-image-report",
    )?.rowActionsState === "adopted" &&
    manifestEntities.includes("topics_without_image") &&
    collectionSurfaces.find((surface) => surface.id === "media-recovery-queue")
      ?.presentationSourceFiles.includes(paths.mediaRecovery) &&
    collectionSurfaces.find((surface) => surface.id === "media-recovery-queue")
      ?.workflowClassification === "page_system_only" &&
    collectionSurfaces.find((surface) => surface.id === "media-recovery-queue")
      ?.rowActionsState === "not_applicable",
);
check(
  "Collection global closure claim matches executable Full Adoption coverage",
  ADMIN_COLLECTION_SURFACE_ADOPTION.globalClosed ===
    (partialAdoptionSurfaces.length === 0 &&
      fullAdoptionContractFailures.length === 0) &&
    closureStateIsConsistent(
      ADMIN_COLLECTION_SURFACE_ADOPTION.globalClosed,
      ADMIN_COLLECTION_SURFACE_ADOPTION.globalClosureBlockers,
    ) &&
    adoptionGapStateIsConsistent(
      ADMIN_COLLECTION_SURFACE_ADOPTION.globalClosed,
      ADMIN_COLLECTION_SURFACE_ADOPTION.genericAdoptionGaps,
      partialAdoptionSurfaces.length,
    ),
);
check(
  "Project Residential and Commercial routes share one consumer and action declaration",
  collectionSurfaces
    .find((surface) => surface.id === "projects-residential-commercial")
    ?.routes.join("|") ===
    "/admin/projects/residential|/admin/projects/commercial" &&
    collectionSurfaces
      .find((surface) => surface.id === "projects-residential-commercial")
      ?.presentationSourceFiles.join("|") === paths.projectsList &&
    projectsColumnsSource.includes("copyPublicLink:") &&
    projectsColumnsSource.includes("visibility:") &&
    projectsColumnsSource.includes("onVisibility") &&
    projectsColumnsSource.includes("onToggleFeatured") &&
    projectsColumnsSource.includes("onDuplicate") &&
    projectsColumnsSource.includes('archive: { access: "hidden" }'),
);

check(
  "primary header/body de-stick at and below 640px only",
  (entityListTableSource.match(/max-\[640px\]:static/g)?.length ?? 0) >= 2 &&
    (entityListTableSource.match(/min-\[641px\]:sticky/g)?.length ?? 0) >= 2 &&
    !entityListTableSource.includes("max-sm:static"),
);
check(
  "checkbox and actions remain logical-edge sticky while primary de-sticks",
  entityListTableSource.includes("sticky start-0") &&
    dataGridSource.includes(
      'data-admin-grid-sticky={sticky ? "inline-start"',
    ) &&
    dataGridSource.includes('data-admin-grid-sticky="inline-end"') &&
    dataGridSource.includes("sticky end-0"),
);

check(
  "Information and More use separate initial height estimates",
  rendererSource.includes("ROW_ACTION_MENU_ESTIMATED_HEIGHT") &&
    rendererSource.includes("ROW_ACTION_INFORMATION_ESTIMATED_HEIGHT") &&
    /panelView\s*===\s*["']information["'][\s\S]{0,160}?ROW_ACTION_INFORMATION_ESTIMATED_HEIGHT[\s\S]{0,120}?ROW_ACTION_MENU_ESTIMATED_HEIGHT/.test(
      rendererSource,
    ),
);
check(
  "specialized collection presentation and fixed surfaces declare pagination truthfully",
  collectionSurfaces.find((surface) => surface.id === "media-library")
    ?.workflowClassification ===
      "specialized_data_owner_shared_collection_presentation" &&
    collectionSurfaces.find((surface) => surface.id === "media-library")
      ?.paginationState === "adopted" &&
    collectionSurfaces.find((surface) => surface.id === "media-library")
      ?.paginationOwner === "AdminTablePagination" &&
    collectionSurfaces.find((surface) => surface.id === "media-library")
      ?.queryMode === "specialized" &&
    collectionSurfaces.find((surface) => surface.id === "projects-hub")
      ?.queryMode === "small-fixed" &&
    collectionSurfaces.find(
      (surface) => surface.id === "dashboard-recent-content",
    )?.paginationState === "not_required" &&
    collectionSurfaces.find(
      (surface) => surface.id === "topics-without-image-report",
    )?.paginationOwner === "AdminTablePagination",
);
check(
  "nested eligible collections are separate from their specialized page shells",
  [
    "page-composition-shell",
    "page-block-assignments",
    "menu-editor-shell",
    "menu-items",
    "footer-builder-shell",
    "footer-fixed-slots",
    "footer-manual-links",
    "block-template-libraries",
    "block-template-editors",
  ].every((surfaceId) =>
    collectionSurfaces.some((surface) => surface.id === surfaceId),
  ) &&
    ["page-block-assignments", "menu-items", "footer-manual-links"].every(
      (surfaceId) => {
        const surface = collectionSurfaces.find(
          (candidate) => candidate.id === surfaceId,
        );
        return (
          surface?.collectionAdoption === "adopted" &&
          surface.rowActionsOwner === "shared_admin_row_actions" &&
          surface.paginationOwner === "AdminTablePagination"
        );
      },
    ),
);
check(
  "persisted reorder surfaces delegate to their atomic domain contracts",
  ["page-block-assignments", "menu-items"].every((surfaceId) => {
    const surface = collectionSurfaces.find(
      (candidate) => candidate.id === surfaceId,
    );
    return (
      surface?.reorderOwner === "domain_owned_atomic_reorder" &&
      surface.requiredAdoption.length === 0 &&
      surface.genuineExceptions.length === 0
    );
  }) &&
    collectionSurfaces.find((surface) => surface.id === "footer-manual-links")
      ?.reorderOwner === "domain_owned_atomic_reorder",
);
const pageAssignmentsSource = read(paths.pageAssignments);
const pageAssignmentsGridSource = read(paths.pageAssignmentsGrid);
const menuItemsSource = read(paths.menuItems);
const pageReorderPath = join(
  ROOT,
  "src/app/admin/pages-blocks/pages/page-actions/assignment-reorder.ts",
);
const menuReorderPath = join(
  ROOT,
  "src/app/admin/pages-blocks/menus/menu-actions/reorder.ts",
);
const pageReorderSource = readFileSync(pageReorderPath, "utf8");
const menuReorderSource = readFileSync(menuReorderPath, "utf8");
check(
  "Page and Menu reorder expose only their atomic aggregate mutation paths",
  !existsSync(
    join(
      ROOT,
      "src/app/admin/pages-blocks/pages/[id]/page-blocks/use-page-blocks-reorder.ts",
    ),
  ) &&
    existsSync(
      join(
        ROOT,
        "src/app/admin/pages-blocks/pages/page-actions/assignment-reorder.ts",
      ),
    ) &&
    existsSync(
      join(ROOT, "src/app/admin/pages-blocks/menus/menu-actions/reorder.ts"),
    ) &&
    pageReorderSource.includes('mutatePageComposition(pageId, "reorder"') &&
    menuReorderSource.includes('mutateMenuTree(menuId, "reorder"') &&
    [pageReorderSource, menuReorderSource].every(
      (source) =>
        !source.includes("getSupabaseAdmin") &&
        !source.includes(".from(") &&
        !source.includes("Promise.all"),
    ) &&
    pageAssignmentsSource.includes("reorderPageComposition(") &&
    menuItemsSource.includes("reorderMenuItems(") &&
    !menuItemsSource.includes("moveMenuItemSortOrder") &&
    !menuItemsSource.includes("requestSubmit") &&
    !read(paths.pageActions).includes("movePageBlockAssignment") &&
    !read(paths.pageActionIndex).includes("movePageBlockAssignment") &&
    !read(paths.menuActions).includes("moveMenuItemSortOrder") &&
    !read(paths.menuActionIndex).includes("moveMenuItemSortOrder") &&
    read(paths.pageActions).includes("reorderPageComposition") &&
    read(paths.pageActionIndex).includes("reorderPageComposition") &&
    read(paths.menuActions).includes("reorderMenuItems") &&
    read(paths.menuActionIndex).includes("reorderMenuItems"),
);
check(
  "Page Assignments adopts the shared bounded-client URL/history owner",
  collectionSurfaces.find((surface) => surface.id === "page-block-assignments")
    ?.queryMode === "bounded-client" &&
    pageAssignmentsSource.includes("useAdminBoundedClientPagination") &&
    pageAssignmentsSource.includes('mode: "bounded-client"') &&
    pageAssignmentsSource.includes("queryContract") &&
    pageAssignmentsSource.includes(
      "onQueryPatch={pagination.applyQueryPatch}",
    ) &&
    pageAssignmentsSource.includes("pagination.resetPage()") &&
    !pageAssignmentsGridSource.includes("summary={`${totalCount}") &&
    pageAssignmentsSource.includes("totalCount={pagination.totalCount}") &&
    !pageAssignmentsSource.includes("useSearchParams") &&
    !pageAssignmentsSource.includes("applyAdminEntityUrlPatch") &&
    !pageAssignmentsSource.includes("window.history") &&
    !pageAssignmentsSource.includes("const [currentPage") &&
    !pageAssignmentsSource.includes("Math.ceil(table.rows.length") &&
    !pageAssignmentsSource.includes("table.rows.slice(") &&
    read(paths.boundedPagination).includes("useSearchParams") &&
    read(paths.boundedPagination).includes("queryContract.matchesRow") &&
    read(paths.boundedPagination).includes(
      "const applyQueryPatch = useCallback",
    ) &&
    read(paths.boundedPagination).includes(
      'behavior === "replace" ? "replaceState" : "pushState"',
    ) &&
    read(paths.boundedPagination).includes("previousDatasetKey"),
);

const syntheticAssignmentRows = Array.from(
  { length: 23 },
  (_, index) => `assignment-${index + 1}`,
);
const initialAssignmentParams = new URLSearchParams(
  "tab=modules&seo_notice=saved&page=2",
);
const initialAssignmentPagination = resolveClientPagination(
  syntheticAssignmentRows.length,
  initialAssignmentParams.get("page"),
  initialAssignmentParams.get("limit"),
);
const nextAssignmentParams = writeAdminBoundedClientPaginationParams(
  initialAssignmentParams,
  { page: 3, pageSize: initialAssignmentPagination.pageSize },
);
const previousAssignmentParams = writeAdminBoundedClientPaginationParams(
  nextAssignmentParams,
  { page: 2, pageSize: initialAssignmentPagination.pageSize },
);
const resizedAssignmentParams = writeAdminBoundedClientPaginationParams(
  previousAssignmentParams,
  { page: 1, pageSize: 20 },
);
const assignmentHistory = [
  initialAssignmentParams.toString(),
  nextAssignmentParams.toString(),
  previousAssignmentParams.toString(),
  resizedAssignmentParams.toString(),
];
const backAssignmentParams = new URLSearchParams(assignmentHistory.at(-2));
const forwardAssignmentParams = new URLSearchParams(assignmentHistory.at(-1));
const nextAssignmentPagination = resolveClientPagination(
  syntheticAssignmentRows.length,
  nextAssignmentParams.get("page"),
  nextAssignmentParams.get("limit"),
);
const previousAssignmentPagination = resolveClientPagination(
  syntheticAssignmentRows.length,
  previousAssignmentParams.get("page"),
  previousAssignmentParams.get("limit"),
);
const resizedAssignmentPagination = resolveClientPagination(
  syntheticAssignmentRows.length,
  resizedAssignmentParams.get("page"),
  resizedAssignmentParams.get("limit"),
);
const backAssignmentPagination = resolveClientPagination(
  syntheticAssignmentRows.length,
  backAssignmentParams.get("page"),
  backAssignmentParams.get("limit"),
);
const forwardAssignmentPagination = resolveClientPagination(
  syntheticAssignmentRows.length,
  forwardAssignmentParams.get("page"),
  forwardAssignmentParams.get("limit"),
);
check(
  "bounded-client pagination changes next/previous/size rows and restores Back/Forward state",
  initialAssignmentPagination.page === 2 &&
    initialAssignmentPagination.pageSize === 10 &&
    sameOrderedValues(
      slicePageRows(
        syntheticAssignmentRows,
        initialAssignmentPagination.page,
        initialAssignmentPagination.pageSize,
      ),
      syntheticAssignmentRows.slice(10, 20),
    ) &&
    nextAssignmentParams.get("page") === "3" &&
    sameOrderedValues(
      slicePageRows(
        syntheticAssignmentRows,
        nextAssignmentPagination.page,
        nextAssignmentPagination.pageSize,
      ),
      syntheticAssignmentRows.slice(20, 23),
    ) &&
    previousAssignmentParams.get("page") === "2" &&
    sameOrderedValues(
      slicePageRows(
        syntheticAssignmentRows,
        previousAssignmentPagination.page,
        previousAssignmentPagination.pageSize,
      ),
      syntheticAssignmentRows.slice(10, 20),
    ) &&
    resizedAssignmentParams.get("page") === null &&
    resizedAssignmentParams.get("limit") === "20" &&
    sameOrderedValues(
      slicePageRows(
        syntheticAssignmentRows,
        resizedAssignmentPagination.page,
        resizedAssignmentPagination.pageSize,
      ),
      syntheticAssignmentRows.slice(0, 20),
    ) &&
    backAssignmentPagination.page === 2 &&
    backAssignmentPagination.pageSize === 10 &&
    forwardAssignmentPagination.page === 1 &&
    forwardAssignmentPagination.pageSize === 20 &&
    resizedAssignmentParams.get("tab") === "modules" &&
    resizedAssignmentParams.get("seo_notice") === "saved",
);
check(
  "shared Pagination delegates range and URL math without owning Busy state",
  read(paths.pagination).includes("computePageRange") &&
    read(paths.pagination).includes("buildAdminEntityListHref") &&
    read(paths.pagination).includes(
      'data-admin-table-pagination-busy="false"',
    ) &&
    !read(paths.pagination).includes("pending?: boolean") &&
    !read(paths.pagination).includes("disabled={pending") &&
    !read(paths.pagination).includes("aria-busy={pending}"),
);
check(
  "AdminDataGrid owns one compact full-height divided cell surface for every Block Library family",
  read(paths.dataGrid).includes("ADMIN_DATA_GRID_BODY_ROW_CELL_CLASSES") &&
    read(paths.dataGrid).includes("[&>*]:self-stretch") &&
    read(paths.dataGrid).includes("[&>*]:px-1.5") &&
    read(paths.dataGrid).includes("[&>*+*]:border-s") &&
    read(paths.dataGrid).includes("columnGap: 0") &&
    read(paths.renderer).includes("sticky = false") &&
    [
      paths.blockModuleManager,
      paths.contentBlockManager,
      paths.heroBlockManager,
      paths.blockTemplateSummary,
    ].every((sourceFile) =>
      read(sourceFile).includes("ADMIN_DATA_GRID_ACTION_COLUMNS.threeCompact"),
    ),
);
const redirectsClientSource = read(paths.redirects);
const redirectsActionsSource = read(paths.redirectsActions);
const activitySource = read(paths.activityLog);
const reportSource = read(paths.topicsWithoutImage);
check(
  "new server-page adopters normalize out-of-range pages at their thin adapters",
  [
    paths.redirectsAdapter,
    paths.activityLoader,
    paths.reportAdapter,
    paths.projectsAdapter,
  ].every((sourceFile) =>
    read(sourceFile).includes("loadNormalizedAdminEntityListPage"),
  ) &&
    read(paths.dataAdapter).includes("for (let attempt = 0;") &&
    read(paths.dataAdapter).includes("page <= totalPages") &&
    read(paths.dataAdapter).includes(
      "throw new AdminEntityListPageNormalizationError",
    ),
);
check(
  "legacy collection query, URL, and pager owners are removed",
  !redirectsActionsSource.includes("listRedirects(") &&
    !redirectsActionsSource.includes("redirectWithMessage") &&
    !redirectsActionsSource.includes('from "next/navigation"') &&
    !redirectsClientSource.includes("setRows(") &&
    !read(paths.redirectsFilters).includes("useRouter") &&
    !activitySource.includes("useRouter") &&
    !activitySource.includes("listAuditLogsAction") &&
    !existsSync(join(ROOT, "src/app/admin/activity-log/actions.ts")) &&
    !reportSource.includes("pageHref") &&
    !reportSource.includes('method="get"'),
);
check(
  "new Data Runtime adopters retain visible failure paths without false empty states",
  redirectsClientSource.includes("controller.error") &&
    activitySource.includes("controller.error") &&
    reportSource.includes("controller.error") &&
    !read("src/app/admin/seo/redirects/page.tsx").includes("catch(() => [])"),
);
check(
  "Data Runtime restores visible Back and Forward state for draft-filter adopters",
  read(paths.dataController).includes('addEventListener("popstate"') &&
    activitySource.includes("controller.query") &&
    reportSource.includes("controller.query") &&
    redirectsClientSource.includes("createRedirectsCollectionToolbar") &&
    redirectsClientSource.includes("search: controller.query.search") &&
    redirectsClientSource.includes("status: controller.query.filters.status") &&
    redirectsClientSource.includes(
      "redirectType: controller.query.filters.redirectType",
    ),
);
check(
  "route-locked Project queries reapply their invariant on every transition and Back or Forward restoration",
  read(paths.dataController).includes("constrainQuery?:") &&
    read(paths.dataController).includes(
      "const resolved = applyQueryConstraint(candidate)",
    ) &&
    read(paths.dataController).includes(
      "const restored = applyQueryConstraint(normalized)",
    ) &&
    read(paths.dataController).includes("window.history.replaceState") &&
    read(paths.projectsList).includes("withLockedProjectType") &&
    read(paths.projectsList).includes("constrainQuery,"),
);
check(
  "Activity Log server pagination uses a deterministic id tie-breaker",
  read(paths.activityLoader).includes(
    '.order("created_at", { ascending: filters.sortDirection === "asc" })',
  ) &&
    read(paths.activityLoader).includes(
      '.order("id", { ascending: filters.sortDirection === "asc" })',
    ),
);
check(
  "Redirects delegates filter presentation and query state to shared owners",
  read(paths.redirectsFilters).includes("AdminEntityListFilters") &&
    read(paths.redirectsFilters).includes("onQueryPatch") &&
    !read(paths.redirectsFilters).includes("useRouter"),
);
check(
  "server-page search consumers delegate escaping to their authoritative query owners",
  [paths.redirectsAdapter, paths.activityLoader, paths.reportQuery].every(
    (sourceFile) => read(sourceFile).includes("buildAdminListSearchOrFilter"),
  ) &&
    read(paths.projectsAdapter).includes("p_search: query.search") &&
    read(paths.projectPublishing).includes("v_search_pattern") &&
    read(paths.projectPublishing).includes("ilike v_search_pattern") &&
    read(paths.adminListSearch).includes('const pattern = `"%${escaped}%"`') &&
    read(paths.adminListSearch).includes("Invalid Admin list search field") &&
    !read(paths.redirectsAdapter).includes("sanitizeRedirectSearch") &&
    !read(paths.projectsAdapter).includes("sanitizeProjectSearch"),
);
check(
  "topics-without-image adapter delegates canonical sort direction to the domain read",
  read(paths.reportAdapter).includes("sortDirection: query.sort.direction") &&
    read(paths.reportQuery).includes(
      'const ascending = input.sortDirection === "asc"',
    ) &&
    read(paths.reportQuery).includes('.order("updated_at", { ascending,'),
);
check(
  "floating position remeasures panel content and all viewport/scroll changes",
  floatingPositionSource.includes("floating.scrollHeight") &&
    floatingPositionSource.includes("ResizeObserver") &&
    floatingPositionSource.includes("observer.observe(anchor)") &&
    floatingPositionSource.includes("repositionKey") &&
    floatingPositionSource.includes(
      'window.addEventListener("scroll", updatePosition, true)',
    ) &&
    floatingPositionSource.includes(
      'window.addEventListener("resize", updatePosition)',
    ) &&
    floatingPositionSource.includes(
      'window.visualViewport?.addEventListener("resize", updatePosition)',
    ) &&
    floatingPositionSource.includes(
      'window.visualViewport?.addEventListener("scroll", updatePosition)',
    ),
);
check(
  "floating position measures the rendered border box without integer-rounding underflow",
  floatingPositionSource.includes("styles.borderTopWidth") &&
    floatingPositionSource.includes("styles.borderBottomWidth") &&
    floatingPositionSource.includes(
      "floating.getBoundingClientRect().height - floating.clientHeight",
    ) &&
    floatingPositionSource.includes(
      "Math.ceil(floating.scrollHeight + boxAdjustment)",
    ) &&
    !floatingPositionSource.includes(
      "floating.offsetHeight - floating.clientHeight",
    ),
);
check(
  "Information slides fully inside the viewport before enabling one panel scroll",
  floatingPositionSource.includes("requestedHeight <= viewportHeight") &&
    floatingPositionSource.includes("maxHeight: requestedHeight") &&
    floatingPositionSource.includes("const top = clamp(") &&
    floatingPositionSource.includes("const bottom = clamp(") &&
    floatingPositionSource.includes("top: viewportPadding") &&
    floatingPositionSource.includes("maxHeight: viewportHeight"),
);
check(
  "floating position closes safely when its anchor is no longer renderable",
  floatingPositionSource.includes("!anchor.isConnected") &&
    floatingPositionSource.includes("anchor.getClientRects().length === 0") &&
    floatingPositionSource.includes("onAnchorInvalid?.()") &&
    floatingPositionSource.includes("new MutationObserver") &&
    rendererSource.includes("onAnchorInvalid: closeAndReturnFocus"),
);
check(
  "Information uses the system scrollbar and prevents page scroll chaining",
  rendererSource.includes("ADMIN_SCROLLBAR_VISUAL_CLASSES") &&
    rendererSource.includes("overscroll-contain") &&
    rendererSource.includes('document.body.style.overflow = "hidden"') &&
    rendererSource.includes(
      "document.body.style.overflow = previousOverflow",
    ) &&
    !rendererSource.includes("max-h-[min(340px"),
);

check(
  "shared confirmation snapshots the allowed command above row lifetime",
  floatingLayerSource.includes("AdminEntityListConfirmationSnapshot") &&
    floatingLayerSource.includes("openConfirmation") &&
    floatingLayerSource.includes("<AdminConfirmDialog") &&
    rendererSource.includes(
      "const snapshot: AdminEntityListConfirmationSnapshot",
    ) &&
    rendererSource.includes("onConfirm: target.onSelect") &&
    rendererSource.includes("floating.openConfirmation(snapshot)") &&
    !rendererSource.includes("confirmingTarget") &&
    !rendererSource.includes("setConfirmingKind"),
);
check(
  "bulk confirmation uses the same owner and fails closed when unavailable",
  entityListSource.includes("getBulkConfirmation") &&
    entityListSource.includes("floating.openConfirmation({") &&
    entityListSource.includes("onConfirm: () => executeBulk(action, ids)") &&
    entityListSource.includes("لم يبدأ الإجراء") &&
    entityListSource.indexOf("floating.openConfirmation({") <
      entityListSource.indexOf("onConfirm: () => executeBulk(action, ids)") &&
    !entityListSource.includes("if (!confirmation || !floating)"),
);
check(
  "shared confirmation closes only after success and remains retryable after failure",
  floatingLayerSource.includes("await activeConfirmation.onConfirm()") &&
    floatingLayerSource.includes(
      "current === activeConfirmation ? null : current",
    ) &&
    confirmationSource.includes("invokingRef.current") &&
    confirmationSource.includes("if (failed)") &&
    confirmationSource.includes("data-admin-confirm-submit") &&
    confirmationSource.includes("Keep the dialog open"),
);
check(
  "shared confirmation owns live invocation pending independently of row snapshots",
  confirmationSource.includes("const busy = pending || invoking") &&
    confirmationSource.includes("invokingRef.current = true") &&
    confirmationSource.includes("await confirmRef.current()") &&
    confirmationSource.includes("disabled={busy || confirmDisabled}") &&
    rendererSource.includes("await activeConfirmation.onConfirm()") &&
    floatingLayerSource.includes("await activeConfirmation.onConfirm()"),
);
const usersRolesSource = read(paths.usersRoles);
const usersFormSource = read(paths.usersForm);
check(
  "Users collection and edit status changes adopt shared confirmation with pending, retry, and focus return",
  usersRolesSource.includes("<AdminEntityList<") &&
    usersRolesSource.includes(
      "await setAdminUserActiveAction(row.id, nextActive)",
    ) &&
    usersRolesSource.includes("await deleteAdminUserAction(row.id)") &&
    /confirmation\s*:\s*\{[\s\S]{0,240}?mode\s*:\s*["']shared["']/.test(
      usersRolesSource,
    ) &&
    usersFormSource.includes("<AdminFormRuntime<AdminUserEntityListRow>") &&
    usersFormSource.includes("<AdminConfirmDialog") &&
    usersFormSource.includes("pending={pending}") &&
    usersFormSource.includes("data-admin-users-edit-save") &&
    usersFormSource.includes("resolveReturnFocus={() =>") &&
    usersFormSource.includes("getForm(formId)?.requestSubmit()") &&
    !usersRolesSource.includes("window.confirm") &&
    !usersFormSource.includes("window.confirm") &&
    !usersRolesSource.includes("/api/"),
);
check(
  "confirmation restores focus through a connected target after optimistic row removal",
  rendererSource.includes("createReturnFocusResolver") &&
    rendererSource.includes(
      "trigger?.isConnected && isDocumentTabbable(trigger)",
    ) &&
    rendererSource.includes("firstVisibleMore") &&
    confirmationSource.includes("configuredReturnFocusResolver") &&
    confirmationSource.includes("focusTarget?.isConnected"),
);
check(
  "Row Actions correction creates no native or parallel mutation runtime",
  ![
    rendererSource,
    floatingLayerSource,
    floatingPositionSource,
    entityListSurfaceSource,
  ].some((source) => source.includes("window.confirm")) &&
    !floatingLayerSource.includes("useAdminEntityInstantMutation") &&
    !rendererSource.includes("useAdminEntityInstantMutation"),
);

check(
  "No Row Actions consumer declares a specialized parallel adapter",
  manifestEntries.flatMap((entry) =>
    Object.entries(entry.actions)
      .filter(([, state]) => String(state) === "specialized_adapter")
      .map(([action]) => `${entry.entity}:${action}`),
  ).length === 0,
);

const instantInteraction =
  ADMIN_ROW_ACTIONS_CAPABILITY_ADOPTION.instantMutationInteraction;
const directInstantConsumers = instantInteraction.directConsumers;
const domainOwnedRowLifecycleConsumers =
  instantInteraction.domainOwnedRowLifecycleConsumers;
const rowAScope = resolveAdminInstantMutationInteraction({
  rowId: 11,
  rowPendingActions: [{ rowId: 11, action: "visibility" }],
  bulkPendingAction: null,
});
const rowBScope = resolveAdminInstantMutationInteraction({
  rowId: 12,
  rowPendingActions: [{ rowId: 11, action: "visibility" }],
  bulkPendingAction: null,
});
const bulkScope = resolveAdminInstantMutationInteraction({
  rowId: 12,
  rowPendingActions: [],
  bulkPendingAction: "bulk-delete",
});
check(
  "Instant Mutation scopes pending to the active row while unrelated rows stay interactive",
  rowAScope.row.pendingAction === "visibility" &&
    rowAScope.row.isPending &&
    !rowBScope.row.isPending &&
    rowBScope.bulk.isBlocked,
);
check(
  "Bulk Mutation keeps busy state inside the Bulk interaction contract",
  bulkScope.bulk.isPending &&
    bulkScope.bulk.isBlocked &&
    !bulkScope.row.isPending &&
    bulkScope.row.pendingAction === null,
);
check(
  "same-query post-success reconciliation remains separate from Query pending",
  resolveAdminEntityListInteractionState({
    isPending: false,
    isPlaceholderData: false,
    isFetching: true,
  }).revalidating &&
    !resolveAdminEntityListInteractionState({
      isPending: false,
      isPlaceholderData: false,
      isFetching: true,
    }).queryPending &&
    resolveAdminEntityListInteractionState({
      isPending: false,
      isPlaceholderData: true,
      isFetching: true,
    }).queryPending,
);
check(
  "Instant Mutation inventory is unique, complete, and adopts the scoped owner contract",
  new Set(directInstantConsumers).size === directInstantConsumers.length &&
    directInstantConsumers.length === 15 &&
    directInstantConsumers.every((sourceFile) => {
      const source = read(sourceFile);
      return (
        (source.includes("useAdminEntityInstantMutation") ||
          source.includes("useAdminBoundedClientInstantMutation")) &&
        source.includes("getRowInteraction") &&
        !source.includes("pendingRowId") &&
        !source.includes("setPendingRowId")
      );
    }),
);
check(
  "Menu tables keep atomic domain writes while adopting shared Busy, feedback, and fixed-column contracts",
  [
    "src/app/admin/pages-blocks/menus/MenusTableClient.tsx",
    "src/app/admin/pages-blocks/menus/MenuItemsTableClient.tsx",
  ].every((sourceFile) => {
    const source = read(sourceFile);
    return (
      source.includes("useAdminBoundedClientInstantMutation") &&
      source.includes("useAdminFeedback") &&
      source.includes("getRowInteraction") &&
      !source.includes("pendingRowId")
    );
  }) &&
    read("src/app/admin/pages-blocks/menus/MenuItemsTableClient.tsx").includes(
      "ADMIN_DATA_GRID_COLUMNS.statusCompact",
    ) &&
    !read("src/app/admin/pages-blocks/menus/MenuItemsTableClient.tsx").includes(
      "إعادة الترتيب متوقفة",
    ) &&
    read("src/app/admin/pages-blocks/menus/menu-actions/reorder.ts").includes(
      'mutateMenuTree(menuId, "reorder"',
    ),
);
check(
  "Collection controls never bind raw fetching, Query pending, or row mutation pending",
  [
    ...directInstantConsumers,
    ...domainOwnedRowLifecycleConsumers,
    "src/app/admin/activity-log/ActivityLogClient.tsx",
    "src/app/admin/reports/topics-without-image/TopicsWithoutImageReportClient.tsx",
  ].every((sourceFile) => {
    const source = read(sourceFile);
    return (
      !source.includes("controller.isFetching") &&
      !source.includes("pending: controller.queryPending") &&
      !source.includes("pending={controller.queryPending}") &&
      !/AdminTablePagination[\s\S]{0,500}pending=\{pendingRowId !== null\}/u.test(
        source,
      )
    );
  }) &&
    !read("src/lib/admin/entity-list/types.ts").includes("pending?: boolean") &&
    !read(
      "src/components/admin/entity-list/AdminEntityListFilters.tsx",
    ).includes("pending={search.pending}"),
);
check(
  "legacy ambiguous mutation and query state contracts are removed",
  !instantMutationSource.includes("rowPending:") &&
    !instantMutationSource.includes("getRowPendingAction") &&
    !/return\s*\{[\s\S]{0,240}\browPendingActions\s*,/u.test(
      instantMutationSource,
    ) &&
    read(paths.dataController).includes("...interactionState") &&
    !/return\s*\{[\s\S]{0,300}\bisFetching:\s*request\.isFetching/u.test(
      read(paths.dataController),
    ) &&
    !/return\s*\{[\s\S]{0,300}\bisPlaceholderData:\s*request\.isPlaceholderData/u.test(
      read(paths.dataController),
    ),
);
check(
  "Admin table state owner no longer exposes a parallel mutation lifecycle",
  !read("src/components/admin/table-engine/useAdminTable.ts").includes(
    "useTransition",
  ) &&
    !read("src/components/admin/table-engine/useAdminTable.ts").includes(
      "runAction",
    ) &&
    !read("src/components/admin/table-engine/useAdminTable.ts").includes(
      "refreshRows",
    ),
);

printManagementCollectionsConsistencyMatrix({
  surfaceCount: collectionSurfaces.length,
  fullAdoptionClaimCount: fullAdoptionClaims.length,
  partialAdoptionCount: partialAdoptionSurfaces.length,
  exactClaimCoverage: hasExactFullAdoptionClaimCoverage(
    fullAdoptionSurfaces,
    fullAdoptionClaims,
  ),
  surfaceFailures: collectionSurfaceComplianceFailures,
  contractFailures: fullAdoptionContractFailures,
  globalClosed: ADMIN_COLLECTION_SURFACE_ADOPTION.globalClosed,
});

console.log(
  `Admin Row Actions capability verification passed (${passed} checks).`,
);
