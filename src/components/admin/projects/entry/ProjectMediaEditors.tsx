"use client";

import { useRef, useState } from "react";

import type {
  ProjectMediaEntry,
  ProjectMediaSection,
  ProjectVideoEntry,
  ProjectVideoSection,
} from "../../../../lib/admin/projects/project-entry-contract";
import {
  adminFormFieldClassName,
  adminFormLabelClassName,
} from "../../../../lib/admin/admin-ui-styles";
import AdminMediaImageField from "../../media/AdminMediaImageField";
import AdminConfirmDialog from "../../ui/AdminConfirmDialog";
import { AdminFormError, useOptionalAdminFormRuntime } from "../../ui/AdminFormRuntime";

const fieldClass = adminFormFieldClassName();
const labelClass = adminFormLabelClassName();
const outlineButton =
  "inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[#D8B87A]/30 bg-[#D8B87A]/10 px-4 py-2.5 text-sm font-semibold text-[#D8B87A] transition hover:bg-[#D8B87A]/18 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70 sm:w-auto";
const iconButton =
  "inline-grid size-9 cursor-pointer place-items-center rounded-xl border border-white/10 bg-black/25 text-white/50 transition hover:border-[#D8B87A]/35 hover:text-[#D8B87A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D8B87A]/70 disabled:cursor-not-allowed disabled:opacity-40";
const deleteButton =
  "inline-grid size-9 cursor-pointer place-items-center rounded-xl border border-red-400/25 bg-red-500/5 text-red-300 transition hover:border-red-400/40 hover:bg-red-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300/70";
const mediaCardClass =
  "rounded-2xl border border-white/10 bg-[#05070B]/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]";
const emptyStateClass =
  "rounded-xl border border-dashed border-white/12 bg-black/20 px-5 py-8 text-center text-sm text-white/35";

function newClientKey() {
  return crypto.randomUUID();
}

function notifyForm(root: HTMLElement | null) {
  queueMicrotask(() => root?.closest("form")?.dispatchEvent(new Event("input", { bubbles: true })));
}

function moveItem<T>(items: T[], from: number, to: number) {
  if (from < 0 || to < 0 || from === to || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item === undefined) return items;
  next.splice(to, 0, item);
  return next;
}

function Ordering({
  index,
  count,
  move,
  itemLabel,
}: {
  index: number;
  count: number;
  move: (to: number) => void;
  itemLabel: string;
}) {
  return (
    <div className="flex gap-1">
      <button type="button" className={iconButton} disabled={index === 0} onClick={() => move(index - 1)} aria-label={`تحريك ${itemLabel} لأعلى`}>↑</button>
      <button type="button" className={iconButton} disabled={index === count - 1} onClick={() => move(index + 1)} aria-label={`تحريك ${itemLabel} لأسفل`}>↓</button>
    </div>
  );
}

export function ProjectImageCollectionEditor({
  section,
  initialItems,
  addLabel = "إضافة صورة",
  emptyLabel = "لا توجد صور بعد.",
}: {
  section: ProjectMediaSection;
  initialItems: ProjectMediaEntry[];
  addLabel?: string;
  emptyLabel?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const runtime = useOptionalAdminFormRuntime();
  const imageErrorKey = `${section}_media_image`;
  const altErrorKey = `${section}_media_alt_text`;
  const hasAltError = Boolean(runtime?.fieldErrors[altErrorKey]?.length);
  const [items, setItems] = useState(initialItems.filter((item) => item.section === section));
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [deleteKey, setDeleteKey] = useState<string | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);

  function update(key: string, patch: Partial<ProjectMediaEntry>) {
    setItems((current) => current.map((item) => item.client_key === key ? { ...item, ...patch } : item));
  }

  function reorder(from: number, to: number) {
    setItems((current) => moveItem(current, from, to));
    notifyForm(rootRef.current);
  }

  return (
    <div id={`${section}_media_image`} ref={rootRef} className="space-y-3 scroll-mt-28" data-project-media-collection={section}>
      {deletedIds.map((id) => (
        <input key={id} type="hidden" name="deleted_media_id" value={id} />
      ))}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item, index) => (
          <article
            key={item.client_key}
            draggable={!runtime?.pending}
            onDragStart={() => setDragKey(item.client_key)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              reorder(items.findIndex((candidate) => candidate.client_key === dragKey), index);
              setDragKey(null);
            }}
            className={`${mediaCardClass} min-w-0 p-3`}
          >
            <input type="hidden" name="media_id" value={item.id ?? ""} />
            <input type="hidden" name="media_client_key" value={item.client_key} />
            <input type="hidden" name="media_section" value={section} />
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-bold text-[#D8B87A]/75">{String(index + 1).padStart(2, "0")}</span>
              <span className="cursor-grab text-lg tracking-[-3px] text-white/35" aria-hidden>⠿</span>
            </div>
            <AdminMediaImageField
              name="media_image"
              label={`صورة ${index + 1}`}
              defaultValue={item.image}
              browseFolder="images/projects"
              appearance="dark"
              variant="compact"
              showLabel={false}
              compactAspectClassName="aspect-[4/3]"
              onValueChange={(image) => update(item.client_key, { image })}
            />
            <label className={`${labelClass} mt-3`}>
              النص البديل
              <input
                id={index === 0 ? `${section}_media_alt_text` : undefined}
                name="media_alt_text"
                value={item.alt_text}
                onChange={(event) => update(item.client_key, { alt_text: event.target.value })}
                className={`${fieldClass} mt-1`}
                placeholder="صف الصورة بوضوح"
                aria-invalid={hasAltError || undefined}
                aria-describedby={hasAltError ? `${altErrorKey}-error` : undefined}
              />
            </label>
            <div className="mt-3 flex items-center justify-between gap-2">
              <Ordering index={index} count={items.length} move={(to) => reorder(index, to)} itemLabel="الصورة" />
              <button type="button" className={deleteButton} onClick={() => setDeleteKey(item.client_key)} aria-label={`حذف الصورة ${index + 1}`}>⌫</button>
            </div>
          </article>
        ))}
      </div>

      {!items.length ? <p className={emptyStateClass}>{emptyLabel}</p> : null}
      <AdminFormError name={imageErrorKey} />
      <AdminFormError name={altErrorKey} />
      <button type="button" className={outlineButton} onClick={() => { setItems((current) => [...current, { id: null, client_key: newClientKey(), section, image: "", alt_text: "" }]); notifyForm(rootRef.current); }}>+ {addLabel}</button>

      <AdminConfirmDialog
        open={Boolean(deleteKey)}
        title="حذف الصورة من المشروع؟"
        description="سيُحذف الارتباط عند الحفظ فقط، ولن يُحذف أصل الميديا دون سياسة الحذف الآمن."
        confirmLabel="حذف الارتباط"
        tone="danger"
        onCancel={() => setDeleteKey(null)}
        onConfirm={() => {
          const deleted = items.find((item) => item.client_key === deleteKey);
          if (deleted?.id) {
            setDeletedIds((current) =>
              current.includes(deleted.id!) ? current : [...current, deleted.id!],
            );
          }
          setItems((current) => current.filter((item) => item.client_key !== deleteKey));
          setDeleteKey(null);
          notifyForm(rootRef.current);
        }}
      />
    </div>
  );
}

export function ProjectVideoCollectionEditor({
  section,
  initialItems,
  maxItems,
}: {
  section: ProjectVideoSection;
  initialItems: ProjectVideoEntry[];
  maxItems?: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const runtime = useOptionalAdminFormRuntime();
  const urlErrorKey = `${section}_video_url`;
  const posterAltErrorKey = `${section}_video_poster_alt`;
  const hasUrlError = Boolean(runtime?.fieldErrors[urlErrorKey]?.length);
  const hasPosterAltError = Boolean(runtime?.fieldErrors[posterAltErrorKey]?.length);
  const [items, setItems] = useState(() => {
    const scoped = initialItems.filter((item) => item.section === section);
    return maxItems === undefined ? scoped : scoped.slice(0, maxItems);
  });
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [deleteKey, setDeleteKey] = useState<string | null>(null);

  function update(key: string, patch: Partial<ProjectVideoEntry>) {
    setItems((current) => current.map((item) => item.client_key === key ? { ...item, ...patch } : item));
  }

  function reorder(index: number, to: number) {
    setItems((current) => moveItem(current, index, to));
    notifyForm(rootRef.current);
  }

  return (
    <div id={`${section}_video_url`} ref={rootRef} className="space-y-3 scroll-mt-28" data-project-video-collection={section}>
      {deletedIds.map((id) => (
        <input key={id} type="hidden" name="deleted_video_id" value={id} />
      ))}
      {items.map((item, index) => (
        <article key={item.client_key} className={`${mediaCardClass} min-w-0 p-4`}>
          <input type="hidden" name="video_id" value={item.id ?? ""} />
          <input type="hidden" name="video_client_key" value={item.client_key} />
          <input type="hidden" name="video_section" value={section} />
          <div className="mb-3 flex items-center justify-between gap-3">
            <strong className="text-sm text-white/85">فيديو {index + 1}</strong>
            <div className="flex gap-1">
              {!maxItems || maxItems > 1 ? <Ordering index={index} count={items.length} move={(to) => reorder(index, to)} itemLabel="الفيديو" /> : null}
              <button type="button" className={deleteButton} onClick={() => setDeleteKey(item.client_key)} aria-label="حذف الفيديو">⌫</button>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-3">
              <label className={labelClass}>
                رابط الفيديو
                <input id={index === 0 ? `${section}_video_url_input` : undefined} name="video_url" value={item.video_url} onChange={(event) => update(item.client_key, { video_url: event.target.value })} className={`${fieldClass} mt-1 text-left font-mono text-xs`} dir="ltr" placeholder="https://www.youtube.com/watch?v=..." aria-invalid={hasUrlError || undefined} aria-describedby={hasUrlError ? `${urlErrorKey}-error` : undefined} />
              </label>
              {item.video_url ? (
                <a href={item.video_url} target="_blank" rel="noreferrer" className="inline-flex text-xs font-semibold text-[#D8B87A] hover:text-[#E6C98D] hover:underline">فتح معاينة الفيديو ↗</a>
              ) : null}
              <label className={labelClass}>
                النص البديل لصورة الغلاف
                <input id={index === 0 ? `${section}_video_poster_alt` : undefined} name="video_poster_alt" value={item.poster_alt} onChange={(event) => update(item.client_key, { poster_alt: event.target.value })} className={`${fieldClass} mt-1`} aria-invalid={hasPosterAltError || undefined} aria-describedby={hasPosterAltError ? `${posterAltErrorKey}-error` : undefined} />
              </label>
            </div>
            <div>
              <AdminMediaImageField name="video_poster_image" label="صورة الغلاف" defaultValue={item.poster_image} browseFolder="images/projects/videos" appearance="dark" variant="compact" compactAspectClassName="aspect-video" onValueChange={(poster_image) => update(item.client_key, { poster_image })} />
            </div>
          </div>
        </article>
      ))}

      {!items.length ? <p className={emptyStateClass}>لا توجد فيديوهات بعد.</p> : null}
      <AdminFormError name={urlErrorKey} />
      <AdminFormError name={posterAltErrorKey} />
      {maxItems === undefined || items.length < maxItems ? (
        <button type="button" className={outlineButton} onClick={() => { setItems((current) => [...current, { id: null, client_key: newClientKey(), section, video_url: "", poster_image: "", poster_alt: "" }]); notifyForm(rootRef.current); }}>+ إضافة فيديو</button>
      ) : null}

      <AdminConfirmDialog
        open={Boolean(deleteKey)}
        title="حذف الفيديو من المشروع؟"
        description="سيُحذف الرابط وصورة الغلاف من بيانات المشروع عند الحفظ."
        confirmLabel="حذف الفيديو"
        tone="danger"
        onCancel={() => setDeleteKey(null)}
        onConfirm={() => {
          const deleted = items.find((item) => item.client_key === deleteKey);
          if (deleted?.id) {
            setDeletedIds((current) =>
              current.includes(deleted.id!) ? current : [...current, deleted.id!],
            );
          }
          setItems((current) => current.filter((item) => item.client_key !== deleteKey));
          setDeleteKey(null);
          notifyForm(rootRef.current);
        }}
      />
    </div>
  );
}
