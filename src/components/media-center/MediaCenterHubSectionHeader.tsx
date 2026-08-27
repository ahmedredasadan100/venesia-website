import type { ReactNode } from "react";
import Link from "next/link";

import type { MediaHubModulePresentation } from "../../lib/media-hub-modules/parse-config";
import { pageBlockTextAlignClass, pageBlockTextPlacementClass } from "../../lib/page-blocks/configs";

type MediaCenterHubSectionHeaderProps = {
  presentation: MediaHubModulePresentation;
  href: string;
  actions?: ReactNode;
};

export default function MediaCenterHubSectionHeader({
  presentation,
  href,
  actions,
}: MediaCenterHubSectionHeaderProps) {
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

      {actions || presentation.ctaText ? (
        <div className="flex shrink-0 items-center gap-3">
          {actions}
          {presentation.ctaText ? (
            <Link
              href={href}
              className="text-sm font-medium text-[#D8B87A] transition hover:text-white"
            >
              {presentation.ctaText}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
