"use client";

import { useMemo, useState } from "react";

type FaqItem = {
  question?: string;
  answer?: string;
};

type FaqEditorProps = {
  defaultFaq?: FaqItem[];
};

const emptyFaq: FaqItem = { question: "", answer: "" };

export default function FaqEditor({ defaultFaq = [] }: FaqEditorProps) {
  const initialItems = defaultFaq.length > 0 ? defaultFaq : [emptyFaq, emptyFaq, emptyFaq];
  const [items, setItems] = useState<FaqItem[]>(initialItems.slice(0, 8));

  const filledCount = useMemo(
    () => items.filter((item) => item.question?.trim() && item.answer?.trim()).length,
    [items]
  );

  function updateItem(index: number, key: keyof FaqItem, value: string) {
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item))
    );
  }

  function removeItem(index: number) {
    setItems((current) => (current.length <= 1 ? current : current.filter((_, itemIndex) => itemIndex !== index)));
  }

  return (
    <section className="rounded-[28px] border border-white/10 bg-[#080B10]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
      <div className="flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-en text-xs tracking-[0.34em] text-[#D8B87A]/70">FAQ SCHEMA</p>
          <h3 className="mt-3 text-2xl font-semibold text-white">الأسئلة الشائعة</h3>
          <p className="mt-2 text-sm leading-7 text-white/50">
            أضف أسئلة حقيقية يبحث عنها العميل. الأفضل من 3 إلى 6 أسئلة واضحة بإجابات مختصرة.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-[22px] border border-[#D8B87A]/25 bg-[#D8B87A]/10 px-5 py-4 text-center">
            <p className="font-en text-3xl font-semibold text-[#D8B87A]">{filledCount}</p>
            <p className="mt-1 text-xs text-white/50">سؤال مكتمل</p>
          </div>

          <button
            type="button"
            onClick={() => setItems((current) => [...current, emptyFaq].slice(0, 8))}
            disabled={items.length >= 8}
            className="rounded-full border border-[#D8B87A]/35 px-5 py-3 text-sm font-medium text-[#D8B87A] transition hover:bg-[#D8B87A]/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            إضافة سؤال
          </button>
        </div>
      </div>

      <div className="mt-6 space-y-5">
        {items.map((item, index) => {
          const isComplete = Boolean(item.question?.trim() && item.answer?.trim());

          return (
            <div key={index} className="rounded-[22px] border border-white/10 bg-black/25 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[#D8B87A]">سؤال رقم {index + 1}</p>

                <div className="flex items-center gap-2">
                  <span
                    className={
                      isComplete
                        ? "rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200"
                        : "rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/40"
                    }
                  >
                    {isComplete ? "مكتمل" : "غير مكتمل"}
                  </span>

                  {items.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="rounded-full border border-red-400/20 px-3 py-1 text-xs text-red-200 transition hover:bg-red-400/10"
                    >
                      حذف
                    </button>
                  ) : null}
                </div>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-white/65">السؤال</span>
                <input
                  name="faq_question"
                  value={item.question ?? ""}
                  onChange={(event) => updateItem(index, "question", event.target.value)}
                  placeholder="مثال: هل بيت الوطن مناسب للاستثمار؟"
                  className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45"
                />
              </label>

              <label className="mt-4 block">
                <span className="text-sm font-medium text-white/65">الإجابة</span>
                <textarea
                  name="faq_answer"
                  value={item.answer ?? ""}
                  onChange={(event) => updateItem(index, "answer", event.target.value)}
                  rows={4}
                  placeholder="اكتب إجابة واضحة ومباشرة..."
                  className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm leading-7 text-white outline-none placeholder:text-white/25 focus:border-[#D8B87A]/45"
                />
              </label>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-[20px] border border-[#D8B87A]/20 bg-[#D8B87A]/8 p-4">
        <p className="text-sm font-semibold text-[#F2D99B]">ملاحظة SEO</p>
        <p className="mt-2 text-sm leading-7 text-white/50">
          الأسئلة الشائعة القوية لا تكرر الكلام. استخدم أسئلة يبحث عنها العميل فعلًا مثل الموقع، السداد، التسليم، الرخصة، والفرق بين المناطق.
        </p>
      </div>
    </section>
  );
}
