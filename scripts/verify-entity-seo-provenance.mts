import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { loadEntitySeoPersistenceOwner } from "./backfill-entity-seo-scores.mts";
import type { Json } from "../src/lib/database.types.ts";
import type { ProjectSeoSource, TopicSeoSource } from "../src/lib/admin/seo/entity-seo-persistence.ts";

// Execute the actual SQL provenance functions and deferred validation in an
// ephemeral PostgreSQL engine. These fixtures never open a project database.
const source = readFileSync(new URL("../sql/migrations/20260914004050_entity_seo_persisted_score.sql", import.meta.url), "utf8");
const owner = loadEntitySeoPersistenceOwner();
const db = new PGlite();
let assertions = 0;
const whitespace = [
  0x0009, 0x000a, 0x000b, 0x000c, 0x000d, 0x0020, 0x00a0, 0x1680,
  0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007,
  0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff,
].map((code) => String.fromCodePoint(code));
const project: ProjectSeoSource = {
  arabic_name: "The complete guide to choosing a new coastal home",
  general_description: "Learn how to choose a coastal home with useful details about the surrounding services, nearby facilities, public transport and available homes.",
  overview_body: "Choosing a coastal home depends on nearby facilities and services.",
  slug: "coastal-home", hero_image: "/fixture.jpg", hero_image_alt: "A coastal home",
  seo_title: "", seo_description: "", seo_keywords: ["coastal home"], focus_keyword: "coastal home",
};

async function hashParity(entity: "topics" | "projects", row: TopicSeoSource | ProjectSeoSource) {
  const input = entity === "topics" ? owner.toTopicSeoScoreInput(row as TopicSeoSource) : owner.toProjectSeoScoreInput(row);
  const result = await db.query<{ hash: string; source: Record<string, Json> }>(
    "select public.entity_seo_score_input_hash($1, $2::jsonb) as hash, public.entity_seo_score_source($1, $2::jsonb) as source",
    [entity, JSON.stringify(row)],
  );
  assert.equal(result.rows[0].hash, owner.entitySeoInputHash(input), `${entity} SQL/TypeScript fingerprint drift`);
  assertions++;
  return { input, source: result.rows[0].source };
}

try {
  for (const name of ["entity_seo_score_source", "entity_seo_score_input_hash", "check_entity_seo_score_write"]) {
    const statement = source.match(new RegExp(`create function public\\.${name}\\([\\s\\S]*?\\$function\\$;`))?.[0];
    assert.ok(statement, `Missing actual SQL function ${name}`);
    await db.exec(statement);
  }
  const initial = await hashParity("projects", project);
  assert.equal(initial.input.seoTitle, project.arabic_name);
  assert.equal(initial.input.seoDescription, project.general_description);
  assert.equal(owner.deriveEntitySeoScore(initial.input).seo_score, 100, "Project base fallbacks retain the current editor's score.");
  assertions++;

  for (const space of whitespace) {
    const explicit = await hashParity("projects", {
      ...project, seo_title: `${space}عنوان${space}${space}المشروع${space}`,
      seo_description: `${space}وصف${space}${space}المشروع${space}`,
    });
    assert.equal(explicit.input.seoTitle, "عنوان المشروع");
    assert.equal(explicit.source.seo_title, "عنوان المشروع");
    assert.equal(explicit.input.seoDescription, `وصف${space}${space}المشروع`);
    assert.equal(explicit.source.seo_description, `وصف${space}${space}المشروع`);
    const fallback = await hashParity("projects", {
      ...project, seo_title: space, seo_description: space,
      arabic_name: `${space}عنوان${space}${space}أساسي${space}`,
      general_description: `${space}وصف${space}${space}أساسي${space}`,
    });
    assert.equal(fallback.input.seoTitle, "عنوان أساسي");
    assert.equal(fallback.input.seoDescription, `وصف${space}${space}أساسي`);
  }
  await hashParity("projects", { ...project, seo_title: null, seo_description: null });
  await hashParity("projects", { ...project, arabic_name: null, general_description: null, seo_title: null, seo_description: null });
  const nonWhitespace = "\u0085\u180e\u200b";
  const retained = await hashParity("projects", { ...project, seo_title: nonWhitespace, seo_description: nonWhitespace });
  assert.equal(retained.source.seo_title, nonWhitespace, "Characters outside ECMAScript whitespace must remain inputs.");
  assert.equal(retained.source.seo_description, nonWhitespace);

  const topic: TopicSeoSource = { content_type: "article", title: "عنوان", excerpt: "وصف", seo_title: "", seo_description: "", faq: null };
  const resolvedTopic = await hashParity("topics", topic);
  assert.equal(resolvedTopic.input.seoTitle, "عنوان", "Topics adopt the shared editor's effective input.");
  assert.equal(resolvedTopic.input.seoDescription, "وصف");
  const emptyFaq = await hashParity("topics", { ...topic, faq: [] });
  assert.equal(owner.entitySeoInputHash(resolvedTopic.input), owner.entitySeoInputHash(emptyFaq.input));
  const extraFaq = await hashParity("topics", { ...topic, faq: [{ question: "أين؟", answer: "هنا 🏠", extra: "ignored" }] });
  const cleanFaq = await hashParity("topics", { ...topic, faq: [{ question: "أين؟", answer: "هنا 🏠" }] });
  assert.deepEqual(extraFaq.source, cleanFaq.source);
  const news = await hashParity("topics", { ...topic, content_type: "news" });
  const press = await hashParity("topics", { ...topic, content_type: "press" });
  assert.deepEqual(news.source, press.source);
  for (const content_type of ["article", "news", "video", "gallery", "press", "site_update"]) {
    for (const space of whitespace) {
      const explicit = await hashParity("topics", { ...topic, content_type,
        seo_title: `${space}عنوان${space}${space}المحتوى${space}`,
        seo_description: `${space}وصف${space}${space}المحتوى${space}`,
        image: `${space}/fixture.jpg${space}`, image_alt: `${space}صورة${space}${space}المحتوى${space}`,
        seo_keywords: ["", " كلمة ", "كلمة"],
      });
      assert.equal(explicit.input.seoTitle, "عنوان المحتوى");
      assert.equal(explicit.input.seoDescription, `وصف${space}${space}المحتوى`);
      assert.equal(explicit.input.image, "/fixture.jpg");
      assert.equal(explicit.input.imageAlt, `صورة${space}${space}المحتوى`);
      const fallback = await hashParity("topics", { ...topic, content_type,
        seo_title: space, seo_description: space,
        title: `${space}عنوان${space}${space}أساسي${space}`,
        excerpt: `${space}وصف${space}${space}أساسي${space}`,
      });
      assert.equal(fallback.input.seoTitle, "عنوان أساسي");
      assert.equal(fallback.input.seoDescription, `وصف${space}${space}أساسي`);
    }
    await hashParity("topics", { content_type, title: null, excerpt: null, seo_title: null, seo_description: null, image: null, image_alt: null, faq: null, seo_keywords: null });
  }
  const mediaFaq = await hashParity("topics", { ...topic, content_type: "news", faq: [{ question: "أين؟", answer: "هنا" }] });
  assert.deepEqual(mediaFaq.input.faq, [], "Media editor declares no FAQ score input.");
  const projectImage = await hashParity("projects", { ...project, hero_image: "\uFEFF /fixture.jpg \u00A0", hero_image_alt: "\u202F وصف  صورة \u3000", seo_keywords: ["", " كلمة "] });
  assert.equal(projectImage.input.image, "/fixture.jpg");
  assert.equal(projectImage.input.imageAlt, "وصف  صورة");
  for (const content_type of ["video", "gallery"]) {
    const legacyBody = await hashParity("topics", { ...topic, content_type, content: "Legacy stored text is excluded by the rich editor body." });
    assert.equal(legacyBody.input.content, "");
    assert.equal(legacyBody.source.content, "");
  }

  await db.exec(`create table public.topics (
    id bigint primary key, content_type text, title text, faq jsonb,
    seo_score smallint, seo_score_version integer, seo_score_input_hash text
  );`);
  const validRow: TopicSeoSource = { content_type: "article", faq: [] };
  const tuple = owner.deriveEntitySeoScore(owner.toTopicSeoScoreInput(validRow));
  for (const [offset, invalidFaq] of [{}, "legacy", 42, true].entries()) {
    await db.query("insert into topics(id, content_type, faq) values ($1, 'article', $2::jsonb)", [offset + 1, JSON.stringify(invalidFaq)]);
  }
  await db.query("insert into topics values (5, 'article', null, '{}'::jsonb, $1, $2, $3)", [tuple.seo_score, tuple.seo_score_version, tuple.seo_score_input_hash]);
  await db.query("insert into topics values (6, 'article', null, '[]'::jsonb, $1, $2, $3)", [tuple.seo_score, tuple.seo_score_version, tuple.seo_score_input_hash]);
  await db.exec(`create constraint trigger fixture_seo_guard after update on topics
    deferrable initially deferred for each row execute function public.check_entity_seo_score_write();`);
  for (const id of [1, 2, 3, 4]) {
    await db.query("update topics set faq='[]', seo_score=$1, seo_score_version=$2, seo_score_input_hash=$3 where id=$4", [tuple.seo_score, tuple.seo_score_version, tuple.seo_score_input_hash, id]);
    const actual = await db.query<{ faq: Json; seo_score_input_hash: string }>("select faq, seo_score_input_hash from topics where id=$1", [id]);
    assert.deepEqual(actual.rows[0].faq, []);
    assert.equal(actual.rows[0].seo_score_input_hash, tuple.seo_score_input_hash);
    assertions++;
  }
  await assert.rejects(db.exec("update topics set faq='[]' where id=5"), /without a new derived score proof/);
  assertions++;
  for (const invalidFaq of [{}, [{ question: "Missing answer" }], [{ question: 42, answer: "Invalid question" }]]) {
    await assert.rejects(db.query("update topics set faq=$1::jsonb, seo_score_input_hash=$2 where id=6", [JSON.stringify(invalidFaq), "b".repeat(64)]));
    const unchanged = await db.query<{ faq: Json; seo_score_input_hash: string }>("select faq, seo_score_input_hash from topics where id=6");
    assert.deepEqual(unchanged.rows[0].faq, []);
    assert.equal(unchanged.rows[0].seo_score_input_hash, tuple.seo_score_input_hash);
    assertions++;
  }
  await db.exec("update topics set faq=null where id=6");
  await db.exec("update topics set faq='[]' where id=6");
  assertions++;
  console.log(`Entity SEO provenance verified (${assertions} SQL/TypeScript parity and atomic repair assertions; ephemeral PostgreSQL only).`);
} finally {
  await db.close();
}
