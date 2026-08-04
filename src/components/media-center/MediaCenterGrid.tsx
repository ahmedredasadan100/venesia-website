import MediaCenterHub from "./MediaCenterHub";
import type { PageComposition } from "../../lib/page-blocks/page-composition-types";

export default function MediaCenterGrid({ composition }: { composition: PageComposition }) {
  return <MediaCenterHub composition={composition} />;
}
