"use client";

import { useLayoutEffect, useState } from "react";
import {
  createAdminFloatingMenuStyle,
  type AdminFloatingMenuPosition,
} from "./admin-floating-position";

type UseAdminFloatingMenuPositionOptions = {
  minWidth?: number;
  offset?: number;
  preferredWidth?: number;
  align?: "left" | "right";
  collisionPadding?: number;
  estimatedHeight?: number;
  zIndex?: number;
};

export function useAdminFloatingMenuPosition(
  isOpen: boolean,
  anchorRef: React.RefObject<HTMLElement | null>,
  {
    minWidth = 220,
    offset = 6,
    preferredWidth,
    align = "left",
    collisionPadding,
    estimatedHeight,
    zIndex = 9999,
  }: UseAdminFloatingMenuPositionOptions = {},
) {
  const [position, setPosition] = useState<AdminFloatingMenuPosition | null>(null);

  useLayoutEffect(() => {
    if (!isOpen || !anchorRef.current) {
      setPosition(null);
      return;
    }

    function updatePosition() {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      const requestedWidth = Math.max(
        rect.width,
        minWidth,
        preferredWidth ?? 0,
      );
      const hasCollisionBoundary = collisionPadding !== undefined;
      const viewportPadding = collisionPadding ?? 0;
      const width = hasCollisionBoundary
        ? Math.min(
            requestedWidth,
            Math.max(rect.width, window.innerWidth - viewportPadding * 2),
          )
        : requestedWidth;
      const requestedLeft =
        align === "right" ? rect.right - width : rect.left;
      const left = hasCollisionBoundary
        ? Math.min(
            Math.max(viewportPadding, requestedLeft),
            Math.max(
              viewportPadding,
              window.innerWidth - width - viewportPadding,
            ),
          )
        : requestedLeft;

      if (estimatedHeight && hasCollisionBoundary) {
        const availableBelow = Math.max(
          0,
          window.innerHeight - rect.bottom - offset - viewportPadding,
        );
        const availableAbove = Math.max(
          0,
          rect.top - offset - viewportPadding,
        );
        const placement =
          availableBelow >= Math.min(estimatedHeight, availableAbove)
            ? "bottom"
            : "top";
        const maxHeight =
          placement === "bottom" ? availableBelow : availableAbove;

        const top = rect.bottom + offset;
        const bottom = window.innerHeight - rect.top + offset;
        setPosition({
          placement,
          style: createAdminFloatingMenuStyle({
            placement,
            top,
            bottom,
            left,
            width,
            maxHeight,
            zIndex,
          }),
        });
        return;
      }

      setPosition({
        placement: "bottom",
        style: createAdminFloatingMenuStyle({
          placement: "bottom",
          top: rect.bottom + offset,
          left,
          width,
          zIndex,
        }),
      });
    }

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [
    align,
    anchorRef,
    collisionPadding,
    estimatedHeight,
    isOpen,
    minWidth,
    offset,
    preferredWidth,
    zIndex,
  ]);

  return position;
}
