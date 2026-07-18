import type { CSSProperties } from "react";

export type AdminFloatingMenuPlacement = "top" | "bottom";

export type AdminFloatingMenuPosition = {
  placement: AdminFloatingMenuPlacement;
  /** Complete fixed-position contract. Consumers apply this object unchanged. */
  style: CSSProperties;
};

type AdminFloatingMenuStyleInput = {
  placement: AdminFloatingMenuPlacement;
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight?: number;
  zIndex: number;
};

export function createAdminFloatingMenuStyle({
  placement,
  top,
  bottom,
  left,
  width,
  maxHeight,
  zIndex,
}: AdminFloatingMenuStyleInput): CSSProperties {
  return {
    position: "fixed",
    top: placement === "bottom" ? top : undefined,
    bottom: placement === "top" ? bottom : undefined,
    left,
    width,
    maxHeight,
    zIndex,
  };
}
