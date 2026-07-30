"use client";

import { useState } from "react";
import Image from "next/image";

import RichTextContent from "../../content/RichTextContent";
import type { PublicProject } from "../../../lib/projects/public-types";

type ProjectDeliverySpecsSectionProps = {
  deliverySpecs?: PublicProject["delivery"];
};

export default function ProjectDeliverySpecsSection({
  deliverySpecs,
}: ProjectDeliverySpecsSectionProps) {
  const images = deliverySpecs?.images ?? [];
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  if (!deliverySpecs) return null;

  const activeImage = images[activeImageIndex] ?? images[0];

  return (
    <section
      id="delivery-specs"
      className="scroll-mt-24 bg-[#05070B] px-6 py-16"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <p className="mb-3 text-sm font-medium tracking-[0.28em] text-[#D8B87A]/70">
            مواصفات التنفيذ والتسليم
          </p>

          <h2 className="text-3xl font-semibold leading-tight text-[#D8B87A] md:text-4xl">
            {deliverySpecs.title}
          </h2>

          {deliverySpecs.body ? (
            <RichTextContent
              value={deliverySpecs.body}
              mode="rich"
              className="mt-4 max-w-2xl text-sm leading-8 text-white/58"
            />
          ) : null}

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {deliverySpecs.items.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-white/10 bg-white/[0.025] px-5 py-4 text-sm leading-7 text-white/72"
              >
                <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-[#D8B87A]" />
                <RichTextContent value={item.body} mode="rich" />
              </div>
            ))}
          </div>
        </div>

        {activeImage ? <div>
          <div className="overflow-hidden rounded-[30px] border border-[#D8B87A]/20 bg-white/[0.025] p-3 shadow-[0_24px_90px_rgba(0,0,0,0.35)]">
            <div className="relative h-[360px] overflow-hidden rounded-[24px]">
              <Image
                src={activeImage.src}
                alt={activeImage.alt}
                fill
                sizes="(max-width: 1024px) 100vw, 55vw"
                className="object-cover"
              />
            </div>

            {deliverySpecs.images.length > 1 ? (
              <div className="mt-3 grid grid-cols-4 gap-3">
                {deliverySpecs.images.map((image, index) => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => setActiveImageIndex(index)}
                    className={`overflow-hidden rounded-2xl border transition-all ${
                      activeImage?.src === image.src
                        ? "border-[#D8B87A] ring-1 ring-[#D8B87A]"
                        : "border-white/10 hover:border-[#D8B87A]/40"
                    }`}
                  >
                    <Image
                      src={image.src}
                      alt={image.alt}
                      width={240}
                      height={96}
                      className="h-24 w-full object-cover opacity-85 transition duration-700 hover:scale-105 hover:opacity-100"
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div> : null}
      </div>
    </section>
  );
}
