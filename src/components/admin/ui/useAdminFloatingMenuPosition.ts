"use client";

import { useLayoutEffect, useState } from "react";

export type AdminFloatingMenuPosition = {
  top: number;
  left: number;
  width: number;
};

type UseAdminFloatingMenuPositionOptions = {
  minWidth?: number;
  offset?: number;
};

export function useAdminFloatingMenuPosition(
  isOpen: boolean,
  anchorRef: React.RefObject<HTMLElement | null>,
  { minWidth = 220, offset = 6 }: UseAdminFloatingMenuPositionOptions = {},
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
      setPosition({
        top: rect.bottom + offset,
        left: rect.left,
        width: Math.max(rect.width, minWidth),
      });
    }

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, anchorRef, minWidth, offset]);

  return position;
}
