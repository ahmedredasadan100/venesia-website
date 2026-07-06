/**
 * Guard for config/projects-data.ts → Supabase import.
 * Requires development mode and an explicit opt-in flag.
 */
export function isProjectsStaticReimportAllowed(): boolean {
  return process.env.NODE_ENV === "development" && process.env.ENABLE_PROJECTS_SEED === "true";
}

export function projectsStaticReimportBlockedMessage(): string {
  return "استيراد projects-data.ts معطّل. فعّل ENABLE_PROJECTS_SEED=true في بيئة التطوير فقط.";
}
