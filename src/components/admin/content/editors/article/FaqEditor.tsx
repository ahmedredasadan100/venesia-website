"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { TrashIcon } from "../../../AdminRowActions";
import { AdminConfirmDialog } from "../../../ui";
import { AdminFormError } from "../../../ui/AdminFormRuntime";
import AdminFormSwitch from "../../../ui/AdminFormSwitch";

type FaqItem = { id: string; question: string; answer: string };
type StoredFaqItem = { question?: string; answer?: string };

type FaqEditorProps = {
  defaultFaq?: StoredFaqItem[];
  defaultVisible?: boolean | null;
  defaultTitleVisible?: boolean | null;
};

function makeItem(item?: StoredFaqItem): FaqItem {
  return {
    id: `faq-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    question: item?.question ?? "",
    answer: item?.answer ?? "",
  };
}

function FaqDisplaySwitch({
  name,
  label,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <AdminFormSwitch
      name={name}
      label={label}
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      surface
      className="w-full justify-between"
      wrapLabel
    />
  );
}

export default function FaqEditor({
  defaultFaq = [],
  defaultVisible = true,
  defaultTitleVisible = true,
}: FaqEditorProps) {
  const [items, setItems] = useState<FaqItem[]>(() => defaultFaq.map(makeItem));
  const [openId, setOpenId] = useState<string | null>(() => defaultFaq.length ? null : "new");
  const [showSection, setShowSection] = useState(defaultVisible !== false);
  const [showTitle, setShowTitle] = useState(defaultTitleVisible !== false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const filledCount = useMemo(
    () => items.filter((item) => item.question.trim() && item.answer.trim()).length,
    [items],
  );
  const previewItems = useMemo(
    () => items.filter((item) => item.question.trim() || item.answer.trim()).slice(0, 3),
    [items],
  );

  useEffect(() => {
    rootRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [items]);

  function updateItem(id: string, key: "question" | "answer", value: string) {
    setItems((current) => current.map((item) => item.id === id ? { ...item, [key]: value } : item));
  }

  function addItem() {
    if (items.length >= 8) return;
    const item = makeItem();
    setItems((current) => [...current, item]);
    setOpenId(item.id);
  }

  function moveItem(fromId: string, toId: string) {
    if (fromId === toId) return;
    setItems((current) => {
      const from = current.findIndex((item) => item.id === fromId);
      const to = current.findIndex((item) => item.id === toId);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, toId: string) {
    event.preventDefault();
    if (draggedId) moveItem(draggedId, toId);
    setDraggedId(null);
  }

  const faqVisibilitySwitch = (
    <FaqDisplaySwitch
      name="show_faq_on_page"
      label="إظهار قسم الأسئلة الشائعة في الصفحة"
      checked={showSection}
      onChange={setShowSection}
    />
  );

  return (
    <section id="topic-faq-editor" ref={rootRef} className="scroll-mt-24 rounded-[24px] border border-white/10 bg-[#080B10]/92 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] md:p-6" data-topic-faq-editor>
      <input type="hidden" name="faq_editor_present" value="true" />
      <AdminFormError name="faq_question" />
      <div className="grid gap-5 xl:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.45fr)] xl:items-start">
        <div className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-4 md:p-5 xl:col-start-2 xl:row-start-1" data-topic-faq-list>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-white">الأسئلة الشائعة (FAQ)</h3>
              <p className="mt-2 text-sm leading-7 text-white/45">أضف أسئلة حقيقية تساعد القارئ، ثم رتّبها بالسحب.</p>
            </div>
            <span className="rounded-full border border-[#D8B87A]/25 bg-[#D8B87A]/10 px-4 py-2 text-sm text-[#F2D99B]">{filledCount} مكتمل من {items.length}</span>
          </div>

          <div className="mt-5 space-y-3">
            {items.map((item, index) => {
              const expanded = openId === item.id;
              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => setDraggedId(item.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleDrop(event, item.id)}
                  className="rounded-xl border border-white/10 bg-[#090D12]"
                  data-faq-item
                >
                  <div className="flex items-center gap-2 px-3 py-3">
                    <span aria-hidden className="text-white/45">{expanded ? "⌃" : "⌄"}</span>
                    <button type="button" onClick={() => setOpenId(expanded ? null : item.id)} className="min-w-0 flex-1 text-right" aria-expanded={expanded}>
                      <span className="block truncate text-sm font-medium text-white/78">{item.question.trim() || `سؤال رقم ${index + 1}`}</span>
                      {!expanded && item.answer.trim() ? <span className="mt-1 block truncate text-xs text-white/35">{item.answer}</span> : null}
                    </button>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button type="button" onClick={() => moveItem(item.id, items[Math.max(0, index - 1)]?.id ?? item.id)} disabled={index === 0} aria-label="تحريك السؤال لأعلى" title="تحريك السؤال لأعلى" className="rounded-md px-1.5 py-1 text-white/40 hover:bg-white/5 disabled:opacity-20">↑</button>
                      <button type="button" onClick={() => moveItem(item.id, items[Math.min(items.length - 1, index + 1)]?.id ?? item.id)} disabled={index === items.length - 1} aria-label="تحريك السؤال لأسفل" title="تحريك السؤال لأسفل" className="rounded-md px-1.5 py-1 text-white/40 hover:bg-white/5 disabled:opacity-20">↓</button>
                      <button
                        ref={pendingDeleteId === item.id ? deleteButtonRef : undefined}
                        type="button"
                        onClick={() => setPendingDeleteId(item.id)}
                        aria-label="حذف السؤال"
                        title="حذف السؤال"
                        className="inline-flex size-8 items-center justify-center rounded-lg text-red-400 transition hover:bg-red-400/10 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
                      >
                        <TrashIcon />
                      </button>
                      <span className="cursor-grab select-none rounded-md px-1.5 py-1 text-white/30" title="اسحب لإعادة الترتيب" aria-hidden>⠿</span>
                    </div>
                  </div>
                  {expanded ? (
                    <div className="grid gap-4 border-t border-white/10 p-4">
                      <label className="grid gap-2 text-sm text-white/65">
                        السؤال
                        <input name="faq_question" value={item.question} onChange={(event) => updateItem(item.id, "question", event.target.value)} placeholder="اكتب السؤال بوضوح" className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-[#D8B87A]/45" />
                      </label>
                      <label className="grid gap-2 text-sm text-white/65">
                        الإجابة
                        <textarea name="faq_answer" value={item.answer} onChange={(event) => updateItem(item.id, "answer", event.target.value)} rows={4} placeholder="اكتب إجابة مباشرة ومفيدة" className="resize-y rounded-xl border border-white/10 bg-black/30 px-4 py-3 leading-7 text-white outline-none focus:border-[#D8B87A]/45" />
                      </label>
                    </div>
                  ) : (
                    <>
                      <input type="hidden" name="faq_question" value={item.question} />
                      <textarea hidden readOnly name="faq_answer" value={item.answer} />
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <button type="button" onClick={addItem} disabled={items.length >= 8} className="mt-4 rounded-xl border border-dashed border-[#D8B87A]/35 px-4 py-3 text-sm font-semibold text-[#D8B87A] hover:bg-[#D8B87A]/8 disabled:opacity-40">＋ إضافة سؤال جديد</button>
        </div>

        <aside className="space-y-4 xl:col-start-1 xl:row-start-1">
          <section className="rounded-2xl border border-white/10 bg-black/20 p-4" data-topic-faq-settings>
            <h3 className="text-base font-semibold text-white">إعدادات العرض</h3>
            <div className="mt-4 space-y-2">
              {faqVisibilitySwitch}
              <FaqDisplaySwitch name="show_faq_title_on_page" label="إظهار عنوان قسم الأسئلة الشائعة" checked={showTitle} onChange={setShowTitle} />
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-black/20 p-4" data-topic-faq-preview>
            <h3 className="text-base font-semibold text-white">معاينة الشكل في الصفحة</h3>
            <div className="mt-4 rounded-xl border border-white/10 bg-[#090D12] p-3">
              {!showSection ? (
                <p className="text-xs leading-6 text-white/38">قسم الأسئلة الشائعة مخفي من الصفحة.</p>
              ) : (
                <>
                  {showTitle ? <p className="text-sm font-semibold text-[#D8B87A]">الأسئلة الشائعة</p> : null}
                  <div className={showTitle ? "mt-3 space-y-2" : "space-y-2"}>
                    {previewItems.length ? previewItems.map((item, index) => (
                      <div key={item.id} className="rounded-lg border border-white/8 bg-black/20 px-3 py-2.5">
                        <p className="text-xs font-medium leading-5 text-white/68">{item.question || `سؤال رقم ${index + 1}`}</p>
                        {index === 0 && item.answer ? <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-white/35">{item.answer}</p> : null}
                      </div>
                    )) : <p className="text-xs leading-6 text-white/38">أضف سؤالًا لمعاينة شكل القسم.</p>}
                  </div>
                </>
              )}
            </div>
          </section>
        </aside>
      </div>

      <AdminConfirmDialog open={Boolean(pendingDeleteId)} title="حذف السؤال؟" description="سيُحذف السؤال وإجابته من النموذج الحالي. لن يُحفظ الحذف قبل حفظ الموضوع." confirmLabel="حذف السؤال" onCancel={() => setPendingDeleteId(null)} onConfirm={() => { setItems((current) => current.filter((item) => item.id !== pendingDeleteId)); setPendingDeleteId(null); }} returnFocusRef={deleteButtonRef} />
    </section>
  );
}
