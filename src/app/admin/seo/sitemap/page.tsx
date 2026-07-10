import { runSitemapDiagnostics } from "../../../../lib/seo/run-sitemap-diagnostics";

import SitemapMonitorClient from "./SitemapMonitorClient";

export const dynamic = "force-dynamic";

export default async function SitemapMonitorPage() {
  const snapshot = await runSitemapDiagnostics();

  return <SitemapMonitorClient initialSnapshot={snapshot} />;
}
