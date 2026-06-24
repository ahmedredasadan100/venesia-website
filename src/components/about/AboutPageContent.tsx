"use client";

import { useEffect } from "react";
import type { PageComposition } from "../../lib/page-blocks/page-composition-types";
import PageSlotLayout from "../page-composition/PageSlotLayout";

type AboutPageContentProps = {
  composition: PageComposition;
};

export default function AboutPageContent({ composition }: AboutPageContentProps) {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const delay = parseInt(entry.target.getAttribute("data-delay") ?? "0", 10);
            setTimeout(() => entry.target.classList.add("is-revealed"), delay);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -48px 0px" },
    );

    document.querySelectorAll("[data-reveal]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <main className="relative z-10">
      <PageSlotLayout composition={composition} />
    </main>
  );
}
