import { loadMediaHubModules } from "../../lib/media-hub-modules/load-media-hub-modules";
import { loadMediaCenterSidebarProps } from "../../lib/media-sidebar-modules/load-media-sidebar-modules";
import MediaPageShell from "./MediaPageShell";
import { renderMediaHubSections } from "./renderMediaHubSections";

export default async function MediaCenterHub() {
  const [sidebarProps, hubModulesState] = await Promise.all([
    loadMediaCenterSidebarProps("media-center"),
    loadMediaHubModules("media-center"),
  ]);

  const sectionNodes = renderMediaHubSections(hubModulesState.modules);

  return (
    <MediaPageShell
      latestNewsSidebar={sidebarProps.latestNewsSidebar}
      popularMediaSidebarItems={sidebarProps.popularMediaSidebarItems}
      sidebarModules={sidebarProps.sidebarModules}
    >
      <section className="space-y-10 text-right text-white" dir="rtl">
        {sectionNodes}
      </section>
    </MediaPageShell>
  );
}
