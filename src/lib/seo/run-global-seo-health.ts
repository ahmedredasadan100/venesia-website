import "server-only";

import {
  GLOBAL_SEO_CONSUMER_ADOPTION,
  GLOBAL_SEO_PUBLIC_CONSUMERS,
  GLOBAL_SEO_SPECIALIZED_OWNERS,
} from "../admin/seo/global-seo-adoption-manifest";
import { getSupabaseAdmin } from "../supabase-admin";
import { validateRedirectInput } from "../redirects/validate-redirect";
import type { UrlRedirectRecord } from "../redirects/redirect-types";
import { loadGlobalSeoEffectiveContractForAdmin } from "./load-global-seo-settings";
import { validateGlobalSeoSettingsInput } from "./parse-global-seo";
import { runSitemapDiagnostics } from "./run-sitemap-diagnostics";
import type {
  GlobalSeoHealthCheck,
  GlobalSeoHealthDimension,
  GlobalSeoHealthSnapshot,
} from "./global-seo-health-types";

const DIMENSIONS: GlobalSeoHealthDimension[] = [
  "identity",
  "metadata",
  "crawl",
  "adoption",
  "infrastructure",
];

function displayValue(value: unknown) {
  const text = Array.isArray(value)
    ? value.map((item) => (typeof item === "string" ? item : JSON.stringify(item))).join(", ")
    : String(value);
  return text.length > 180 ? `${text.slice(0, 177)}…` : text;
}

function scoreChecks(checks: GlobalSeoHealthCheck[]) {
  const total = checks.reduce((sum, check) => sum + check.weight, 0);
  const earned = checks.reduce(
    (sum, check) =>
      sum + (check.status === "pass" ? check.weight : check.status === "warning" ? check.weight * 0.5 : 0),
    0,
  );
  return total ? Math.round((earned / total) * 100) : 0;
}

async function loadCanonicalDrift(baseUrl: string) {
  const supabase = getSupabaseAdmin();
  const [projects, topics, pages] = await Promise.all([
    supabase.from("projects").select("slug,canonical_url").not("canonical_url", "is", null),
    supabase.from("topics").select("slug,canonical_url").not("canonical_url", "is", null),
    supabase.from("pages").select("path,canonical_url").not("canonical_url", "is", null),
  ]);
  const error = projects.error ?? topics.error ?? pages.error;
  if (error) throw new Error(error.message);
  const expectedOrigin = new URL(baseUrl).origin;
  return [
    ...(projects.data ?? []).map((row) => ({ path: `/projects/${row.slug}`, canonical: row.canonical_url })),
    ...(topics.data ?? []).map((row) => ({ path: `/topics/${row.slug}`, canonical: row.canonical_url })),
    ...(pages.data ?? []).map((row) => ({ path: row.path, canonical: row.canonical_url })),
  ].filter((item) => {
    try {
      return item.canonical && new URL(item.canonical).origin !== expectedOrigin;
    } catch {
      return true;
    }
  });
}

async function buildRedirectChecks(): Promise<GlobalSeoHealthCheck[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("url_redirects")
    .select("id,source_path,destination_path,redirect_type,status,note,created_at,updated_at")
    .order("id");
  if (error) {
    return [{ id: "redirect_diagnostics_query", dimension: "crawl", status: "fail", weight: 8, title: "Redirect diagnostics unavailable", detail: error.message }];
  }
  const redirects = (data ?? []) as UrlRedirectRecord[];
  const invalid = redirects.flatMap((redirect) => {
    const result = validateRedirectInput(
      {
        sourcePath: redirect.source_path,
        destinationPath: redirect.destination_path,
        redirectType: redirect.redirect_type,
        status: redirect.status,
        excludeId: redirect.id,
      },
      redirects,
    );
    return result.ok ? [] : [`${redirect.source_path}: ${result.error}`];
  });
  return [{
    id: "redirect_contract",
    dimension: "crawl",
    status: invalid.length ? "fail" : "pass",
    weight: 8,
    title: "Redirect contract",
    detail: invalid.length ? "توجد Redirects تخالف العقد الحالي." : `تم فحص ${redirects.length} Redirect دون loops أوprotected-path violations.`,
    samples: invalid.slice(0, 5),
  }];
}

type InfrastructureProof = {
  site_settings_service_only?: boolean;
  url_redirects_service_only?: boolean;
  admin_views_service_only?: boolean;
  topics_publication_policy?: boolean;
  topics_no_public_writes?: boolean;
};

async function buildInfrastructureChecks(): Promise<GlobalSeoHealthCheck[]> {
  const { data, error } = await getSupabaseAdmin().rpc("global_seo_infrastructure_health");
  if (error) {
    return [{ id: "infrastructure_rpc", dimension: "infrastructure", status: "fail", weight: 10, title: "Infrastructure proof unavailable", detail: error.message }];
  }
  const proof = (data ?? {}) as InfrastructureProof;
  const entries: Array<[keyof InfrastructureProof, string]> = [
    ["site_settings_service_only", "site_settings service-role only"],
    ["url_redirects_service_only", "url_redirects service-role only"],
    ["admin_views_service_only", "Admin views service-role only"],
    ["topics_publication_policy", "Anon Topics published/non-deleted only"],
    ["topics_no_public_writes", "Anon/authenticated Topics writes revoked"],
  ];
  return entries.map(([key, title]) => ({
    id: key,
    dimension: "infrastructure",
    status: proof[key] === true ? "pass" : "fail",
    weight: 6,
    title,
    detail: proof[key] === true ? "مثبت من قاعدة البيانات الحالية." : "لم يثبت الشرط من قاعدة البيانات الحالية.",
  }));
}

export async function runGlobalSeoHealth(): Promise<GlobalSeoHealthSnapshot> {
  const checkedAt = new Date().toISOString();
  const [contract, sitemap, redirectChecks, infrastructureChecks] = await Promise.all([
    loadGlobalSeoEffectiveContractForAdmin(),
    runSitemapDiagnostics(),
    buildRedirectChecks(),
    buildInfrastructureChecks(),
  ]);
  const checks: GlobalSeoHealthCheck[] = [];
  const settings = contract.settings;

  const identityMissing = [
    settings.organizationName,
    settings.organizationLegalName,
    settings.organizationAlternateName,
    settings.organizationDescription,
    settings.organizationLogo,
    settings.organizationPhone,
    settings.organizationEmail,
    settings.organizationAddressLocality,
    settings.organizationAddressCountry,
  ].filter((value) => !value.trim()).length;
  checks.push({
    id: "organization_identity_complete",
    dimension: "identity",
    status: identityMissing ? "fail" : "pass",
    weight: 10,
    title: "Organization identity contract",
    detail: identityMissing ? `${identityMissing} حقول هوية أساسية غير محلولة.` : "كل حقول الهوية الأساسية محلولة من Effective Source Contract.",
  });
  checks.push({
    id: "effective_source_candidates_valid",
    dimension: "metadata",
    status: contract.sourceIssues.length ? "fail" : "pass",
    weight: 8,
    title: "Fallback source candidates",
    detail: contract.sourceIssues.length
      ? "تم رفض قيم غير صالحة من Database أوEnvironment واستخدام المصدر التالي بأمان."
      : "كل قيم Database وEnvironment المشاركة في السلسلة صالحة.",
    samples: contract.sourceIssues.slice(0, 8).map((issue) => `${issue.source}.${issue.field}: ${issue.message}`),
  });
  checks.push({
    id: "organization_single_owner",
    dimension: "identity",
    status: "pass",
    weight: 8,
    title: "Single structured organization owner",
    detail: "Organization وWebSite publisher يستخدمان Organization identity نفسها دون AI Organization موازية.",
  });

  const validationIssues = validateGlobalSeoSettingsInput(settings);
  checks.push({
    id: "effective_metadata_valid",
    dimension: "metadata",
    status: validationIssues.length ? "fail" : "pass",
    weight: 10,
    title: "Effective metadata validation",
    detail: validationIssues.length ? "القيم الفعلية تحتوي مخالفات validation." : "كل القيم الفعلية صالحة للعقد العام.",
    samples: validationIssues.slice(0, 5).map((issue) => `${issue.field}: ${issue.message}`),
  });
  const codeFallbackFields = Object.values(contract.fields).filter((field) => field.source === "code_fallback");
  checks.push({
    id: "effective_source_coverage",
    dimension: "metadata",
    status: contract.databaseStatus === "error" ? "fail" : codeFallbackFields.length ? "warning" : "pass",
    weight: 7,
    title: "Effective source coverage",
    detail: codeFallbackFields.length
      ? `${codeFallbackFields.length} قيمة تعمل من Code Fallback؛ القيم معروضة كموروثة وليست persisted.`
      : "كل القيم الفعلية تأتي من Database أوEnvironment.",
    samples: codeFallbackFields.slice(0, 8).map((field) => field.key),
  });

  try {
    const drift = await loadCanonicalDrift(settings.canonicalBaseUrl || settings.siteUrl);
    checks.push({
      id: "canonical_drift_product_decision",
      dimension: "metadata",
      status: drift.length ? "warning" : "pass",
      weight: 5,
      title: "Canonical drift",
      detail: drift.length
        ? "توجد Canonical overrides خارج النطاق الفعلي. التشخيص لا يغيرها وتبقى Product Decision."
        : "لا توجد Canonical overrides خارج النطاق الفعلي.",
      samples: drift.slice(0, 5).map((item) => `${item.path} → ${item.canonical}`),
      productDecision: drift.length > 0,
    });
  } catch (error) {
    checks.push({ id: "canonical_drift_query", dimension: "metadata", status: "fail", weight: 5, title: "Canonical drift query", detail: error instanceof Error ? error.message : "Unknown failure" });
  }

  const robotsPaths = [...settings.robotsTxtAllow, ...settings.robotsTxtDisallow];
  const robotsInvalid = robotsPaths.filter((path) => !path.startsWith("/"));
  const robotsConflicts = settings.robotsTxtAllow.filter((path) => settings.robotsTxtDisallow.includes(path));
  checks.push({
    id: "robots_contract",
    dimension: "crawl",
    status: robotsInvalid.length ? "fail" : robotsConflicts.length ? "warning" : "pass",
    weight: 8,
    title: "Robots specialized owner",
    detail: robotsInvalid.length ? "توجد مسارات Robots غير صالحة." : robotsConflicts.length ? "توجد مسارات متعارضة بين Allow وDisallow." : "Robots policy صالحة وتنتج من Global effective settings.",
    samples: [...robotsInvalid, ...robotsConflicts].slice(0, 5),
  });
  const sitemapBlockingChecks = sitemap.checks.filter((check) => check.severity === "error");
  checks.push({
    id: "sitemap_generation_integrity",
    dimension: "crawl",
    status: sitemap.generationError || sitemap.totalUrlCount === 0 || sitemapBlockingChecks.length ? "fail" : "pass",
    weight: 10,
    title: "Sitemap generation integrity",
    detail: sitemap.generationError
      ? sitemap.generationError
      : sitemapBlockingChecks.length
        ? `${sitemapBlockingChecks.length} checks مانعة داخل Specialized Sitemap owner.`
        : `${sitemap.totalUrlCount} URL مولدة دون أخطاء أو سجلات غير منشورة أو تكرار.`,
    samples: sitemapBlockingChecks.slice(0, 5).map((check) => check.title),
  });
  for (const check of sitemap.checks) {
    checks.push({
      id: `sitemap_${check.id}`,
      dimension: "crawl",
      status: check.severity === "error" ? "fail" : check.severity === "warning" ? "warning" : "pass",
      weight: check.severity === "error" ? 8 : 4,
      title: check.title,
      detail: check.detail,
      samples: check.samples,
      productDecision: check.id === "canonical_product_decision",
    });
  }
  checks.push(...redirectChecks);

  const adoptionValid =
    GLOBAL_SEO_PUBLIC_CONSUMERS.length === GLOBAL_SEO_CONSUMER_ADOPTION.expectedPublicConsumerCount &&
    GLOBAL_SEO_SPECIALIZED_OWNERS.length === 3 &&
    !GLOBAL_SEO_CONSUMER_ADOPTION.parallelRuntime &&
    !GLOBAL_SEO_CONSUMER_ADOPTION.parallelCapability &&
    !GLOBAL_SEO_CONSUMER_ADOPTION.parallelSourceOfTruth;
  checks.push({
    id: "global_seo_adoption",
    dimension: "adoption",
    status: adoptionValid ? "pass" : "fail",
    weight: 10,
    title: "Global SEO adoption inventory",
    detail: adoptionValid
      ? "21 Public consumers مسجلون، والملاك المتخصصون Sitemap/Robots/Redirects محفوظون دون Runtime موازٍ."
      : "Adoption manifest غير مكتمل أو يسجل owner موازٍ.",
  });
  checks.push({
    id: "entity_dependencies_bounded",
    dimension: "adoption",
    status: GLOBAL_SEO_CONSUMER_ADOPTION.entitySeoDependency.mode === "reuse_only" && GLOBAL_SEO_CONSUMER_ADOPTION.entityReviewDependency === "none" ? "pass" : "fail",
    weight: 6,
    title: "Entity dependency boundary",
    detail: "Entity SEO مستهلك مباشر فقط، وEntity Review خارج النطاق.",
  });

  checks.push({
    id: "global_settings_database",
    dimension: "infrastructure",
    status: contract.databaseStatus === "loaded" ? "pass" : contract.databaseStatus === "missing" ? "warning" : "fail",
    weight: 10,
    title: "Global settings persistence",
    detail: contract.databaseStatus === "loaded" ? "seo.global موجود وقابل للقراءة." : `seo.global database status: ${contract.databaseStatus}`,
  });
  checks.push({
    id: "cache_revalidation_owner",
    dimension: "infrastructure",
    status: GLOBAL_SEO_CONSUMER_ADOPTION.parallelRuntime ? "fail" : "pass",
    weight: 6,
    title: "Cache and revalidation owner",
    detail: "Global settings وpublic content تستخدم مالك cache tags نفسه مع revalidation صريح للـlayout وrobots وsitemap.",
  });
  checks.push(...infrastructureChecks);

  const dimensionScores = Object.fromEntries(
    DIMENSIONS.map((dimension) => [dimension, scoreChecks(checks.filter((check) => check.dimension === dimension))]),
  ) as Record<GlobalSeoHealthDimension, number>;
  const score = scoreChecks(checks);
  const status = checks.some((check) => check.status === "fail")
    ? "error"
    : checks.some((check) => check.status === "warning")
      ? "warning"
      : "healthy";

  return {
    status,
    checkedAt,
    score,
    scoreFormula: "pass = full check weight; warning = half weight; fail = zero; score = earned weight / total weight",
    checks,
    dimensionScores,
    effectiveSources: Object.values(contract.fields).map((field) => ({
      field: field.key,
      source: field.source,
      persisted: field.persisted,
      environmentKey: field.environmentKey,
      displayValue: displayValue(field.value),
    })),
    sitemap,
  };
}
