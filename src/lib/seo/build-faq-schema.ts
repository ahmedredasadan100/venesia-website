export type FaqSchemaItem = {
  question: string;
  answer: string;
};

import type { JsonLdObject } from "./jsonld-types";

export function buildFaqSchema(items: readonly FaqSchemaItem[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}