import "server-only";

import { getSupabaseAdmin } from "../../supabase-admin";
import { MEDIA_LIST_CONTENT_TYPES } from "../../../app/admin/content/media/media-content-config";

export type MediaUsageHit = {
  entityType: string;
  entityLabel: string;
  field: string;
  editHref: string | null;
};

type SearchNeedles = {
  full: string;
  path: string;
  filename: string;
};

function tryParsePath(value: string) {
  try {
    if (value.startsWith("http://") || value.startsWith("https://")) {
      return new URL(value).pathname;
    }
  } catch {
    return value;
  }
  return value;
}

export function buildAssetSearchNeedles(assetUrl: string): SearchNeedles | null {
  const full = assetUrl.trim();
  if (!full) return null;

  const path = tryParsePath(full);
  const filename = path.split("/").pop() ?? full.split("/").pop() ?? "";
  if (!filename || filename.length < 3) return null;

  return { full, path, filename };
}

function haystackContains(haystack: string | null | undefined, needles: SearchNeedles) {
  if (!haystack) return false;
  const value = haystack.toLowerCase();
  return (
    value.includes(needles.full.toLowerCase()) ||
    value.includes(needles.path.toLowerCase()) ||
    value.includes(needles.filename.toLowerCase())
  );
}

function pushHit(hits: MediaUsageHit[], hit: MediaUsageHit) {
  const key = `${hit.entityType}:${hit.editHref}:${hit.field}`;
  if (hits.some((existing) => `${existing.entityType}:${existing.editHref}:${existing.field}` === key)) {
    return;
  }
  hits.push(hit);
}

function scanJsonValue(
  hits: MediaUsageHit[],
  needles: SearchNeedles,
  entityType: string,
  entityLabel: string,
  editHref: string | null,
  field: string,
  value: unknown,
) {
  if (value == null) return;
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  if (haystackContains(serialized, needles)) {
    pushHit(hits, { entityType, entityLabel, field, editHref });
  }
}

export async function scanMediaAssetUsage(assetUrl: string): Promise<MediaUsageHit[]> {
  const needles = buildAssetSearchNeedles(assetUrl);
  if (!needles) return [];

  const hits: MediaUsageHit[] = [];
  const supabase = getSupabaseAdmin();

  const [{ data: topics }, { data: projects }, { data: mediaItems }, { data: heroTemplates }, { data: contentBlocks }, { data: settings }] =
    await Promise.all([
      supabase
        .from("topics")
        .select("id, title, slug, content_type, image, image_alt, excerpt, content, media_payload")
        .is("deleted_at", null)
        .limit(500),
      supabase
        .from("projects")
        .select(
          "id, name, slug, image, hero_image, og_image, district_image, overview_video_image, brochure_url",
        )
        .limit(300),
      supabase.from("media_items").select("id, title, slug, type, image").limit(300),
      supabase.from("hero_templates").select("id, name, slug, config").limit(120),
      supabase.from("content_block_templates").select("id, name, slug, config").limit(200),
      supabase
        .from("site_settings")
        .select("key, value")
        .in("key", ["footer_brand", "footer_slots", "footer_social_links"]),
    ]);

  for (const topic of topics ?? []) {
    const isUnifiedMedia = MEDIA_LIST_CONTENT_TYPES.includes(
      topic.content_type as (typeof MEDIA_LIST_CONTENT_TYPES)[number],
    );
    const editHref = isUnifiedMedia
      ? `/admin/content/media/${topic.id}`
      : `/admin/topics/${topic.id}`;
    const entityType = isUnifiedMedia ? "محتوى إعلامي موحد" : "موضوع";

    if (haystackContains(topic.image, needles)) {
      pushHit(hits, {
        entityType,
        entityLabel: topic.title || topic.slug || `#${topic.id}`,
        field: "image",
        editHref,
      });
    }
    if (haystackContains(topic.excerpt, needles)) {
      pushHit(hits, { entityType, entityLabel: topic.title || `#${topic.id}`, field: "excerpt", editHref });
    }
    if (haystackContains(topic.content, needles)) {
      pushHit(hits, { entityType, entityLabel: topic.title || `#${topic.id}`, field: "content", editHref });
    }
    scanJsonValue(hits, needles, entityType, topic.title || `#${topic.id}`, editHref, "media_payload", topic.media_payload);
  }

  for (const project of projects ?? []) {
    const editHref = `/admin/projects/${project.id}`;
    const label = project.name || project.slug || `#${project.id}`;
    const fields: Array<[string, string | null | undefined]> = [
      ["image", project.image],
      ["hero_image", project.hero_image],
      ["og_image", project.og_image],
      ["district_image", project.district_image],
      ["overview_video_image", project.overview_video_image],
      ["brochure_url", project.brochure_url],
    ];

    for (const [field, value] of fields) {
      if (haystackContains(value, needles)) {
        pushHit(hits, { entityType: "مشروع", entityLabel: label, field, editHref });
      }
    }
  }

  for (const item of mediaItems ?? []) {
    if (haystackContains(item.image, needles)) {
      pushHit(hits, {
        entityType: "مركز إعلامي (قديم)",
        entityLabel: item.title || item.slug || `#${item.id}`,
        field: "image",
        editHref: `/admin/media-center/items/${item.id}`,
      });
    }
  }

  for (const hero of heroTemplates ?? []) {
    scanJsonValue(
      hits,
      needles,
      "قالب Hero",
      hero.name || hero.slug || `#${hero.id}`,
      `/admin/pages-blocks/blocks/hero/${hero.id}`,
      "config",
      hero.config,
    );
  }

  for (const block of contentBlocks ?? []) {
    scanJsonValue(
      hits,
      needles,
      "كتلة محتوى",
      block.name || block.slug || `#${block.id}`,
      `/admin/pages-blocks/blocks/content/${block.id}`,
      "config",
      block.config,
    );
  }

  for (const setting of settings ?? []) {
    scanJsonValue(
      hits,
      needles,
      "إعدادات الموقع",
      setting.key,
      setting.key.startsWith("footer") ? "/admin/pages-blocks/footer" : "/admin/settings/general",
      "value",
      setting.value,
    );
  }

  return hits;
}
