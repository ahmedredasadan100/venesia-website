import "server-only";

import { PUBLIC_CONTENT_VISIBILITY_CONTRACT } from "../content-public-visibility";
import { getSupabaseAdmin } from "../supabase-admin";
import {
  countEntriesBySource,
  generateSitemapEntries,
  resolveCanonicalBaseUrl,
} from "./generate-sitemap-entries";
import type {
  SitemapCheckItem,
  SitemapEntry,
  SitemapExcludedCounts,
  SitemapMonitorSnapshot,
} from "./sitemap-monitor-types";

function isValidAbsoluteUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function summarize(samples: string[], limit = 5) {
  return samples.slice(0, limit);
}

async function loadExcludedCounts(): Promise<SitemapExcludedCounts> {
  const supabase = getSupabaseAdmin();

  const [
    unpublishedProjects,
    unpublishedTopics,
    unpublishedMediaTopics,
    deletedTopics,
    deletedMediaTopics,
    missingSlugTopics,
    missingSlugProjects,
    noindexProjects,
    noindexTopics,
    noindexPages,
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .neq("publication_status", PUBLIC_CONTENT_VISIBILITY_CONTRACT.status),
    supabase
      .from("topics")
      .select("id", { count: "exact", head: true })
      .eq("content_type", "article")
      .neq("status", PUBLIC_CONTENT_VISIBILITY_CONTRACT.status)
      .is("deleted_at", PUBLIC_CONTENT_VISIBILITY_CONTRACT.deletedAt),
    supabase
      .from("topics")
      .select("id", { count: "exact", head: true })
      .neq("content_type", "article")
      .neq("status", PUBLIC_CONTENT_VISIBILITY_CONTRACT.status)
      .is("deleted_at", PUBLIC_CONTENT_VISIBILITY_CONTRACT.deletedAt),
    supabase
      .from("topics")
      .select("id", { count: "exact", head: true })
      .not("deleted_at", "is", null),
    supabase
      .from("topics")
      .select("id", { count: "exact", head: true })
      .neq("content_type", "article")
      .not("deleted_at", "is", null),
    supabase
      .from("topics")
      .select("id", { count: "exact", head: true })
      .or("slug.is.null,slug.eq."),
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .or("slug.is.null,slug.eq."),
    supabase.from("projects").select("id", { count: "exact", head: true })
      .eq("publication_status", PUBLIC_CONTENT_VISIBILITY_CONTRACT.status)
      .eq("robots_index", false),
    supabase.from("topics").select("id", { count: "exact", head: true })
      .eq("status", PUBLIC_CONTENT_VISIBILITY_CONTRACT.status).is("deleted_at", PUBLIC_CONTENT_VISIBILITY_CONTRACT.deletedAt).eq("robots_index", false),
    supabase.from("pages").select("id", { count: "exact", head: true })
      .eq("status", PUBLIC_CONTENT_VISIBILITY_CONTRACT.status).eq("robots_index", false),
  ]);

  const failed = [
    unpublishedProjects,
    unpublishedTopics,
    unpublishedMediaTopics,
    deletedTopics,
    deletedMediaTopics,
    missingSlugTopics,
    missingSlugProjects,
    noindexProjects,
    noindexTopics,
    noindexPages,
  ].find((result) => result.error);
  if (failed?.error) throw new Error(failed.error.message);

  const unpublished =
    (unpublishedProjects.count ?? 0) +
    (unpublishedTopics.count ?? 0) +
    (unpublishedMediaTopics.count ?? 0);

  const deleted = deletedTopics.count ?? 0;

  const invalidOrMissingSlug = (missingSlugTopics.count ?? 0) + (missingSlugProjects.count ?? 0);

  return {
    unpublished,
    deleted,
    noindex: (noindexProjects.count ?? 0) + (noindexTopics.count ?? 0) + (noindexPages.count ?? 0),
    invalidOrMissingSlug,
  };
}

async function findMissingPublishedRecords(entries: SitemapEntry[]) {
  const sitemapPaths = new Set(entries.map((entry) => entry.path));
  const missing: string[] = [];

  const { data: projects, error: projectsError } = await getSupabaseAdmin()
    .from("projects")
    .select("slug,robots_index")
    .eq("publication_status", PUBLIC_CONTENT_VISIBILITY_CONTRACT.status)
    .not("slug", "is", null);

  if (projectsError) throw new Error(projectsError.message);
  for (const project of projects ?? []) {
    if (project.robots_index === false) continue;
    const path = `/projects/${project.slug}`;
    if (!sitemapPaths.has(path)) {
      missing.push(path);
    }
  }

  const { data: topics, error: topicsError } = await getSupabaseAdmin()
    .from("topics")
    .select("slug,robots_index")
    .eq("content_type", "article")
    .eq("status", PUBLIC_CONTENT_VISIBILITY_CONTRACT.status)
    .is("deleted_at", PUBLIC_CONTENT_VISIBILITY_CONTRACT.deletedAt)
    .not("slug", "is", null);

  if (topicsError) throw new Error(topicsError.message);
  for (const topic of topics ?? []) {
    if (topic.robots_index === false) continue;
    const path = `/topics/${topic.slug}`;
    if (!sitemapPaths.has(path)) {
      missing.push(path);
    }
  }

  return missing;
}

async function findUnpublishedSitemapTargets(entries: SitemapEntry[]) {
  const invalid: string[] = [];

  const projectEntries = entries.filter((entry) => entry.source === "projects" && entry.entityId);
  const topicEntries = entries.filter(
    (entry) => (entry.source === "articles" || entry.source === "media") && entry.entityId,
  );
  const pageEntries = entries.filter((entry) => entry.source === "cms_pages" && entry.entityId);
  const supabase = getSupabaseAdmin();
  const [projects, topics, pages] = await Promise.all([
    projectEntries.length
      ? supabase.from("projects").select("id,publication_status").in("id", projectEntries.map((entry) => entry.entityId!))
      : Promise.resolve({ data: [], error: null }),
    topicEntries.length
      ? supabase.from("topics").select("id,status,deleted_at").in("id", topicEntries.map((entry) => entry.entityId!))
      : Promise.resolve({ data: [], error: null }),
    pageEntries.length
      ? supabase.from("pages").select("id,status").in("id", pageEntries.map((entry) => entry.entityId!))
      : Promise.resolve({ data: [], error: null }),
  ]);
  const error = projects.error ?? topics.error ?? pages.error;
  if (error) throw new Error(error.message);

  const projectStatus = new Map((projects.data ?? []).map((row) => [String(row.id), row.publication_status]));
  const topicStatus = new Map((topics.data ?? []).map((row) => [String(row.id), row]));
  const pageStatus = new Map((pages.data ?? []).map((row) => [String(row.id), row.status]));
  for (const entry of projectEntries) {
    if (projectStatus.get(String(entry.entityId)) !== PUBLIC_CONTENT_VISIBILITY_CONTRACT.status) invalid.push(entry.path);
  }
  for (const entry of topicEntries) {
    const row = topicStatus.get(String(entry.entityId));
    if (!row || row.status !== PUBLIC_CONTENT_VISIBILITY_CONTRACT.status || row.deleted_at) invalid.push(entry.path);
  }
  for (const entry of pageEntries) {
    if (pageStatus.get(String(entry.entityId)) !== PUBLIC_CONTENT_VISIBILITY_CONTRACT.status) invalid.push(entry.path);
  }

  return invalid;
}

function resolveOverallStatus(checks: SitemapCheckItem[]): SitemapMonitorSnapshot["status"] {
  if (checks.some((check) => check.severity === "error")) return "error";
  if (checks.some((check) => check.severity === "warning")) return "warning";
  return "healthy";
}

export async function runSitemapDiagnostics(): Promise<SitemapMonitorSnapshot> {
  const checkedAt = new Date().toISOString();
  const generation = await generateSitemapEntries();
  const canonicalBase = await resolveCanonicalBaseUrl();
  const checks: SitemapCheckItem[] = [];

  if (generation.error) {
    checks.push({
      id: "generation_failure",
      severity: "error",
      title: "فشل توليد Sitemap",
      detail: generation.error,
    });
  }

  const entries = generation.entries;
  const countsBySource = countEntriesBySource(entries);
  let excludedCounts: SitemapExcludedCounts;
  try {
    excludedCounts = await loadExcludedCounts();
  } catch (error) {
    excludedCounts = { unpublished: 0, deleted: 0, noindex: 0, invalidOrMissingSlug: 0 };
    checks.push({
      id: "excluded_counts_failure",
      severity: "error",
      title: "تعذر فحص السجلات المستبعدة",
      detail: error instanceof Error ? error.message : "Unknown database failure",
    });
  }

  if (entries.length === 0) {
    checks.push({
      id: "empty_sitemap",
      severity: "error",
      title: "Sitemap فارغ",
      detail: "لم يتم العثور على أي عناوين URL في ملف Sitemap الحالي.",
    });
  }

  const duplicateUrls = generation.duplicateUrls;
  if (duplicateUrls.length > 0) {
    checks.push({
      id: "duplicate_urls",
      severity: "error",
      title: "عناوين URL مكررة",
      detail: "يوجد أكثر من إدخال لنفس عنوان URL داخل Sitemap.",
      count: duplicateUrls.length,
      samples: summarize(duplicateUrls),
    });
  }

  const invalidUrls = entries.filter((entry) => !isValidAbsoluteUrl(entry.url)).map((entry) => entry.url);
  if (invalidUrls.length > 0) {
    checks.push({
      id: "invalid_url_format",
      severity: "error",
      title: "تنسيق URL غير صالح",
      detail: "بعض عناوين Sitemap لا تستخدم http/https بشكل صالح.",
      count: invalidUrls.length,
      samples: summarize(invalidUrls),
    });
  }

  const outsideDomain = entries
    .filter((entry) => {
      try {
        const parsed = new URL(entry.url);
        const canonical = new URL(canonicalBase);
        return parsed.origin !== canonical.origin;
      } catch {
        return true;
      }
    })
    .map((entry) => entry.url);

  if (outsideDomain.length > 0) {
    checks.push({
      id: "outside_canonical_domain",
      severity: "warning",
      title: "عناوين خارج النطاق الأساسي",
      detail: `بعض العناوين لا تطابق النطاق الأساسي الحالي (${canonicalBase}).`,
      count: outsideDomain.length,
      samples: summarize(outsideDomain),
    });
  }

  let missingPublished: string[] = [];
  try {
    missingPublished = await findMissingPublishedRecords(entries);
  } catch (error) {
    checks.push({ id: "missing_published_query", severity: "error", title: "تعذر فحص السجلات المنشورة", detail: error instanceof Error ? error.message : "Unknown database failure" });
  }
  if (missingPublished.length > 0) {
    checks.push({
      id: "missing_published_records",
      severity: "warning",
      title: "سجلات منشورة غير موجودة في Sitemap",
      detail: "توجد سجلات منشورة يمكن اكتشافها لكنها غير مدرجة في Sitemap الحالي.",
      count: missingPublished.length,
      samples: summarize(missingPublished),
    });
  }

  let unpublishedTargets: string[] = [];
  try {
    unpublishedTargets = await findUnpublishedSitemapTargets(entries);
  } catch (error) {
    checks.push({ id: "unpublished_targets_query", severity: "error", title: "تعذر فحص حالة أهداف Sitemap", detail: error instanceof Error ? error.message : "Unknown database failure" });
  }
  if (unpublishedTargets.length > 0) {
    checks.push({
      id: "unpublished_targets",
      severity: "error",
      title: "عناوين Sitemap تشير إلى محتوى غير منشور",
      detail: "بعض عناوين Sitemap لا تطابق سجلات منشورة حاليًا.",
      count: unpublishedTargets.length,
      samples: summarize(unpublishedTargets),
    });
  }

  const canonicalMismatches = entries
    .filter((entry) => {
      if (!entry.canonicalOverride) return false;
      return entry.canonicalOverride.replace(/\/$/, "") !== entry.url.replace(/\/$/, "");
    })
    .map((entry) => `${entry.path} → ${entry.canonicalOverride}`);
  if (canonicalMismatches.length > 0) {
    checks.push({
      id: "canonical_product_decision",
      severity: "warning",
      title: "Canonical drift يحتاج Product Decision",
      detail: "اكتُشفت Canonical overrides تختلف عن عنوان Sitemap. التشخيص فقط؛ هذه المرحلة لا تعدل القيم الحية.",
      count: canonicalMismatches.length,
      samples: summarize(canonicalMismatches),
    });
  }

  if (checks.length === 0) {
    checks.push({
      id: "healthy",
      severity: "info",
      title: "لا توجد مشكلات مكتشفة",
      detail: "فحص Sitemap الحالي لم يكتشف مشكلات في النطاق المدعوم حاليًا.",
    });
  }

  return {
    status: generation.error ? "error" : resolveOverallStatus(checks),
    checkedAt,
    generationMode: generation.generationMode,
    generationError: generation.error,
    totalUrlCount: entries.length,
    countsBySource,
    excludedCounts,
    checks,
    googleSearchConsoleStatus: "not_connected",
  };
}
