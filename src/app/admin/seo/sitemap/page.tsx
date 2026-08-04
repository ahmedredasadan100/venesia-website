import { runGlobalSeoHealth } from "../../../../lib/seo/run-global-seo-health";

import SitemapMonitorClient from "./SitemapMonitorClient";

export const dynamic = "force-dynamic";

export default async function SitemapMonitorPage() {
  const snapshot = await runGlobalSeoHealth();

  return <SitemapMonitorClient initialSnapshot={snapshot} />;
}
