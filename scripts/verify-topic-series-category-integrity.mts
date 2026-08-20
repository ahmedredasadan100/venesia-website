import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  filterAdminContentSeriesByCategory,
  getAdminContentSeriesCategoryError,
  isAdminContentSeriesSelectionValid,
  TOPIC_SERIES_CATEGORY_MISMATCH_MESSAGE,
} from "../src/lib/admin/content/category-hierarchy.ts";

const root = resolve(import.meta.dirname, "..");
const read = async (path: string) =>
  (await readFile(resolve(root, path), "utf8")).replace(/\r\n/g, "\n");

let passed = 0;
function check(label: string, condition: unknown) {
  assert.ok(condition, label);
  passed += 1;
  console.log(`PASS ${label}`);
}

const series = [
  { id: 11, name: "Series A", slug: "series-a", category_id: 1 },
  { id: 12, name: "Series B", slug: "series-b", category_id: 2 },
];

check(
  "matching category and series is valid for create and edit",
  isAdminContentSeriesSelectionValid(series[0], 1),
);
check(
  "a series from another category is invalid",
  !isAdminContentSeriesSelectionValid(series[1], 1) &&
    getAdminContentSeriesCategoryError(series[1], 1) ===
      TOPIC_SERIES_CATEGORY_MISMATCH_MESSAGE,
);
check(
  "a null series remains valid",
  isAdminContentSeriesSelectionValid(null, 1) &&
    getAdminContentSeriesCategoryError(null, 1) === null,
);
check(
  "series options are filtered to the selected category",
  filterAdminContentSeriesByCategory(series, 1).map((item) => item.id).join(",") === "11",
);
check(
  "no category exposes no series options",
  filterAdminContentSeriesByCategory(series, null).length === 0,
);

const [
  newPage,
  editPage,
  basicPanel,
  seriesFields,
  formListbox,
  articleValidation,
  articleSave,
  mediaSave,
  topicActions,
  taxonomyActions,
] = await Promise.all([
  read("src/app/admin/content/topics/new/page.tsx"),
  read("src/app/admin/content/topics/[id]/page.tsx"),
  read("src/components/admin/content/editors/ContentBasicDataPanel.tsx"),
  read("src/components/admin/content/editors/article/TopicSeriesFields.tsx"),
  read("src/components/admin/ui/AdminFormListboxSelect.tsx"),
  read("src/app/admin/content/topics/article-actions/validation.ts"),
  read("src/app/admin/content/topics/article-actions/save.ts"),
  read("src/app/admin/content/topics/media-actions/save.ts"),
  read("src/app/admin/content/topics/actions.ts"),
  read("src/app/admin/content/taxonomy-form-actions.ts"),
]);

check(
  "create and edit routes load the canonical series category relation",
  [newPage, editPage].every((source) =>
    source.includes("id,name,slug,status,deleted_at,category_id"),
  ),
);
check(
  "the shared basic owner passes the current category into the series owner",
  basicPanel.includes("defaultCategoryId={values?.categoryId}"),
);
check(
  "the series owner follows the single category_id form source",
  seriesFields.includes('?.closest("form")') &&
    seriesFields.includes('?.elements.namedItem("category_id")') &&
    seriesFields.includes('categorySelect.addEventListener("change", syncCategory)'),
);
check(
  "changing category clears an incompatible series value and the shared form listbox publishes change",
    seriesFields.includes('setValue("")') &&
    seriesFields.includes("<AdminFormListboxSelect") &&
    formListbox.includes("previousValueRef.current === selectedValue") &&
    formListbox.includes("previousValueRef.current = selectedValue") &&
    formListbox.includes('new Event("change", { bubbles: true })'),
);
check(
  "series remains optional and disabled until a category is selected",
  seriesFields.includes("allowEmptySelection") &&
    seriesFields.includes("disabled={!categoryId}"),
);
check(
  "article validation loads series category without changing edit availability rules",
  articleValidation.includes('.select("id, name, slug, category_id")') &&
    articleValidation.includes("if (seriesId !== currentSeriesId) query = query.eq"),
);
check(
  "article save rejects mismatch as a structured series_id field error",
  articleSave.includes("getAdminContentSeriesCategoryError") &&
    articleSave.includes("series_id: [seriesCategoryError]") &&
    articleSave.indexOf("const seriesCategoryError") <
      articleSave.indexOf("payload.image = await uploadTopicImage"),
);
check(
  "the shared media topic writer adopts the same invariant",
  mediaSave.includes("getAdminContentSeriesCategoryError") &&
    mediaSave.includes("series_id: [seriesCategoryError]"),
);
check(
  "bulk category moves preflight linked series before writing",
  topicActions.includes("validateBulkCategoryMoveSeries") &&
    topicActions.indexOf("validateBulkCategoryMoveSeries(\n        ids") <
      topicActions.indexOf("category_id: category.id"),
);
check(
  "series category changes reject linked topic conflicts before the RPC",
  taxonomyActions.includes("getSeriesCategoryChangeError") &&
    taxonomyActions.indexOf("getSeriesCategoryChangeError(\n      id") <
      taxonomyActions.indexOf("updateTopicSeriesAtomically({"),
);
check(
  "the canonical mismatch message remains explicit",
  TOPIC_SERIES_CATEGORY_MISMATCH_MESSAGE.includes("تابعة للتصنيف المحدد"),
);

console.log(
  `verify:topic-series-category-integrity passed (${passed} assertions)`,
);
