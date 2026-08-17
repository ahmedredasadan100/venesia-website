/**
 * Canonical Venesia scrollbar visuals.
 *
 * Consumers retain overflow, dimensions, and scrolling behavior. This neutral
 * presentation token owns only the shared thin track/thumb visual language.
 */
export const VENESIA_SCROLLBAR_VISUAL_CLASSES =
  "[scrollbar-width:thin] [scrollbar-color:rgba(216,184,122,0.38)_rgba(255,255,255,0.06)] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-white/[0.04] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#D8B87A]/35 hover:[&::-webkit-scrollbar-thumb]:bg-[#D8B87A]/55";
