/**
 * Projects Hub CMS public render gate.
 * Opt-in only — missing / unset / any other value = disabled.
 * Does not use NODE_ENV or VERCEL.
 */
export function isProjectsHubCmsEnabled() {
  const value = process.env.PROJECTS_HUB_CMS?.trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}
