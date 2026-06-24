/**
 * Guard for config/projects-data.ts → Supabase import.
 * Disabled in production unless ALLOW_PROJECTS_STATIC_REIMPORT=true.
 */
export function isProjectsStaticReimportAllowed(): boolean {
  if (process.env.NODE_ENV === "development") return true;
  return process.env.ALLOW_PROJECTS_STATIC_REIMPORT === "true";
}

export function projectsStaticReimportBlockedMessage(): string {
  return "استيراد projects-data.ts معطّل في بيئة الإنتاج. فعّل ALLOW_PROJECTS_STATIC_REIMPORT=true للتطوير فقط.";
}
