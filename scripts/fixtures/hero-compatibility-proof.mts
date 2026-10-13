import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { assertOwnedLocalHandle, type OwnedLocalHandle } from "../lib/isolated-supabase.mts";

type Row = Record<string, unknown>;
type Config = Record<string, unknown>;
type Target = { id: number; slug: string };
export const HERO_RICH_DESCRIPTION = '<p>وصف <strong>منسق محفوظ</strong> مع <a href="/contact">رابط التواصل</a>.</p><p>فقرة ثانية<br />وسطر محفوظ.</p>';
export const HERO_EDITED_DESCRIPTION = 'وصف جديد مقصود';
export const HERO_CTA_PROOF = {
  primary: { label: "QA الزر الأساسي", title: "من نحن", href: "/about", routeKey: "about", anchor: "hero-primary" },
  secondary: { label: "QA الزر الثانوي", title: "تواصل معنا", href: "/contact", routeKey: "contact", anchor: "hero-secondary" },
} as const;
export const HERO_CHECKPOINTS = [
  "home-baseline", "home-unsaved", "home-invalid", "home-preserved", "home-edited", "home-right",
  "internal-preserved", "detail-legacy-baseline", "detail-legacy-saved", "detail-partial-seed", "detail-partial-saved",
  "detail-snake-seed", "detail-snake-saved", "detail-modern-seed", "detail-modern-saved", "detail-right", "hub-preserved",
  "home-cta-selected", "home-cta-primary-cleared", "home-cta-secondary-cleared", "home-cta-restored",
  "internal-cta-selected", "internal-cta-primary-cleared", "internal-cta-secondary-cleared", "internal-cta-restored",
] as const;
export type HeroProofFixtures = {
  home: Target; internal: Target; detail: Target; hub: Target; project: Target;
  richDescription: string; editedDescription: string; checkpoints: readonly string[];
  cta: typeof HERO_CTA_PROOF;
};

/** Seed data only through the live canonical isolated lifecycle. No production input. */
export async function prepareHeroCompatibilityFixtures(handle: OwnedLocalHandle, admin: Record<string, unknown>): Promise<HeroProofFixtures> {
  assertOwnedLocalHandle(handle);
  const project = admin.project as Target;
  assert.ok(Number.isSafeInteger(project.id) && project.slug === "qa-admin-complete-project");
  const image = String((await handle.query("select hero_image from public.projects where id=$1", [project.id])).rows[0].hero_image);
  const generic = { title: "QA Hero Fidelity", subtitle: "عنوان فرعي مستقل", description: HERO_RICH_DESCRIPTION,
    descriptionAlignment: "justify", images: [image], mobileImages: [image], showCta: false };
  const insert = async (variant: string, slug: string, config: Config): Promise<Target> => {
    const result = await handle.query("insert into public.hero_templates(name,slug,variant,status,is_visible,source_type,config) values($1,$2,$3,'unpublished',false,$4,$5::jsonb) returning id,slug",
      ["QA Hero Compatibility " + variant, slug, variant, variant === "project-detail" ? "domain-backed" : "manual", JSON.stringify(config)]);
    return { id: Number(result.rows[0].id), slug: String(result.rows[0].slug) };
  };
  const home = await insert("home-cinematic", "qa-hero-compatibility-home", generic);
  const internal = await insert("internal-page", "qa-hero-compatibility-internal", generic);
  const detailConfig = { showCta: false, descriptionAlignment: "justify", ctaAlignment: "left", projectActionOrder: ["reservation", "download", "tracking"] };
  const existing = (await handle.query("select id from public.hero_templates where variant='project-detail' order by id")).rows;
  assert.ok(existing.length <= 1, "Do not introduce or conceal duplicate Project Detail variants.");
  let detail: Target;
  if (existing.length) {
    const result = await handle.query("update public.hero_templates set name='QA Hero Compatibility Detail',slug='qa-hero-compatibility-detail',status='unpublished',is_visible=false,config=$1::jsonb where id=$2 returning id,slug", [JSON.stringify(detailConfig), existing[0].id]);
    detail = { id: Number(result.rows[0].id), slug: String(result.rows[0].slug) };
  } else detail = await insert("project-detail", "qa-hero-compatibility-detail", detailConfig);
  const hubConfig = { selectionMode: "domain_projects", projectType: "residential", variant: "projects-hub", limit: 1,
    autoplayMs: 60000, emptyState: null, descriptionAlignment: "justify", showDescription: true, showCta: false };
  const hubResult = await handle.query("update public.content_block_templates set status='unpublished',config=$1::jsonb where slug='projects-hub-hero' returning id,slug", [JSON.stringify(hubConfig)]);
  assert.equal(hubResult.rows.length, 1, "Canonical Projects Hub seed must exist.");
  return { home, internal, detail, hub: { id: Number(hubResult.rows[0].id), slug: String(hubResult.rows[0].slug) },
    project, richDescription: HERO_RICH_DESCRIPTION, editedDescription: HERO_EDITED_DESCRIPTION, checkpoints: HERO_CHECKPOINTS,
    cta: HERO_CTA_PROOF };
}

/** Fixed private checkpoints: only the owning lifecycle may seed/read the synthetic rows. */
export async function runHeroCompatibilityCheckpoints<T>(handle: OwnedLocalHandle, directory: string, fixtures: HeroProofFixtures, run: () => Promise<T>) {
  assertOwnedLocalHandle(handle);
  const control = join(directory, "hero-compatibility-control"); mkdirSync(control);
  writeFileSync(join(directory, "hero-compatibility-fixtures.json"), JSON.stringify(fixtures), { flag: "wx" });
  let cursor = 0;
  let pending = Promise.resolve();
  let busy = false;
  let failure: unknown;
  let homeBaseline: Row | undefined;
  const receipts: Row[] = [];
  const processCheckpoint = async () => {
    const id = HERO_CHECKPOINTS[cursor];
    if (!id || !existsSync(join(control, id + ".request.json"))) return;
    assert.deepEqual(JSON.parse(readFileSync(join(control, id + ".request.json"), "utf8")), { id });
    const response = await handle.withDatabaseConnection(async connection => {
      const kind = id.split("-")[0] as "home" | "internal" | "detail" | "hub";
      const target = fixtures[kind]; const table = kind === "hub" ? "content_block_templates" : "hero_templates";
      const read = async () => {
        const result = await connection.query("select * from public." + table + " where id=$1 and slug=$2", [target.id, target.slug]);
        assert.equal(result.rows.length, 1); return result.rows[0] as Row;
      };
      if (id.endsWith("-seed")) {
        const raw = { ...((await read()).config as Config) };
        for (const key of ["showProjectDownloadAction", "showProjectTrackingAction", "showProjectReservationAction", "show_project_download_action", "show_project_tracking_action", "show_project_reservation_action", "showCta", "show_cta"]) delete raw[key];
        Object.assign(raw, id === "detail-snake-seed" ? { show_cta: false, show_project_reservation_action: true }
          : id === "detail-partial-seed" ? { showCta: false, showProjectTrackingAction: true }
          : { showCta: false, showProjectDownloadAction: true, showProjectTrackingAction: false, showProjectReservationAction: true });
        await connection.query("update public.hero_templates set config=$1::jsonb,updated_at=clock_timestamp() where id=$2 and slug=$3", [JSON.stringify(raw), target.id, target.slug]);
      }
      const row = await read(); const config = row.config as Config;
      if (id === "home-baseline") homeBaseline = row;
      if (id === "home-unsaved" || id === "home-invalid") assert.deepEqual(row, homeBaseline, "Unsubmitted/rejected input must not change the native row.");
      if (id === "home-preserved" || id === "internal-preserved") assert.equal(config.description, HERO_RICH_DESCRIPTION);
      if (id === "home-edited" || id === "home-right") assert.equal(config.description, "<p>" + HERO_EDITED_DESCRIPTION + "</p>");
      const ctaCheckpoint = id.includes("-cta-");
      assert.equal(config.descriptionAlignment, id === "home-right" || id === "detail-right" || (kind === "home" && ctaCheckpoint) ? "right" : "justify");
      if (ctaCheckpoint) {
        assert.ok(kind === "home" || kind === "internal");
        assert.equal(config.description, kind === "home" ? "<p>" + HERO_EDITED_DESCRIPTION + "</p>" : HERO_RICH_DESCRIPTION,
          "CTA authoring must not change the existing rich-description compatibility result.");
        const selected = id.endsWith("-selected") || id.endsWith("-restored");
        for (const slot of ["primary", "secondary"] as const) {
          const expectedLink = fixtures.cta[slot];
          assert.equal(config[slot + "CtaLabel"], expectedLink.label);
          const hasLink = selected || (slot === "secondary" && id.endsWith("-primary-cleared"));
          assert.deepEqual(config[slot + "CtaLink"], hasLink ? {
            link_kind: "static_route", linked_type: "static_routes", linked_id: null,
            href: expectedLink.href, anchor: expectedLink.anchor, target: "_self", meta: { route_key: expectedLink.routeKey },
          } : null, "Native CTA link must match the authored value or canonical clear result.");
        }
        assert.equal(config.showCta, selected);
        assert.equal(config.ctaBold, selected);
        assert.equal(config.ctaAlignment, selected ? "left" : "center");
      }
      const expected = id === "detail-legacy-saved" ? [false, false, false] : id === "detail-partial-saved" ? [false, true, false]
        : id === "detail-snake-saved" ? [false, false, true] : id === "detail-modern-saved" || id === "detail-right" ? [true, false, true] : undefined;
      if (expected) {
        assert.deepEqual([config.showProjectDownloadAction, config.showProjectTrackingAction, config.showProjectReservationAction], expected);
        assert.deepEqual(config.projectActionOrder, ["reservation", "download", "tracking"]);
        assert.equal(config.ctaAlignment, "left");
      }
      return { id, status: "pass", table, templateId: target.id, config, nativeReadback: true, seeded: id.endsWith("-seed") };
    });
    receipts.push(response); cursor++;
    const temporary = join(control, id + ".response.tmp");
    writeFileSync(temporary, JSON.stringify(response), { flag: "wx" }); renameSync(temporary, join(control, id + ".response.json"));
  };
  const timer = setInterval(() => {
    if (busy || failure) return; busy = true;
    pending = processCheckpoint().catch(error => {
      failure = error;
      const id = HERO_CHECKPOINTS[cursor];
      writeFileSync(join(control, id + ".response.json"), JSON.stringify({ id, status: "fail", reason: "Native isolated Hero checkpoint failed." }), { flag: "wx" });
    }).finally(() => { busy = false; });
  }, 150);
  try {
    const result = await run(); await pending;
    if (failure) throw failure;
    assert.equal(cursor, HERO_CHECKPOINTS.length, "Every fixed Hero scenario requires native readback.");
    writeFileSync(join(directory, "hero-compatibility-native-proof.json"), JSON.stringify({ status: "pass", receipts, productionAccess: false }, null, 2), { flag: "wx" });
    return result;
  } finally { clearInterval(timer); await pending; }
}
