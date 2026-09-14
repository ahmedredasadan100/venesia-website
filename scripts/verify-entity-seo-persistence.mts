import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ADMIN_ENTITY_SEO_ADOPTION_MANIFEST,
  ADMIN_ENTITY_SEO_PRESENTATION_CLOSURE,
  type AdminEntitySeoAdoptionEntry,
} from "../src/lib/admin/seo/entity-seo-adoption-manifest.ts";
import { PERSISTED_ENTITY_SEO_FIELDS, isPersistedEntitySeoScore } from "../src/lib/seo/entity-seo-types.ts";
import { collectExecutableSourceGraph, graphUsesExecutableBinding } from "./lib/typescript-executable-graph.mts";
import { assertIsolatedSeoBackfillTarget, loadEntitySeoPersistenceOwner } from "./backfill-entity-seo-scores.mts";

const ROOT = process.cwd();
const persistence = "src/lib/admin/seo/entity-seo-persistence.ts";
const scoreOwner = ADMIN_ENTITY_SEO_PRESENTATION_CLOSURE.scoreContractOwner;
const inventory: readonly AdminEntitySeoAdoptionEntry[] = ADMIN_ENTITY_SEO_ADOPTION_MANIFEST;
const eligible = inventory.filter((entry) => entry.classification === "adopted" && entry.surfaceKind === "entity_seo_editor");
assert.ok(eligible.length > 0);
const gaps = eligible.filter((entry) => entry.persistedScore?.status === "gap");
const closureBlockers: readonly string[] = ADMIN_ENTITY_SEO_PRESENTATION_CLOSURE.persistedScore.blockers;
assert.equal(ADMIN_ENTITY_SEO_PRESENTATION_CLOSURE.persistedScore.globalClosed,
  gaps.length === 0 && closureBlockers.length === 0);
assert.deepEqual(gaps.map((entry) => entry.id), ["page-seo"]);

for (const entry of eligible) {
  const adoption = entry.persistedScore;
  assert.ok(adoption, `${entry.id} has no persisted-score adoption decision.`);
  if (adoption.status === "gap") {
    assert.ok(adoption.reason && !adoption.table, "A gap must not claim persisted storage.");
    continue;
  }
  assert.ok(adoption.table && adoption.inputAdapter && adoption.writeOwners?.length);
  for (const writer of adoption.writeOwners) {
    const graph = collectExecutableSourceGraph({ root: ROOT, entrySourceFiles: [writer], traversalBoundarySourceFiles: [scoreOwner] });
    assert.ok(graphUsesExecutableBinding({ root: ROOT, graph, bindings: [{ sourceFile: persistence, exportNames: ["deriveEntitySeoScore"] }] }), `${writer} bypasses the shared persisted-score adoption.`);
    assert.ok(graphUsesExecutableBinding({ root: ROOT, graph, bindings: [{ sourceFile: scoreOwner, exportNames: ["analyzeEntitySeo"] }] }), `${writer} does not reach the canonical algorithm.`);
  }
  for (const reader of adoption.readOwners ?? []) {
    const graph = collectExecutableSourceGraph({ root: ROOT, entrySourceFiles: [reader], traversalBoundarySourceFiles: [scoreOwner] });
    assert.equal(graphUsesExecutableBinding({ root: ROOT, graph, bindings: [{ sourceFile: scoreOwner, exportNames: ["analyzeEntitySeo"] }] }), false, `${reader} analyzes SEO during a collection read.`);
  }
}

// Prove the guard rejects an imported owner that is never called.
const bypass = new Map([[persistence, 'import { analyzeEntitySeo } from "../seo-score"; export function deriveEntitySeoScore() { return { seo_score: 100 }; }']]);
const bypassGraph = collectExecutableSourceGraph({ root: ROOT, entrySourceFiles: [persistence], sourceOverrides: bypass });
assert.equal(graphUsesExecutableBinding({ root: ROOT, graph: bypassGraph, sourceOverrides: bypass, bindings: [{ sourceFile: scoreOwner, exportNames: ["analyzeEntitySeo"] }] }), false);

const owner = loadEntitySeoPersistenceOwner();
const { ENTITY_SEO_SCORE_VERSION } = owner;
const row = {
  content_type: "article", title: "فينيسيا", slug: "venisia", excerpt: "وصف فينيسيا",
  content: "# فينيسيا\n\nنص فعلي 🏠", image: "/home.webp", image_alt: "فينيسيا",
  og_image: null, og_image_alt: null, seo_title: "", seo_description: "",
  seo_keywords: ["فينيسيا", ""], focus_keyword: "فينيسيا",
  faq: [{ question: "أين؟", answer: "هنا", extra: "not a score input" }],
};
const input = owner.toTopicSeoScoreInput(row);
const score = owner.deriveEntitySeoScore(input);
assert.ok(isPersistedEntitySeoScore(score));
assert.equal(score.seo_score_version, ENTITY_SEO_SCORE_VERSION);
assert.deepEqual(owner.deriveEntitySeoScore(input), score, "Calculation must be deterministic.");
assert.deepEqual(owner.deriveEntitySeoScore(input, score), score, "Unchanged provenance must preserve the tuple.");
assert.deepEqual(owner.deriveEntitySeoScore(input, { ...score, seo_score_version: ENTITY_SEO_SCORE_VERSION + 1 }), score, "A version mismatch must recalculate via the owner.");
assert.deepEqual(owner.toTopicSeoScoreInput({ ...row, faq: [{ question: "أين؟", answer: "هنا" }] }), input);
assert.deepEqual(input.seoKeywords, row.seo_keywords, "The canonical input preserves the editor's keywords; normalization remains in analyzeEntitySeo.");
assert.notEqual(owner.deriveEntitySeoScore({ ...input, slug: "venisia-copy" }).seo_score_input_hash, score.seo_score_input_hash);
assert.equal(owner.entitySeoInputHash(owner.toTopicSeoScoreInput({ ...row, ...{ is_featured: true, status: "published", views_count: 100 } })), score.seo_score_input_hash);
assert.equal(owner.toTopicSeoScoreInput({ ...row, content_type: "news" }).profile, "entity");
assert.equal(owner.entitySeoInputHash(owner.toTopicSeoScoreInput({ ...row, content_type: "news" })), owner.entitySeoInputHash(owner.toTopicSeoScoreInput({ ...row, content_type: "press" })));
assert.throws(() => owner.toTopicSeoScoreInput({ ...row, faq: [{ question: "invalid" }] }), /FAQ/);
assert.throws(() => owner.toTopicSeoScoreInput({ ...row, content_type: "unknown" }), /profile/);
assert.equal(isPersistedEntitySeoScore({ ...score, seo_score: 101 }), false);
assert.equal(isPersistedEntitySeoScore({ ...score, seo_score_input_hash: null }), false);
assert.deepEqual(PERSISTED_ENTITY_SEO_FIELDS, ["seo_score", "seo_score_version", "seo_score_input_hash"]);

assertIsolatedSeoBackfillTarget("postgresql://test@127.0.0.1:55445/entity_seo_test", "entity_seo_test");
assert.throws(() => assertIsolatedSeoBackfillTarget("postgresql://test@db.example.com/entity_seo_test", "entity_seo_test"), /Remote/);
assert.throws(() => assertIsolatedSeoBackfillTarget("postgresql://test@127.0.0.1/production", "entity_seo_test"), /identity/);

const schema = readFileSync(resolve(ROOT, "sql/migrations/20260914004050_entity_seo_persisted_score.sql"), "utf8");
assert.match(schema, /deferrable initially deferred/u);
assert.doesNotMatch(schema, /analyzeEntitySeo\s*\(|keywordDensity|readinessScore|seoScore\s*\*/u, "SQL must not implement the SEO algorithm.");
console.log(`Entity SEO persistence: ${eligible.length - gaps.length} adopted surfaces, ${gaps.length} explicit semantic resolver gap; executable ownership, provenance, invariance, failure and isolated-target checks passed.`);
