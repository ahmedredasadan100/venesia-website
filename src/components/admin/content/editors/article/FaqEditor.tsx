"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { PlusIcon, TrashIcon } from "../../../AdminRowActions";
import {
  AdminActionButton,
  AdminCard,
  AdminConfirmDialog,
  AdminFormField,
  AdminFormGrid,
} from "../../../ui";
import { AdminFormError } from "../../../ui/AdminFormRuntime";
import AdminFormSwitch from "../../../ui/AdminFormSwitch";
import { AdminModuleSectionHeader } from "../../../ui/AdminModuleTabs";
import {
  ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME,
  adminFormFieldClassName,
  adminFormLabelClassName,
  adminFormTextareaClassName,
} from "../../../../../lib/admin/admin-ui-styles";

type FaqItem = { id: string; question: string; answer: string };
type StoredFaqItem = { question?: string; answer?: string };

type FaqEditorProps = {
  presentation?: "default" | "panel";
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
      presentation="premium"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      wrapLabel
    />
  );
}

export default function FaqEditor({
  presentation = "default",
  defaultFaq = [],
  defaultVisible = true,
  defaultTitleVisible = true,
}: FaqEditorProps) {
  const panel = presentation === "panel";
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
      label="إظهار القسم"
      checked={showSection}
      onChange={setShowSection}
    />
  );

  const faqListHeader = (
    <AdminModuleSectionHeader
      id="topic-faq-list"
      sectionHeading="الأسئلة الشائعة (FAQ)"
      icon="faq"
      sectionHeaderPresentation={panel ? "premium" : undefined}
      sectionHeaderClassName={panel ? ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME : undefined}
      sectionSummary={<span className="rounded-full border border-[#D8B87A]/25 bg-[#D8B87A]/10 px-4 py-2 text-sm text-[#F2D99B]">{filledCount} مكتمل من {items.length}</span>}
    />
  );
  const faqSettingsHeader = (
    <AdminModuleSectionHeader
      id="topic-faq-settings"
      sectionHeading="إعدادات العرض"
      icon="settings"
      sectionHeaderPresentation={panel ? "premium" : undefined}
      sectionHeaderClassName={panel ? ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME : undefined}
    />
  );
  const faqPreviewHeader = (
    <AdminModuleSectionHeader
      id="topic-faq-preview"
      sectionHeading="معاينة الشكل في الصفحة"
      icon="overview"
      sectionHeaderPresentation={panel ? "premium" : undefined}
      sectionHeaderClassName={panel ? ADMIN_PREMIUM_HEADER_CHARCOAL_SURFACE_CLASS_NAME : undefined}
    />
  );
  const faqSettingsContent = (
    <>
      {faqSettingsHeader}
      <AdminFormGrid columns={1}>
        {faqVisibilitySwitch}
        <FaqDisplaySwitch name="show_faq_title_on_page" label="إظهار عنوان القسم" checked={showTitle} onChange={setShowTitle} />
      </AdminFormGrid>
    </>
  );

  return (
    <section id="topic-faq-editor" ref={rootRef} className="scroll-mt-24" data-topic-faq-editor data-topic-faq-presentation={panel ? "panel" : undefined}>
      <input type="hidden" name="faq_editor_present" value="true" />
      <AdminFormError name="faq_question" />
      <AdminFormGrid
        columns={1}
        presentation="equal-height-columns"
        className="gap-5 xl:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.45fr)]"
      >
        <div className="min-w-0 xl:col-start-2 xl:row-start-1" data-topic-faq-list>
          {panel ? null : faqListHeader}
          <AdminCard presentation="premium" className={panel ? "min-w-0 p-3" : "p-4 md:p-5"}>
          {panel ? faqListHeader : null}

          <div className="space-y-3">
            {items.map((item, index) => {
              const expanded = openId === item.id;
              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => setDraggedId(item.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleDrop(event, item.id)}
                  data-faq-item
                >
                  <AdminCard presentation="premium">
                  <div className="flex flex-wrap items-center gap-2 p-3">
                    <span aria-hidden className="text-white/45">{expanded ? "⌃" : "⌄"}</span>
                    <AdminActionButton type="button" variant="ghost" onClick={() => setOpenId(expanded ? null : item.id)} className="min-w-0 flex-1 justify-start text-right" aria-expanded={expanded}>
                      <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-white/78">{item.question.trim() || `سؤال رقم ${index + 1}`}</span>
                      {!expanded && item.answer.trim() ? <span className="mt-1 block truncate text-xs text-white/35">{item.answer}</span> : null}
                      </span>
                    </AdminActionButton>
                    <div className="flex w-full shrink-0 items-center justify-end gap-1 sm:w-auto">
                      <AdminActionButton type="button" size="icon" onClick={() => moveItem(item.id, items[Math.max(0, index - 1)]?.id ?? item.id)} disabled={index === 0} aria-label="تحريك السؤال لأعلى" title="تحريك السؤال لأعلى">↑</AdminActionButton>
                      <AdminActionButton type="button" size="icon" onClick={() => moveItem(item.id, items[Math.min(items.length - 1, index + 1)]?.id ?? item.id)} disabled={index === items.length - 1} aria-label="تحريك السؤال لأسفل" title="تحريك السؤال لأسفل">↓</AdminActionButton>
                      <AdminActionButton
                        buttonRef={pendingDeleteId === item.id ? deleteButtonRef : undefined}
                        type="button"
                        size="icon"
                        variant="danger"
                        onClick={() => setPendingDeleteId(item.id)}
                        aria-label="حذف السؤال"
                        title="حذف السؤال"
                      >
                        <TrashIcon className="size-5" />
                      </AdminActionButton>
                      <span className="cursor-grab select-none rounded-md px-1.5 py-1 text-white/30 active:cursor-grabbing" title="اسحب لإعادة الترتيب" aria-hidden>⠿</span>
                    </div>
                  </div>
                  {expanded ? (
                    <AdminFormGrid columns={1} className="border-t border-white/10 p-4">
                      <AdminFormField label="السؤال" labelClassName={panel ? adminFormLabelClassName({ textInset: true }) : undefined}>
                        <input name="faq_question" value={item.question} onChange={(event) => updateItem(item.id, "question", event.target.value)} placeholder="اكتب السؤال بوضوح" className={adminFormFieldClassName()} />
                      </AdminFormField>
                      <AdminFormField label="الإجابة" labelClassName={panel ? adminFormLabelClassName({ textInset: true }) : undefined}>
                        <textarea name="faq_answer" value={item.answer} onChange={(event) => updateItem(item.id, "answer", event.target.value)} rows={4} placeholder="اكتب إجابة مباشرة ومفيدة" className={adminFormTextareaClassName("resize-y leading-7")} />
                      </AdminFormField>
                    </AdminFormGrid>
                  ) : (
                    <>
                      <input type="hidden" name="faq_question" value={item.question} />
                      <textarea hidden readOnly name="faq_answer" value={item.answer} />
                    </>
                  )}
                  </AdminCard>
                </div>
              );
            })}
          </div>

          <AdminActionButton type="button" variant="gold" onClick={addItem} disabled={items.length >= 8} className="mt-4">
            <PlusIcon className="size-5" />
            إضافة سؤال جديد
          </AdminActionButton>
          </AdminCard>
        </div>

        <aside className="space-y-4 xl:col-start-1 xl:row-start-1">
          <section data-topic-faq-settings>
            {panel ? (
              <AdminCard presentation="premium" className="min-w-0 p-3">{faqSettingsContent}</AdminCard>
            ) : faqSettingsContent}
          </section>

          <section data-topic-faq-preview>
            {panel ? null : faqPreviewHeader}
            <AdminCard presentation="premium" className={panel ? "min-w-0 p-3" : "p-4"}>
              {panel ? faqPreviewHeader : null}
              {!showSection ? (
                <p className="text-xs leading-6 text-white/38">قسم الأسئلة الشائعة مخفي من الصفحة.</p>
              ) : (
                <div className="space-y-2">
                  {previewItems.length ? previewItems.map((item, index) => (
                    <div key={item.id} className="rounded-lg border border-white/8 bg-black/20 px-3 py-2.5">
                      <p className="text-xs font-medium leading-5 text-white/68">{item.question || `سؤال رقم ${index + 1}`}</p>
                      {index === 0 && item.answer ? <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-white/35">{item.answer}</p> : null}
                    </div>
                  )) : <p className="text-xs leading-6 text-white/38">أضف سؤالًا لمعاينة شكل القسم.</p>}
                </div>
              )}
            </AdminCard>
          </section>
        </aside>
      </AdminFormGrid>

      <AdminConfirmDialog open={Boolean(pendingDeleteId)} title="حذف السؤال؟" description="سيُحذف السؤال وإجابته من النموذج الحالي. لن يُحفظ الحذف قبل حفظ الموضوع." confirmLabel="حذف السؤال" onCancel={() => setPendingDeleteId(null)} onConfirm={() => { setItems((current) => current.filter((item) => item.id !== pendingDeleteId)); setPendingDeleteId(null); }} returnFocusRef={deleteButtonRef} />
    </section>
  );
}
