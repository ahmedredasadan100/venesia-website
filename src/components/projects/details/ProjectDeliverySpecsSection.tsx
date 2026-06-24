"use client";

import { useState } from "react";

import RichTextContent from "../../content/RichTextContent";

type DeliverySpecImage = {
  image: string;
  label: string;
};

type DeliverySpecs = {
  title: string;
  subtitle?: string;
  items: string[];
  images: DeliverySpecImage[];
};

type ProjectDeliverySpecsSectionProps = {
  deliverySpecs?: DeliverySpecs;
};

export default function ProjectDeliverySpecsSection({
  deliverySpecs,
}: ProjectDeliverySpecsSectionProps) {
  if (!deliverySpecs) return null;

  const [activeImage, setActiveImage] = useState<DeliverySpecImage | undefined>(
    deliverySpecs.images[0],
  );

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

          {deliverySpecs.subtitle ? (
            <RichTextContent
              value={deliverySpecs.subtitle}
              mode="rich"
              className="mt-4 max-w-2xl text-sm leading-8 text-white/58"
            />
          ) : null}

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {deliverySpecs.items.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/10 bg-white/[0.025] px-5 py-4 text-sm leading-7 text-white/72"
              >
                <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-[#D8B87A]" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="overflow-hidden rounded-[30px] border border-[#D8B87A]/20 bg-white/[0.025] p-3 shadow-[0_24px_90px_rgba(0,0,0,0.35)]">
            {activeImage ? (
              <img
                src={activeImage.image}
                alt={activeImage.label}
                className="h-[360px] w-full rounded-[24px] object-cover"
              />
            ) : null}

            {deliverySpecs.images.length > 1 ? (
              <div className="mt-3 grid grid-cols-4 gap-3">
                {deliverySpecs.images.map((image, index) => (
                  <button
                    key={`${image.image}-${index}`}
                    type="button"
                    onClick={() => setActiveImage(image)}
                    className={`overflow-hidden rounded-2xl border transition-all ${
                      activeImage?.image === image.image
                        ? "border-[#D8B87A] ring-1 ring-[#D8B87A]"
                        : "border-white/10 hover:border-[#D8B87A]/40"
                    }`}
                  >
                    <img
                      src={image.image}
                      alt={image.label}
                      className="h-24 w-full object-cover opacity-85 transition duration-700 hover:scale-105 hover:opacity-100"
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}