"use client";

import { useState } from "react";
import type { ContactFaqContent, ContactFaqItem } from "./contact-cms-mappers";

type ContactFAQSectionProps = {
  cmsContent: ContactFaqContent | null;
};

export default function ContactFAQSection({ cmsContent }: ContactFAQSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  if (!cmsContent?.items.length) return null;

  const faqs = cmsContent;
  const leftColumn = faqs.items.filter((_, index) => index % 2 !== 0);
  const rightColumn = faqs.items.filter((_, index) => index % 2 === 0);

  const renderQuestion = (item: ContactFaqItem, originalIndex: number) => {
    const isOpen = openIndex === originalIndex;

    return (
      <div
        key={item.question}
        className="group overflow-hidden rounded-2xl border border-white/10 bg-black/20 transition duration-300 hover:-translate-y-1 hover:border-[#d2a75a]/35 hover:shadow-[0_18px_45px_rgba(0,0,0,0.28)]"
      >
        <button
          type="button"
          onClick={() => setOpenIndex(isOpen ? null : originalIndex)}
          className="flex w-full items-center justify-between gap-5 px-5 py-5 text-right"
        >
          <span className="font-semibold text-white/85">
            {item.question}
          </span>

          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#d2a75a]/35 text-[#d2a75a] transition duration-300 group-hover:bg-[#d2a75a] group-hover:text-black">
            {isOpen ? "−" : "+"}
          </span>
        </button>

        {isOpen ? (
          <div className="border-t border-white/10 px-5 pb-5 pt-4 leading-8 text-white/62">
            {item.answer}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <section className="mx-auto max-w-7xl px-5 pb-8 sm:px-8 lg:px-10">
      <div className="rounded-[28px] border border-white/10 bg-white/[0.035] p-7 transition duration-500 hover:border-[#d2a75a]/25">
        {faqs.title.trim() ? (
          <h2 className="text-center text-2xl font-semibold text-[#d2a75a]">
            {faqs.title}
          </h2>
        ) : null}

        <div className={`grid gap-4 md:grid-cols-2 ${faqs.title.trim() ? "mt-7" : ""}`}>
          <div className="grid content-start gap-4">
            {rightColumn.map((item) => {
              const originalIndex = faqs.items.indexOf(item);
              return renderQuestion(item, originalIndex);
            })}
          </div>

          <div className="grid content-start gap-4">
            {leftColumn.map((item) => {
              const originalIndex = faqs.items.indexOf(item);
              return renderQuestion(item, originalIndex);
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
