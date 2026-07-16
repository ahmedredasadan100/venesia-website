import "server-only";

import { getSupabaseAdmin } from "../supabase-admin";
import {
  buildSitemapAbsoluteUrl,
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
    trackNoindexPages,
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .neq("publication_status", "published"),
    supabase
      .from("topics")
      .select("id", { count: "exact", head: true })
      .eq("content_type", "article")
      .neq("status", "published")
      .is("deleted_at", null),
    supabase
      .from("topics")
      .select("id", { count: "exact", head: true })
      .neq("content_type", "article")
      .neq("status", "published")
      .is("deleted_at", null),
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
      .eq("content_type", "article")
      .or("slug.is.null,slug.eq."),
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .or("slug.is.null,slug.eq."),
    supabase
      .from("projects")
      .select("slug", { count: "exact", head: true })
      .eq("publication_status", "published")
      .not("slug", "is", null),
  ]);

  const unpublished =
    (unpublishedProjects.count ?? 0) +
    (unpublishedTopics.count ?? 0) +
    (unpublishedMediaTopics.count ?? 0);

  const deleted = (deletedTopics.count ?? 0) + (deletedMediaTopics.count ?? 0);

  const invalidOrMissingSlug = (missingSlugTopics.count ?? 0) + (missingSlugProjects.count ?? 0);

  return {
    unpublished,
    deleted,
    noindex: trackNoindexPages.count ?? 0,
    invalidOrMissingSlug,
  };
}

async function findMissingPublishedRecords(entries: SitemapEntry[]) {
  const sitemapPaths = new Set(entries.map((entry) => entry.path));
  const missing: string[] = [];

  const { data: projects } = await getSupabaseAdmin()
    .from("projects")
    .select("slug")
    .eq("publication_status", "published")
    .not("slug", "is", null);

  for (const project of projects ?? []) {
    const path = `/projects/${project.slug}`;
    if (!sitemapPaths.has(path)) {
      missing.push(path);
    }
  }

  const { data: topics } = await getSupabaseAdmin()
    .from("topics")
    .select("slug")
    .eq("content_type", "article")
    .eq("status", "published")
    .is("deleted_at", null)
    .not("slug", "is", null);

  for (const topic of topics ?? []) {
    const path = `/topics/${topic.slug}`;
    if (!sitemapPaths.has(path)) {
      missing.push(path);
    }
  }

  return missing;
}

async function findUnpublishedSitemapTargets(entries: SitemapEntry[]) {
  const invalid: string[] = [];

  for (const entry of entries) {
    if (entry.source === "projects" && entry.slug) {
      const { data } = await getSupabaseAdmin()
        .from("projects")
        .select("publication_status")
        .eq("slug", entry.slug)
        .maybeSingle<{ publication_status: string }>();
      if (!data || data.publication_status !== "published") {
        invalid.push(entry.path);
      }
      continue;
    }

    if (entry.source === "articles" && entry.slug) {
      const { data } = await getSupabaseAdmin()
        .from("topics")
        .select("status, deleted_at")
        .eq("slug", entry.slug)
        .eq("content_type", "article")
        .maybeSingle<{ status: string; deleted_at: string | null }>();
      if (!data || data.status !== "published" || data.deleted_at) {
        invalid.push(entry.path);
      }
    }
  }

  return invalid;
}

function findNoindexPathsInSitemap(entries: SitemapEntry[]) {
  return entries
    .filter((entry) => entry.path.startsWith("/track-your-project/") && entry.path !== "/track-your-project")
    .map((entry) => entry.path);
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
  const excludedCounts = await loadExcludedCounts().catch(() => ({
    unpublished: 0,
    deleted: 0,
    noindex: 0,
    invalidOrMissingSlug: 0,
  }));

  if (entries.length === 0) {
    checks.push({
      id: "empty_sitemap",
      severity: "error",
      title: "Sitemap فارغ",
      detail: "لم يتم العثور على أي عناوين URL في ملف Sitemap الحالي.",
    });
  }

  const urlCounts = new Map<string, number>();
  for (const entry of entries) {
    urlCounts.set(entry.url, (urlCounts.get(entry.url) ?? 0) + 1);
  }
  const duplicateUrls = [...urlCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([url]) => url);
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

  const noindexInSitemap = findNoindexPathsInSitemap(entries);
  if (noindexInSitemap.length > 0) {
    checks.push({
      id: "noindex_in_sitemap",
      severity: "error",
      title: "عناوين noindex داخل Sitemap",
      detail: "صفحات متابعة المشروع الفردية مضبوطة على noindex ولا ينبغي أن تظهر في Sitemap.",
      count: noindexInSitemap.length,
      samples: summarize(noindexInSitemap),
    });
  }

  const missingPublished = await findMissingPublishedRecords(entries).catch(() => []);
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

  const unpublishedTargets = await findUnpublishedSitemapTargets(entries).catch(() => []);
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
    .filter((entry) => entry.url !== buildSitemapAbsoluteUrl(entry.path, canonicalBase))
    .map((entry) => entry.url);
  if (canonicalMismatches.length > 0) {
    checks.push({
      id: "canonical_mismatch",
      severity: "warning",
      title: "عدم تطابق عنوان Sitemap مع القاعدة الأساسية",
      detail: "بعض العناوين لا تُبنى من المسار والنطاق الأساسي المتوقعين.",
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
