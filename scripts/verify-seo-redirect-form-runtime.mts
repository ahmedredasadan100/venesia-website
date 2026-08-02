import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import ts from "typescript";

import { ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST } from "../src/lib/admin/form-system/adoption-manifest.ts";
import type { UrlRedirectRecord } from "../src/lib/redirects/redirect-types.ts";

const read = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

function loadPureTypeScriptModule(
  path: string,
  dependencies: Record<string, unknown> = {},
) {
  const output = ts.transpileModule(
    readFileSync(new URL(`../${path}`, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const commonJsModule: { exports: Record<string, unknown> } = { exports: {} };
  Function("exports", "module", "require", output)(
    commonJsModule.exports,
    commonJsModule,
    (specifier: string) => {
      if (specifier in dependencies) return dependencies[specifier];
      throw new Error(`Unsupported dependency ${specifier} while loading ${path}`);
    },
  );
  return commonJsModule.exports;
}

const protectedPaths = loadPureTypeScriptModule(
  "src/lib/redirects/protected-paths.ts",
);
const pathNormalization = loadPureTypeScriptModule(
  "src/lib/redirects/normalize-redirect-path.ts",
);
const { validateRedirectInput } = loadPureTypeScriptModule(
  "src/lib/redirects/validate-redirect.ts",
  {
    "./protected-paths": protectedPaths,
    "./normalize-redirect-path": pathNormalization,
  },
) as typeof import("../src/lib/redirects/validate-redirect.ts");

let assertions = 0;
function check(condition: unknown, label: string) {
  assert.ok(condition, label);
  assertions += 1;
}

function validate(
  input: Partial<{
    sourcePath: string;
    destinationPath: string;
    redirectType: string;
    status: string;
    excludeId: number;
  }> = {},
  existing: Array<
    Pick<
      UrlRedirectRecord,
      "id" | "source_path" | "destination_path" | "status"
    >
  > = [],
) {
  return validateRedirectInput(
    {
      sourcePath: input.sourcePath ?? "/old-path",
      destinationPath: input.destinationPath ?? "/new-path",
      redirectType: input.redirectType ?? "301",
      status: input.status ?? "active",
      ...(input.excludeId ? { excludeId: input.excludeId } : {}),
    },
    existing,
  );
}

const [runtime, formContract, formListbox, modal, client, actions] = await Promise.all([
  read("src/components/admin/ui/AdminFormRuntime.tsx"),
  read("src/lib/admin/form-runtime.ts"),
  read("src/components/admin/ui/AdminFormListboxSelect.tsx"),
  read("src/app/admin/seo/redirects/RedirectFormModal.tsx"),
  read("src/app/admin/seo/redirects/RedirectsClient.tsx"),
  read("src/app/admin/seo/redirects/actions.ts"),
]);

const createSection = actions.slice(
  actions.indexOf("export async function createRedirectAction"),
  actions.indexOf("export async function updateRedirectAction"),
);
const updateSection = actions.slice(
  actions.indexOf("export async function updateRedirectAction"),
  actions.indexOf("export async function toggleRedirectStatusAction"),
);

check(
  [
    "requestCallback",
    "runtimeRef",
    "onClose",
    "onSuccess",
    "useImperativeHandle",
  ].every((marker) => runtime.includes(marker)) &&
    formContract.includes("AdminFormActionState<TResult") &&
    formContract.includes("result?: TResult"),
  "shared Form Runtime exposes a generic modal close and success-result contract",
);
check(
  !runtime.includes("UrlRedirect") && !formContract.includes("UrlRedirect"),
  "shared Form Runtime extension contains no Redirect-specific policy",
);
check(
  modal.includes("<AdminFormRuntime<UrlRedirectRecord>") &&
    !modal.includes("<form") &&
    !modal.includes("useTransition") &&
    !modal.includes("AdminNotice") &&
    modal.includes("onClose={requestClose}") &&
    modal.includes("runtimeRef={runtimeRef}") &&
    modal.includes("onSuccess={handleSuccess}"),
  "Redirect modal delegates its only create/edit form lifecycle to AdminFormRuntime",
);
check(
  ["source_path", "destination_path"].every(
    (field) =>
      modal.includes(`<AdminFormError name="${field}"`) &&
      modal.includes(`${field}-error`),
  ) &&
    ["redirect_type", "status"].every(
      (field) =>
        modal.includes(`focusTargetId="${field}"`) &&
        modal.includes(`error={fieldErrors.${field}?.[0] ?? null}`),
    ) &&
    formListbox.includes('role="alert"') &&
    formListbox.includes('triggerId={focusTargetId}'),
  "Redirect validation fields expose visible errors and focusable controls",
);
check(
  [createSection, updateSection].every(
    (section) =>
      section.includes("previousState: RedirectFormActionState") &&
      section.includes("Promise<RedirectFormActionState>") &&
      section.includes("buildRedirectValidationFailure") &&
      section.includes("buildRedirectFormSuccess") &&
      !section.includes("redirectWithMessage(") &&
      !section.includes("redirect("),
  ),
  "Redirect create/edit actions return structured state without navigation",
);
check(
  createSection.includes('.select("*")') &&
    updateSection.includes('.select("*")') &&
    actions.includes("result,") &&
    client.includes("invalidateAfterFormSave") &&
    client.includes("void controller.invalidate()") &&
    !client.includes("handleRedirectSaved") &&
    !client.includes("setRows(") &&
    !client.includes("router.refresh()"),
  "successful modal saves invalidate the authoritative Data Runtime without local row ownership",
);
check(
  createSection.indexOf("validateRedirectInput(") <
      createSection.indexOf('.insert({') &&
    createSection.indexOf('.insert({') <
      createSection.indexOf("await recordCmsAdminAudit(") &&
    updateSection.indexOf("validateRedirectInput(") <
      updateSection.indexOf('.update({') &&
    updateSection.indexOf('.update({') <
      updateSection.indexOf("await recordCmsAdminAudit("),
  "Redirect validation precedes mutations and audit follows successful mutations",
);
const redirectAdoption = ADMIN_FORM_SYSTEM_ADOPTION_MANIFEST.find(
  (entry) => entry.id === "redirects-create-edit",
);
check(
  redirectAdoption?.classification === "shared_adopter" &&
    redirectAdoption.sourceFiles.length === 1 &&
    redirectAdoption.sourceFiles[0] ===
      "src/app/admin/seo/redirects/RedirectFormModal.tsx",
  "adoption ledger records Redirect create/edit as a shared-runtime adopter",
);
check(
  !modal.includes("RedirectFormRuntime") &&
    !client.includes("RedirectFormRuntime"),
  "Redirect adoption creates no parallel entity runtime",
);

const normalized = validate({
  sourcePath: "old//path/",
  destinationPath: "/new/path/",
});
check(
  normalized.ok &&
    normalized.sourcePath === "/old/path" &&
    normalized.destinationPath === "/new/path",
  "source and internal destination normalization remain intact",
);

const external = validate({
  destinationPath: "https://example.com/new-path?from=old#details",
  redirectType: "302",
  status: "inactive",
});
check(
  external.ok &&
    external.destinationPath ===
      "https://example.com/new-path?from=old#details" &&
    external.redirectType === "302" &&
    external.status === "inactive",
  "external HTTP(S), query, fragment, type, and status policy remain intact",
);
check(
  !validate({ destinationPath: "/new-path?from=old" }).ok &&
    !validate({ sourcePath: "/old-path#fragment" }).ok,
  "internal source and destination query or fragment policy remains restrictive",
);

const duplicateRows = [
  {
    id: 7,
    source_path: "/old-path",
    destination_path: "/existing-target",
    status: "active" as const,
  },
];
const duplicate = validate({}, duplicateRows);
check(
  !duplicate.ok && duplicate.field === "sourcePath",
  "duplicate source validation retains a source-field error",
);
check(
  validate({ excludeId: 7 }, duplicateRows).ok,
  "edit duplicate validation excludes the current Redirect ID",
);
const selfRedirect = validate({ destinationPath: "/old-path" });
check(
  !selfRedirect.ok && selfRedirect.field === "destinationPath",
  "self redirects remain rejected at the destination field",
);
const protectedPath = validate({ sourcePath: "/admin/seo" });
check(
  !protectedPath.ok && protectedPath.field === "sourcePath",
  "protected Admin/system sources remain rejected",
);
const loopRows = [
  {
    id: 9,
    source_path: "/new-path",
    destination_path: "/old-path",
    status: "active" as const,
  },
];
const activeLoop = validate({}, loopRows);
check(
  !activeLoop.ok && activeLoop.field === "destinationPath",
  "active Redirect loop prevention remains enabled",
);
check(
  validate({ status: "inactive" }, loopRows).ok,
  "inactive Redirects retain the existing no-loop-block behavior",
);
const invalidType = validate({ redirectType: "307" });
const invalidStatus = validate({ status: "draft" });
check(
  !invalidType.ok &&
    invalidType.field === "redirectType" &&
    !invalidStatus.ok &&
    invalidStatus.field === "status",
  "only 301/302 and active/inactive remain valid",
);

console.log(
  `verify:seo-redirect-form-runtime passed (${assertions} structural/domain assertions)`,
);
