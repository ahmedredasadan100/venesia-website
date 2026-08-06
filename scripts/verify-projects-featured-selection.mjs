import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function loadTopLevelFunction(relPath, functionName, scriptKind) {
  const source = readFileSync(resolve(relPath), "utf8");
  const sourceFile = ts.createSourceFile(
    relPath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  const declaration = sourceFile.statements.find(
    (statement) =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === functionName,
  );
  assert.ok(declaration, `${functionName} must remain a top-level function in ${relPath}`);

  const declarationSource = ts.createPrinter().printNode(
    ts.EmitHint.Unspecified,
    declaration,
    sourceFile,
  );
  const compiled = ts.transpileModule(declarationSource, {
    compilerOptions: {
      module: ts.ModuleKind.None,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const context = { exports: {}, selectedFunction: undefined };
  vm.runInNewContext(
    `${compiled}\nselectedFunction = ${functionName};`,
    context,
    { filename: relPath },
  );
  assert.equal(typeof context.selectedFunction, "function");
  return context.selectedFunction;
}

function loadTopLevelFunctionSource(relPath, functionName, scriptKind) {
  const source = readFileSync(resolve(relPath), "utf8");
  const sourceFile = ts.createSourceFile(
    relPath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  const declaration = sourceFile.statements.find(
    (statement) =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === functionName,
  );
  assert.ok(declaration, `${functionName} must remain a top-level function in ${relPath}`);

  return ts.createPrinter().printNode(
    ts.EmitHint.Unspecified,
    declaration,
    sourceFile,
  );
}

const featuredSectionPath = "src/components/projects/ProjectsFeaturedSection.tsx";
const featuredSectionSource = readFileSync(resolve(featuredSectionPath), "utf8");
const featuredEditorSource = readFileSync(
  resolve("src/components/admin/page-blocks/editors/ProjectsHubFeaturedModuleEditor.tsx"),
  "utf8",
);
const contentModuleEditorSource = readFileSync(
  resolve("src/components/admin/page-blocks/ContentModuleEditClient.tsx"),
  "utf8",
);
const projectsHubRendererSource = readFileSync(
  resolve("src/components/projects/ProjectsHubModulesRenderer.tsx"),
  "utf8",
);
const getVisibleSideProjects = loadTopLevelFunction(
  featuredSectionPath,
  "getVisibleSideProjects",
  ts.ScriptKind.TSX,
);
const applyFeaturedLimit = loadTopLevelFunction(
  "src/lib/projects/map-projects-hub-module-props.ts",
  "applyFeaturedLimit",
  ts.ScriptKind.TS,
);
const mainFeaturedCardSource = loadTopLevelFunctionSource(
  featuredSectionPath,
  "MainFeaturedCard",
  ts.ScriptKind.TSX,
);
const sideFeaturedCardSource = loadTopLevelFunctionSource(
  featuredSectionPath,
  "SideFeaturedCard",
  ts.ScriptKind.TSX,
);

assert.ok(
  featuredSectionSource.includes(
    "const visibleSideProjects = getVisibleSideProjects(projects, activeIndex);",
  ),
  "ProjectsFeaturedSection must use the guarded side-project selector",
);
assert.ok(
  featuredSectionSource.includes("if (projects.length === 0) return null;"),
  "An empty featured list must render neither a main nor side projects",
);
assert.ok(
  featuredSectionSource.includes("<SideFeaturedCard key={project.id}"),
  "Side project identity must remain key={project.id}",
);
assert.equal(
  (featuredSectionSource.match(/<FeaturedProjectEnglishName/g) ?? []).length,
  2,
  "Main and side cards must adopt one shared English-name presentation owner",
);
assert.equal(
  (featuredSectionSource.match(/<FeaturedProjectMetaRow/g) ?? []).length,
  2,
  "Main and side cards must adopt one shared location/type row owner",
);
assert.match(
  featuredSectionSource,
  /block min-w-0 truncate font-en font-bold leading-tight/,
  "English project names must remain one-line, bold, and ellipsized",
);
assert.match(
  featuredSectionSource,
  /flex min-w-0 flex-nowrap items-center gap-2/,
  "Location and project type must remain on one responsive row",
);
assert.doesNotMatch(
  sideFeaturedCardSource,
  /project\.arabicName/,
  "Side featured cards must not render the Arabic project name",
);
assert.match(
  sideFeaturedCardSource,
  /<FeaturedProjectMetaRow[\s\S]*?className="w-full justify-center"/,
  "Side metadata must start without a deleted-name spacing gap",
);
assert.match(
  sideFeaturedCardSource,
  /<PlainTextContent[\s\S]*?className="mt-3 line-clamp-2/,
  "Side descriptions must retain one balanced spacing step after metadata",
);
assert.ok(
  sideFeaturedCardSource.indexOf("<FeaturedProjectEnglishName") <
    sideFeaturedCardSource.indexOf("<FeaturedProjectMetaRow") &&
    sideFeaturedCardSource.indexOf("<FeaturedProjectMetaRow") <
      sideFeaturedCardSource.indexOf("<PlainTextContent"),
  "Side card order must remain English name, metadata, then description",
);
assert.match(
  mainFeaturedCardSource,
  /<FeaturedProjectEnglishName[\s\S]*?<FeaturedProjectMetaRow[\s\S]*?<PlainTextContent/,
  "Main featured card presentation must remain intact",
);

assert.doesNotMatch(
  featuredEditorSource,
  /تحكّم في العناصر الظاهرة داخل قسم المشروعات المميزة/,
  "The featured editor must not repeat the unified Section Hero description",
);
assert.doesNotMatch(
  featuredEditorSource,
  /type=["']checkbox["']|<select\b/,
  "The featured editor must not own raw checkbox or native select presentation",
);
assert.match(featuredEditorSource, /<AdminFormSwitch\b/, "Featured options must use the shared switch");
assert.match(
  featuredEditorSource,
  /<AdminFormListboxSelect[\s\S]*?name="selection_mode"/,
  "Featured selection mode must use the shared form listbox",
);
assert.match(
  featuredEditorSource,
  /<AdminFormGrid columns=\{3\}/,
  "Featured card visibility options must use the shared three-column form grid",
);
assert.ok(
  featuredEditorSource.indexOf('name="title"') < featuredEditorSource.indexOf('name="subtitle"'),
  "Title with its visibility switch must precede subtitle with its visibility switch",
);
assert.match(
  contentModuleEditorSource,
  /<AdminFormListboxSelect[\s\S]*?name="status"/,
  "Content module status must use the shared form listbox",
);

let evaluatedStates = 0;
for (let size = 0; size <= 5; size += 1) {
  const projects = Array.from({ length: size }, (_, index) => ({ id: String(index + 1) }));
  const activeIndexes = size === 0 ? [0] : projects.map((_, index) => index);

  for (const activeIndex of activeIndexes) {
    const sideProjects = Array.from(getVisibleSideProjects(projects, activeIndex));
    const sideIds = sideProjects.map((project) => project.id);
    const expectedCount = Math.max(0, Math.min(2, size - 1));
    const expectedIds = Array.from(
      { length: expectedCount },
      (_, sideIndex) => projects[(activeIndex + sideIndex + 1) % size].id,
    );

    assert.equal(sideProjects.length, expectedCount, `size=${size}, active=${activeIndex}`);
    assert.equal(
      new Set(sideIds).size,
      sideIds.length,
      `unique sides: size=${size}, active=${activeIndex}`,
    );
    if (size > 0) {
      assert.ok(
        !sideIds.includes(projects[activeIndex].id),
        `main excluded: size=${size}, active=${activeIndex}`,
      );
    }
    assert.deepEqual(sideIds, expectedIds, `circular order: size=${size}, active=${activeIndex}`);
    evaluatedStates += 1;
  }
}

assert.match(
  projectsHubRendererSource,
  /<ProjectsFeaturedSection[\s\S]*?projects=\{applyFeaturedLimit\(featuredProjects, props\.limit\)\}/,
  "CMS featured module must pass its limited list to ProjectsFeaturedSection",
);
const limited = Array.from(applyFeaturedLimit([{ id: "107" }, { id: "2" }], 1));
const mainProject = limited[0];
const sideProjects = Array.from(getVisibleSideProjects(limited, 0));
assert.equal(limited.length, 1);
assert.equal(mainProject.id, "107");
assert.deepEqual(sideProjects, []);

console.log(
  JSON.stringify(
    {
      ok: true,
      evaluatedStates,
      sizes: [0, 1, 2, 3, 4, 5],
      uniqueSideIds: true,
      mainExcluded: true,
      circularOrder: true,
      cmsLimitOneSafe: true,
      projectIdKeyPreserved: true,
    },
    null,
    2,
  ),
);
