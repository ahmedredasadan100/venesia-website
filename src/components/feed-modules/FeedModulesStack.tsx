import FeedModuleSection from "./FeedModuleSection";
import type { LoadedFeedModule } from "../../lib/feed-modules/load-feed-modules";
import type { PageLayoutSlot } from "../../lib/page-blocks/layout-slots";

type FeedModulesStackProps = {
  modules: LoadedFeedModule[];
  slot?: PageLayoutSlot;
};

export default function FeedModulesStack({ modules, slot }: FeedModulesStackProps) {
  const entries = slot ? modules.filter((module) => module.slot === slot) : modules;

  return (
    <>
      {entries.map((module) => (
        <FeedModuleSection key={`feed-${module.assignmentId}`} module={module} />
      ))}
    </>
  );
}
