import { VENISIA_THEME_MODULE_PRESENTATION } from "./slot-module-nodes";
import { resolveVenesiaThemeLayout } from "./venisia-theme-regions";

/** One explicit Venisia Theme extension point; not a parallel renderer. */
export const VENISIA_THEME_CONTRACT = Object.freeze({
  resolveLayout: resolveVenesiaThemeLayout,
  modulePresentation: VENISIA_THEME_MODULE_PRESENTATION,
});
