import type { FeedPresentationDensity } from "../../lib/feed-modules/types";

const SIDEBAR_GRID_COLUMNS_OVERRIDE =
  "[[data-layout-slot=sidebar]_&]:!grid-cols-1";

const GRID_COLUMNS_CLASS_NAMES: Record<FeedPresentationDensity, string> = {
  1: `grid-cols-1 ${SIDEBAR_GRID_COLUMNS_OVERRIDE}`,
  2: `grid-cols-1 @xl/slot-module:grid-cols-2 ${SIDEBAR_GRID_COLUMNS_OVERRIDE}`,
  3: `grid-cols-1 @xl/slot-module:grid-cols-2 @3xl/slot-module:grid-cols-3 ${SIDEBAR_GRID_COLUMNS_OVERRIDE}`,
};

const SLIDER_COLUMNS_CLASS_NAMES: Record<FeedPresentationDensity, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
};

export function feedGridColumnsClass(columns: FeedPresentationDensity) {
  return GRID_COLUMNS_CLASS_NAMES[columns];
}

export function feedSliderColumnsClass(density: FeedPresentationDensity) {
  return SLIDER_COLUMNS_CLASS_NAMES[density];
}
