import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(
  repoRoot,
  "src/lib/admin/media-catalog/write-adoption-manifest.json",
);
const supportedExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".mts"]);
const allowedClassifications = new Set([
  "adopted",
  "neutral",
  "explicit_exception",
]);
const allowedMutationContracts = new Set([
  "explicit_empty_delete",
  "explicit_empty_bulk_delete",
]);

function normalizePath(value) {
  return value.replaceAll("\\", "/");
}

function read(relativePath) {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

function listSourceFiles(root) {
  const files = [];
  function visit(directory) {
    for (const entry of readdirSync(directory)) {
      const absolutePath = join(directory, entry);
      const details = statSync(absolutePath);
      if (details.isDirectory()) {
        if (!new Set([".git", ".next", "node_modules"]).has(entry)) visit(absolutePath);
        continue;
      }
      if (supportedExtensions.has(extname(entry))) files.push(absolutePath);
    }
  }
  visit(root);
  return files;
}

function parseProviderRegistry() {
  const source = read("src/lib/admin/media-catalog/reference-providers.ts");
  const start = source.indexOf("const PROVIDER_CONFIGS = [");
  const end = source.indexOf("] satisfies ProviderConfig[]", start);
  if (start < 0 || end < 0) throw new Error("provider_registry_source_not_found");
  const registrySource = source.slice(start, end);
  const providers = [];
  const pattern = /domainKey:\s*"([^"]+)"[\s\S]*?table:\s*"([^"]+)"[\s\S]*?fields:\s*\[([^\]]*)\]/g;
  for (const match of registrySource.matchAll(pattern)) {
    providers.push({
      domainKey: match[1],
      table: match[2],
      mediaFields: [...match[3].matchAll(/"([^"]+)"/g)].map((field) => field[1]),
    });
  }
  return providers;
}

function discoverDirectProviderWriters(providerTables) {
  const writers = new Map();

  function providerTableFromReceiver(node) {
    if (
      ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === "from"
      && node.arguments.length === 1
      && ts.isStringLiteralLike(node.arguments[0])
      && providerTables.has(node.arguments[0].text)
    ) {
      return node.arguments[0].text;
    }
    let result = null;
    ts.forEachChild(node, (child) => {
      if (result === null) result = providerTableFromReceiver(child);
    });
    return result;
  }

  for (const rootName of ["src", "scripts"]) {
    for (const absolutePath of listSourceFiles(join(repoRoot, rootName))) {
      const source = readFileSync(absolutePath, "utf8");
      const syntaxKind = absolutePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
      const sourceFile = ts.createSourceFile(absolutePath, source, ts.ScriptTarget.Latest, true, syntaxKind);
      function visit(node) {
        if (
          ts.isCallExpression(node)
          && ts.isPropertyAccessExpression(node.expression)
          && new Set(["insert", "update", "upsert", "delete"]).has(node.expression.name.text)
        ) {
          const table = providerTableFromReceiver(node.expression.expression);
          if (!table) {
            ts.forEachChild(node, visit);
            return;
          }
        const relativePath = normalizePath(relative(repoRoot, absolutePath));
        const tables = writers.get(relativePath) ?? new Set();
          tables.add(table);
        writers.set(relativePath, tables);
        }
        ts.forEachChild(node, visit);
      }
      visit(sourceFile);
    }
  }
  return writers;
}

function collectDailyProviderWideCalls() {
  const violations = [];
  const callPattern = /synchronizeMediaReferenceProvidersAfterMutation\s*\(/g;
  for (const absolutePath of listSourceFiles(join(repoRoot, "src"))) {
    const relativePath = normalizePath(relative(repoRoot, absolutePath));
    if (relativePath === "src/lib/admin/media-catalog/synchronization.ts") continue;
    const source = readFileSync(absolutePath, "utf8");
    if (callPattern.test(source)) violations.push(relativePath);
  }
  return violations;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractExportedAction(source, exportName) {
  const signature = `export async function ${exportName}(`;
  const start = source.indexOf(signature);
  if (start < 0) return null;
  const next = source.indexOf("\nexport async function ", start + signature.length);
  return source.slice(start, next < 0 ? source.length : next);
}

const failures = [];
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const actualProviders = parseProviderRegistry();
const manifestProviders = manifest.providerRegistry ?? [];
const synchronizationSource = read("src/lib/admin/media-catalog/synchronization.ts");
const domainCoordinationSource = read("src/lib/admin/media-catalog/domain-write-coordination.ts");

if (manifest.schemaVersion !== 1) failures.push("Manifest schemaVersion must be 1.");
if (manifest.globalClosure !== true) {
  failures.push("Global Media write-coordination closure must be true after the complete writer inventory is closed.");
}
if (
  !/const nonEmptyCleanupWarnings = cleanupResults\.flatMap/.test(synchronizationSource)
  || !/result\.status === "synced" && result\.explicitEmpty !== true/.test(synchronizationSource)
  || !/const failedCleanupWarnings = cleanupResults\.flatMap/.test(synchronizationSource)
  || !/result\.status === "saved_with_media_sync_warning"/.test(synchronizationSource)
  || !/await markMediaCatalogRuntimeUncertain\(cleanupRuntimeWarnings\)/.test(synchronizationSource)
  || !/cleanupRuntimeMarkFailure = `media_catalog_runtime_uncertain_mark_failed:/.test(synchronizationSource)
  || !/if \(warning \|\| nonEmptyCleanupWarnings\.length > 0\)/.test(synchronizationSource)
) {
  failures.push("The shared cleanup-target synchronization owner must fail closed and mark runtime uncertain unless every cleanup result is explicit-empty.");
}
const warningCoordinationIndex = domainCoordinationSource.indexOf(
  'if (synchronization.status === "saved_with_media_sync_warning")',
);
const warningRuntimeMarkIndex = domainCoordinationSource.indexOf(
  "await markCoordinationRuntimeUncertain(",
  warningCoordinationIndex,
);
const warningNoLeaseIndex = domainCoordinationSource.indexOf(
  "if (!lease) return",
  warningCoordinationIndex,
);
if (
  !/export async function markMediaCatalogRuntimeUncertain/.test(synchronizationSource)
  || !/error instanceof MediaDomainMutationError[\s\S]*?error\.domainWriteCommitted/.test(domainCoordinationSource)
  || !/const runtimeMarkFailure = uncertaintyReasons\.length > 0[\s\S]*?await markCoordinationRuntimeUncertain\(uncertaintyReasons\)/.test(domainCoordinationSource)
  || !/if \(runtimeMarkFailure\) \{[\s\S]*?throw new MediaDomainMutationError/.test(domainCoordinationSource)
  || warningCoordinationIndex < 0
  || warningRuntimeMarkIndex <= warningCoordinationIndex
  || warningNoLeaseIndex <= warningRuntimeMarkIndex
  || !/completionUncertainty[\s\S]*?await markCoordinationRuntimeUncertain/.test(domainCoordinationSource)
  || (domainCoordinationSource.match(/media_write_lease_failure_record_failed:/g) ?? []).length < 2
) {
  failures.push("Domain write coordination must persist Runtime uncertain after committed domain failures, synchronization warnings, lease completion failures, or lease failure-recording failures without marking a safely recorded pre-commit failure uncertain.");
}

const actualProviderMap = new Map(
  actualProviders.map((provider) => [provider.domainKey, provider.table]),
);
const manifestProviderMap = new Map(
  manifestProviders.map((provider) => [provider.domainKey, provider.table]),
);
for (const [domainKey, table] of actualProviderMap) {
  if (manifestProviderMap.get(domainKey) !== table) {
    failures.push(`Provider ${domainKey} (${table}) is missing or mismatched in the adoption manifest.`);
  }
}
for (const provider of actualProviders) {
  const manifestProvider = manifestProviders.find(
    (candidate) => candidate.domainKey === provider.domainKey,
  );
  if (
    JSON.stringify([...(manifestProvider?.mediaFields ?? [])].sort())
    !== JSON.stringify([...provider.mediaFields].sort())
  ) {
    failures.push(`Provider ${provider.domainKey} mediaFields do not match the provider-owned registry fields.`);
  }
}
for (const [domainKey, table] of manifestProviderMap) {
  if (actualProviderMap.get(domainKey) !== table) {
    failures.push(`Manifest provider ${domainKey} (${table}) no longer matches the provider registry.`);
  }
}

const classifiedFiles = new Map();
const classifiedTablesByFile = new Map();
for (const owner of manifest.owners ?? []) {
  if (!allowedClassifications.has(owner.classification)) {
    failures.push(`Owner ${owner.id} has unknown classification ${owner.classification}.`);
  }
  if (typeof owner.rationale !== "string" || owner.rationale.trim().length < 20) {
    failures.push(`Owner ${owner.id} needs an explicit rationale.`);
  }
  if (!Array.isArray(owner.mediaFields)) {
    failures.push(`Owner ${owner.id} must declare its mediaFields inventory.`);
  }
  for (const contractKey of [
    "acquiresWriteLease",
    "completesReferenceSync",
    "structuredWarning",
  ]) {
    if (typeof owner[contractKey] !== "boolean") {
      failures.push(`Owner ${owner.id} must declare boolean ${contractKey}.`);
    }
  }
  if (
    owner.classification === "adopted"
    && (!owner.acquiresWriteLease || !owner.completesReferenceSync || !owner.structuredWarning)
  ) {
    failures.push(`Adopted owner ${owner.id} must prove lease, reference sync, and structured warning adoption.`);
  }
  if (
    owner.requiresExplicitEmptyCleanup !== undefined
    && typeof owner.requiresExplicitEmptyCleanup !== "boolean"
  ) {
    failures.push(`Owner ${owner.id} requiresExplicitEmptyCleanup must be boolean when declared.`);
  }
  if (
    owner.requiresExplicitEmptyCleanup === true
    && (owner.classification !== "explicit_exception"
      || owner.acquiresWriteLease
      || !owner.completesReferenceSync
      || !owner.structuredWarning)
  ) {
    failures.push(
      `Explicit-empty owner ${owner.id} must be an unleased explicit exception with entity sync and structured warnings.`,
    );
  }
  for (const table of owner.tables ?? []) {
    if (![...actualProviderMap.values()].includes(table)) {
      failures.push(`Owner ${owner.id} names unknown provider table ${table}.`);
    }
  }
  let adoptedMarkerFound = false;
  let explicitCleanupMarkerFound = false;
  let structuredWarningMarkerFound = false;
  for (const sourceFile of owner.sourceFiles ?? []) {
    const normalized = normalizePath(sourceFile);
    if (!existsSync(join(repoRoot, normalized))) {
      failures.push(`Owner ${owner.id} references missing source file ${normalized}.`);
      continue;
    }
    const previous = classifiedFiles.get(normalized) ?? new Set();
    previous.add(owner.classification);
    classifiedFiles.set(normalized, previous);
    const classifiedTables = classifiedTablesByFile.get(normalized) ?? new Set();
    for (const table of owner.tables ?? []) classifiedTables.add(table);
    classifiedTablesByFile.set(normalized, classifiedTables);
    const source = read(normalized);
    if (
      owner.classification === "adopted"
      && /coordinateMediaReference(?:Entity|Domain)Mutation/.test(source)
    ) {
      adoptedMarkerFound = true;
    }
    if (
      owner.requiresExplicitEmptyCleanup === true
      && /synchronize(?:DeletedMenuItemReferences|MediaReferencesAfterDomainMutation|MediaReferenceWriteScopesAfterDomainMutation)/.test(source)
    ) {
      explicitCleanupMarkerFound = true;
    }
    if (
      owner.requiresExplicitEmptyCleanup === true
      && /(?:saved_with_media_sync_warning|navigationMutationMessage)/.test(source)
    ) {
      structuredWarningMarkerFound = true;
    }
  }
  for (const mutationPath of owner.mutationPaths ?? []) {
    const normalized = normalizePath(mutationPath.sourceFile ?? "");
    if (!(owner.sourceFiles ?? []).map(normalizePath).includes(normalized)) {
      failures.push(`Owner ${owner.id} mutation path ${mutationPath.exportName ?? "<unknown>"} is not declared in sourceFiles.`);
      continue;
    }
    if (!allowedMutationContracts.has(mutationPath.contract)) {
      failures.push(`Owner ${owner.id} mutation path ${mutationPath.exportName ?? "<unknown>"} has unknown contract ${mutationPath.contract}.`);
      continue;
    }
    if (!(owner.tables ?? []).includes(mutationPath.domainKey)) {
      failures.push(`Owner ${owner.id} mutation path ${mutationPath.exportName ?? "<unknown>"} names undeclared provider ${mutationPath.domainKey}.`);
      continue;
    }
    if (!existsSync(join(repoRoot, normalized))) continue;

    const actionSource = extractExportedAction(read(normalized), mutationPath.exportName);
    if (!actionSource) {
      failures.push(`Owner ${owner.id} cannot find exported action ${mutationPath.exportName} in ${normalized}.`);
      continue;
    }

    const selectIndex = actionSource.search(/\.select\(\s*["']id["']\s*\)/);
    const deleteIndex = actionSource.search(/\.delete\(\s*\)/);
    const atomicRpcIndex = actionSource.search(/await mutatePageComposition\(/);
    const domainCommitIndex = deleteIndex >= 0 ? deleteIndex : atomicRpcIndex;
    const synchronizeIndex = actionSource.search(
      /synchronizeMediaReferenceWriteScopesAfterDomainMutation\(\s*\[\]\s*,\s*null\s*,/,
    );
    const warningIndex = actionSource.search(
      /if \(mediaSynchronization\??\.status === ["']saved_with_media_sync_warning["']\)/,
    );
    const revalidationIndex = actionSource.search(
      /await revalidate(?:HeroAdmin|BlockModulePaths)\(/,
    );
    const domainPattern = new RegExp(
      String.raw`domainKey:\s*["']${escapeRegExp(mutationPath.domainKey)}["']`,
    );
    const commitProof = domainCommitIndex >= 0 && synchronizeIndex > domainCommitIndex
      ? actionSource.slice(domainCommitIndex, synchronizeIndex)
      : "";

    if (
      selectIndex < 0
      || domainCommitIndex <= selectIndex
      || synchronizeIndex <= domainCommitIndex
      || warningIndex <= synchronizeIndex
      || revalidationIndex <= warningIndex
      || !domainPattern.test(actionSource)
      || (!/if \(error\) throw/.test(commitProof) && !/await mutatePageComposition\(/.test(commitProof))
      || !/catch \(revalidationError\)/.test(actionSource)
    ) {
      failures.push(
        `Owner ${owner.id} action ${mutationPath.exportName} must capture IDs before deletion, prove the committed delete, perform entity-scoped explicit-empty synchronization, and surface a structured post-commit warning.`,
      );
    }

    if (
      mutationPath.contract === "explicit_empty_delete"
      && (!/\.maybeSingle<\{ id: number \}>\(\)/.test(actionSource)
        || !/const cleanupIdentity = existing\?\.id \?\? id/.test(actionSource)
        || !/\.eq\(\s*["']id["']\s*,\s*cleanupIdentity\s*\)/.test(actionSource)
        || !/entityIdentity:\s*cleanupIdentity/.test(actionSource))
    ) {
      failures.push(`Owner ${owner.id} action ${mutationPath.exportName} does not prove a captured, retry-safe single-entity delete and explicit-empty cleanup.`);
    }
    if (
      mutationPath.contract === "explicit_empty_bulk_delete"
      && (!/const capturedIds = \(existingRows \?\? \[\]\)\.map/.test(actionSource)
        || !/const cleanupIds = \[\.\.\.new Set\(\[\.\.\.capturedIds, \.\.\.ids\]\)\]/.test(actionSource)
        || (!/\.in\(\s*["']id["']\s*,\s*cleanupIds\s*\)/.test(actionSource)
          && !/hero_ids:\s*cleanupIds/.test(actionSource))
        || !/cleanupIds\.map\(/.test(actionSource))
    ) {
      failures.push(`Owner ${owner.id} action ${mutationPath.exportName} does not prove one captured atomic batch delete followed by retry-safe cleanup of every requested identity.`);
    }
  }
  if (owner.classification === "adopted" && !adoptedMarkerFound) {
    failures.push(`Adopted owner ${owner.id} has no Media write-coordination marker.`);
  }
  if (
    owner.requiresExplicitEmptyCleanup === true
    && !explicitCleanupMarkerFound
  ) {
    failures.push(`Removal owner ${owner.id} claims reference cleanup without an entity-sync marker.`);
  }
  if (
    owner.requiresExplicitEmptyCleanup === true
    && !structuredWarningMarkerFound
  ) {
    failures.push(`Removal owner ${owner.id} claims structured warnings without a warning marker.`);
  }
}

const providerTables = new Set(actualProviders.map((provider) => provider.table));
const directWriters = discoverDirectProviderWriters(providerTables);
for (const [sourceFile, tables] of directWriters) {
  const classifications = classifiedFiles.get(sourceFile);
  if (!classifications) {
    failures.push(
      `Direct provider writer ${sourceFile} (${[...tables].sort().join(", ")}) has no manifest classification.`,
    );
    continue;
  }
  const classifiedTables = classifiedTablesByFile.get(sourceFile) ?? new Set();
  for (const table of tables) {
    if (!classifiedTables.has(table)) {
      failures.push(`Provider writer ${sourceFile} adds unclassified table ownership for ${table}.`);
    }
  }
  if (sourceFile.startsWith("scripts/")) {
    failures.push(`Direct tooling writer ${sourceFile} is forbidden after global closure.`);
  }
}

for (const sourceFile of collectDailyProviderWideCalls()) {
  failures.push(
    `Daily Domain mutation ${sourceFile} calls provider-wide synchronization; use an entity-scoped coordinated write instead.`,
  );
}

if (failures.length) {
  console.error("Media write adoption architecture guard failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const classificationCounts = Object.fromEntries(
  [...allowedClassifications].map((classification) => [
    classification,
    (manifest.owners ?? []).filter((owner) => owner.classification === classification).length,
  ]),
);
console.log("Media write adoption architecture guard passed.");
console.log(
  JSON.stringify(
    {
      providers: actualProviders.length,
      directWriterOwners: directWriters.size,
      classifications: classificationCounts,
      globalClosure: manifest.globalClosure,
    },
    null,
    2,
  ),
);
