"use client";

import RichTextContent from "../../content/RichTextContent";
import type { PublicProject } from "../../../lib/projects/public-types";
import { ProjectDeliveryGallery } from "./ProjectImageGalleries";

type ProjectDeliverySpecsSectionProps = {
  deliverySpecs?: PublicProject["delivery"];
};

export default function ProjectDeliverySpecsSection({
  deliverySpecs,
}: ProjectDeliverySpecsSectionProps) {
  if (!deliverySpecs) return null;

  return (
    <section
      id="delivery-specs"
      className="scroll-mt-24 bg-[#05070B] px-6 py-16"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          {deliverySpecs.title ? (
            <h2 className="text-3xl font-semibold leading-tight text-[#D8B87A] md:text-4xl">
              {deliverySpecs.title}
            </h2>
          ) : null}

          {deliverySpecs.body ? (
            <RichTextContent
              value={deliverySpecs.body}
              mode="rich"
              className={`${deliverySpecs.title ? "mt-4" : ""} max-w-2xl text-sm leading-8 text-white/58`}
            />
          ) : null}

          <div className={`${deliverySpecs.title || deliverySpecs.body ? "mt-7" : ""} grid gap-x-6 gap-y-2 sm:grid-cols-2`}>
            {deliverySpecs.items.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 border-b border-white/8 py-2.5 text-sm leading-6 text-white/72"
              >
                <span aria-hidden="true" className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-[#D8B87A]/45 text-[11px] text-[#D8B87A]">✓</span>
                <RichTextContent value={item.body} mode="rich" />
              </div>
            ))}
          </div>
        </div>

        {deliverySpecs.images.length ? <ProjectDeliveryGallery images={deliverySpecs.images} /> : null}
      </div>
    </section>
  );
}
