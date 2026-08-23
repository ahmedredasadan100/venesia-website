import type { PageComposition } from "../../lib/page-blocks/page-composition-types";
import MediaPageShell from "./MediaPageShell";
import { renderMediaHubSections } from "./renderMediaHubSections";

export default function MediaCenterHub({ composition }: { composition: PageComposition }) {
  const hubModulesState = composition.mediaHubModules;
  if (!hubModulesState) return null;

  const sectionNodes = renderMediaHubSections(
    hubModulesState.modules.filter((module) => module.config.placement === "hub"),
  );

  return (
    <MediaPageShell>
      <section className="space-y-10 text-right text-white" dir="rtl">
        {sectionNodes}
      </section>
    </MediaPageShell>
  );
}
