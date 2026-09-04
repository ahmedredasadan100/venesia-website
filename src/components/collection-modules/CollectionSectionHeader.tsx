import type { ReactNode } from "react";
import Link from "next/link";

import {
  pageBlockTextAlignClass,
  pageBlockTextPlacementClass,
} from "../../lib/page-blocks/configs";

export type CollectionSectionHeaderPresentation = {
  eyebrow?: string | null;
  title?: string | null;
  description?: string | null;
  ctaText?: string | null;
  showEyebrow?: boolean;
  eyebrowBold?: boolean;
  eyebrowAlignment?: "right" | "center" | "left";
  showTitle?: boolean;
  titleBold?: boolean;
  titleAlignment?: "right" | "center" | "left";
  showDescription?: boolean;
  descriptionBold?: boolean;
  descriptionAlignment?: "right" | "center" | "left";
  showCta?: boolean;
  ctaBold?: boolean;
  ctaAlignment?: "right" | "center" | "left";
};

type CollectionSectionHeaderProps = {
  presentation: CollectionSectionHeaderPresentation;
  href?: string | null;
  actions?: ReactNode;
};

/** Shared collection-section heading presentation; selection stays with each Domain owner. */
export default function CollectionSectionHeader({
  presentation,
  href,
  actions,
}: CollectionSectionHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
      <div className="min-w-0">
        {presentation.showEyebrow !== false && presentation.eyebrow ? (
          <p className={`text-xs uppercase tracking-[0.28em] text-[#D8B87A]/70 ${pageBlockTextAlignClass(presentation.eyebrowAlignment ?? "right")} ${presentation.eyebrowBold ? "font-bold" : "font-normal"}`}>
            {presentation.eyebrow}
          </p>
        ) : null}
        {presentation.showTitle !== false && presentation.title ? (
          <h2 className={`mt-3 text-2xl text-white @xl/slot-module:text-3xl ${pageBlockTextAlignClass(presentation.titleAlignment ?? "right")} ${presentation.titleBold === false ? "font-normal" : "font-bold"}`}>
            {presentation.title}
          </h2>
        ) : null}
        {presentation.showDescription !== false && presentation.description ? (
          <p className={`mt-3 max-w-2xl text-sm leading-7 text-white/55 ${pageBlockTextAlignClass(presentation.descriptionAlignment ?? "right")} ${pageBlockTextPlacementClass(presentation.descriptionAlignment ?? "right")} ${presentation.descriptionBold ? "font-bold" : "font-normal"}`}>
            {presentation.description}
          </p>
        ) : null}
      </div>
      {actions || (href && presentation.ctaText && presentation.showCta !== false) ? (
        <div className="flex shrink-0 items-center gap-3">
          {actions}
          {href && presentation.ctaText && presentation.showCta !== false ? (
            <Link
              href={href}
              className={`min-w-28 text-sm text-[#D8B87A] transition hover:text-white ${pageBlockTextAlignClass(presentation.ctaAlignment ?? "right")} ${presentation.ctaBold ? "font-bold" : "font-medium"}`}
            >
              {presentation.ctaText}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
