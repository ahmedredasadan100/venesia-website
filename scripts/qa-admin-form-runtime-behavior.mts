import assert from "node:assert/strict";
import { createJiti } from "jiti";
import { chromium } from "playwright";

const jiti = createJiti(import.meta.url);
const {
  captureAdminFormControls,
  restoreAdminFormControls,
  serializeAdminForm,
} = await jiti.import<
  typeof import("../src/lib/admin/form-dom-preservation.ts")
>("../src/lib/admin/form-dom-preservation.ts");
const { resolveAdminFormNavigationDecision } = await jiti.import<
  typeof import("../src/lib/admin/form-runtime.ts")
>("../src/lib/admin/form-runtime.ts");
const { parseFormPublishedDate, resolveTopicPublishedAt } = await jiti.import<
  typeof import("../src/lib/content-dates.ts")
>("../src/lib/content-dates.ts");

let passed = 0;
function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setContent(`
    <form id="runtime-form">
      <input name="title" value="Initial title">
      <textarea name="excerpt">Initial excerpt</textarea>
      <input type="checkbox" name="is_featured" checked>
      <input type="checkbox" name="is_published">
      <input type="date" name="published_at" value="2026-07-01">
      <input type="hidden" name="date_label" value="legacy-label">
      <select name="category_slug">
        <option value="news" selected>News</option>
        <option value="guides">Guides</option>
      </select>
      <select name="tags" multiple>
        <option value="one" selected>One</option>
        <option value="two">Two</option>
        <option value="three">Three</option>
      </select>
      <input name="disabled_note" value="Initial disabled" disabled>
      <input type="file" name="image_file">
    </form>
  `);

  const behavior = await page.evaluate(
    ({ captureSource, restoreSource, serializeSource }) => {
      const capture = (0, eval)(`(${captureSource})`) as (
        form: HTMLFormElement,
      ) => unknown[];
      const restore = (0, eval)(`(${restoreSource})`) as (
        form: HTMLFormElement,
        snapshot: unknown[],
      ) => void;
      const serialize = (0, eval)(`(${serializeSource})`) as (
        form: HTMLFormElement,
      ) => string;
      const form = document.querySelector<HTMLFormElement>("#runtime-form");
      if (!form) throw new Error("Runtime behavior form was not mounted.");

      const control = <
        T extends
          | HTMLInputElement
          | HTMLTextAreaElement
          | HTMLSelectElement,
      >(
        name: string,
      ) => {
        const element = form.elements.namedItem(name);
        if (!(element instanceof HTMLElement)) {
          throw new Error(`Missing behavior control: ${name}`);
        }
        return element as T;
      };

      const initialBaseline = serialize(form);
      control<HTMLInputElement>("title").value = "Submitted title";
      control<HTMLTextAreaElement>("excerpt").value = "Submitted excerpt";
      control<HTMLInputElement>("is_featured").checked = false;
      const publishSwitch = control<HTMLInputElement>("is_published");
      publishSwitch.checked = true;
      publishSwitch.indeterminate = true;
      control<HTMLInputElement>("published_at").value = "2026-08-15";
      control<HTMLSelectElement>("category_slug").value = "guides";
      const tags = control<HTMLSelectElement>("tags");
      tags.options[0].selected = false;
      tags.options[1].selected = true;
      tags.options[2].selected = true;
      control<HTMLInputElement>("disabled_note").value = "Submitted disabled";
      const fileInput = control<HTMLInputElement>("image_file");
      const upload = new DataTransfer();
      upload.items.add(
        new File(["image bytes"], "topic-cover.png", { type: "image/png" }),
      );
      fileInput.files = upload.files;

      const submittedBaseline = serialize(form);
      const snapshot = capture(form);
      form.reset();
      const resetWasObserved =
        control<HTMLInputElement>("title").value === "Initial title" &&
        control<HTMLTextAreaElement>("excerpt").value === "Initial excerpt" &&
        control<HTMLInputElement>("is_featured").checked &&
        !control<HTMLInputElement>("is_published").checked &&
        control<HTMLInputElement>("published_at").value === "2026-07-01" &&
        control<HTMLSelectElement>("category_slug").value === "news" &&
        fileInput.files?.length === 0;

      restore(form, snapshot);
      return {
        resetWasObserved,
        initialBaseline,
        submittedBaseline,
        restoredBaseline: serialize(form),
        title: control<HTMLInputElement>("title").value,
        excerpt: control<HTMLTextAreaElement>("excerpt").value,
        featured: control<HTMLInputElement>("is_featured").checked,
        published: publishSwitch.checked,
        publishIndeterminate: publishSwitch.indeterminate,
        publishedAt: control<HTMLInputElement>("published_at").value,
        dateLabel: control<HTMLInputElement>("date_label").value,
        category: control<HTMLSelectElement>("category_slug").value,
        selectedTags: Array.from(tags.selectedOptions, (option) => option.value),
        disabledNote: control<HTMLInputElement>("disabled_note").value,
        fileName: fileInput.files?.item(0)?.name ?? null,
      };
    },
    {
      captureSource: captureAdminFormControls.toString(),
      restoreSource: restoreAdminFormControls.toString(),
      serializeSource: serializeAdminForm.toString(),
    },
  );

  check(
    "Chromium observes a native form reset before runtime restoration",
    behavior.resetWasObserved,
  );
  check(
    "submitted text, textarea, select, checkbox, disabled, and file DOM state restores",
    behavior.title === "Submitted title" &&
      behavior.excerpt === "Submitted excerpt" &&
      behavior.featured === false &&
      behavior.category === "guides" &&
      behavior.selectedTags.join(",") === "two,three" &&
      behavior.disabledNote === "Submitted disabled" &&
      behavior.fileName === "topic-cover.png",
  );

  const publicationForm = new FormData();
  publicationForm.set("published_at", behavior.publishedAt);
  const submittedPublicationDate = parseFormPublishedDate(publicationForm);
  const firstPublishedAt = resolveTopicPublishedAt({
    formPublishedDate: submittedPublicationDate,
    currentPublishedAt: null,
    status: "published",
    nowIso: "2026-08-15T08:00:00.000Z",
  });
  const preservedFirstPublishedAt = resolveTopicPublishedAt({
    formPublishedDate: "2026-09-01",
    currentPublishedAt: firstPublishedAt,
    status: "published",
    nowIso: "2026-09-01T08:00:00.000Z",
  });
  check(
    "validation failure retains publication controls and first-publication storage semantics",
    behavior.published &&
      behavior.publishIndeterminate &&
      behavior.publishedAt === "2026-08-15" &&
      behavior.dateLabel === "legacy-label" &&
      firstPublishedAt === "2026-08-15T12:00:00.000Z" &&
      preservedFirstPublishedAt === firstPublishedAt &&
      resolveTopicPublishedAt({
        formPublishedDate: submittedPublicationDate,
        currentPublishedAt: firstPublishedAt,
        status: "unpublished",
        nowIso: "2026-08-15T08:00:00.000Z",
      }) === firstPublishedAt &&
      resolveTopicPublishedAt({
        formPublishedDate: submittedPublicationDate,
        currentPublishedAt: null,
        status: "unpublished",
        nowIso: "2026-08-15T08:00:00.000Z",
      }) === null,
  );

  const restoredErrorIsDirty =
    behavior.restoredBaseline !== behavior.initialBaseline;
  check(
    "error restore keeps dirty state while the submitted success baseline is clean",
    behavior.restoredBaseline === behavior.submittedBaseline &&
      restoredErrorIsDirty,
  );
  check(
    "Close blocks pending, navigates clean, and confirms a restored dirty error",
    resolveAdminFormNavigationDecision({
      pending: true,
      dirty: restoredErrorIsDirty,
    }) === "blocked_pending" &&
      resolveAdminFormNavigationDecision({
        pending: false,
        dirty: false,
      }) === "navigate" &&
      resolveAdminFormNavigationDecision({
        pending: false,
        dirty: restoredErrorIsDirty,
      }) === "confirm_discard",
  );
} finally {
  await browser.close();
}

console.log(`qa:admin-form-runtime passed (${passed} assertions)`);
