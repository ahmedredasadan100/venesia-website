import { loadGlobalSeoSettings } from "../../../../lib/seo/load-global-seo-settings";
import { getGlobalSeoDefaults } from "../../../../lib/seo/global-seo-defaults";
import MetaManagerClient from "./MetaManagerClient";

export const dynamic = "force-dynamic";

export default async function MetaManagerPage() {
  const settings = await loadGlobalSeoSettings().catch(() => getGlobalSeoDefaults());

  return <MetaManagerClient initialSettings={settings} />;
}
