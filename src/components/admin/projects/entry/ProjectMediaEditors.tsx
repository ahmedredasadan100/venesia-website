"use client";
import { projectMediaSlot } from "../../../../lib/projects/project-hero-adapter";

import { useRef, useState } from "react";

import type {
  ProjectMediaEntry,
  ProjectMediaSection,
  ProjectVideoEntry,
  ProjectVideoSection,
} from "../../../../lib/admin/projects/project-entry-contract";
import AdminMediaGalleryField from "../../media/AdminMediaGalleryField";
import MediaVideoFields from "../../content/editors/media/MediaVideoFields";
import { ADMIN_FORM_STACK_CLASS_NAME } from "../../ui/AdminForm";
import AdminConfirmDialog from "../../ui/AdminConfirmDialog";
import { AdminFormError } from "../../ui/AdminFormRuntime";

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
  const imageErrorKey = `${section}_media_image`;
  const altErrorKey = `${section}_media_alt_text`;
  const [items, setItems] = useState(initialItems.filter((item) => item.section === section));
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [deleteKey, setDeleteKey] = useState<string | null>(null);

  return (
    <div id={`${section}_media_image`} ref={rootRef} className={`${ADMIN_FORM_STACK_CLASS_NAME} scroll-mt-28`} data-project-media-collection={section}>
      {deletedIds.map((id) => (
        <input key={id} type="hidden" name="deleted_media_id" value={id} />
      ))}
      <AdminMediaGalleryField
        valueMode="items"
        name="media_image"
        altName="media_alt_text"
        label="صور المشروع"
        mediaSlot={projectMediaSlot("project-media")}
        browseFolder="images/projects"
        presentation="panel"
        desktopColumns={3}
        addLabel={addLabel}
        emptyLabel={emptyLabel}
        showCaption={false}
        enableDragDrop
        dragFromImage
        focusTargetId={`${section}_media_image_control`}
        altFocusTargetId={`${section}_media_alt_text`}
        errorName={imageErrorKey}
        altErrorName={altErrorKey}
        controlledItems={items.map((item) => ({ key: item.client_key, url: item.image, alt: item.alt_text, caption: "" }))}
        onItemsChange={(change) => {
          setItems((current) => {
            const byKey = new Map(current.map((item) => [item.client_key, item]));
            return change(current.map((item) => ({ key: item.client_key, url: item.image, alt: item.alt_text, caption: "" }))).map((item) => ({
              id: byKey.get(item.key)?.id ?? null,
              client_key: item.key,
              section,
              image: item.url,
              alt_text: item.alt,
            }));
          });
          notifyForm(rootRef.current);
        }}
        renderItemProjection={(item) => <>
          <input type="hidden" name="media_id" value={items.find((current) => current.client_key === item.key)?.id ?? ""} />
          <input type="hidden" name="media_client_key" value={item.key} />
          <input type="hidden" name="media_section" value={section} />
        </>}
        onRequestAdd={() => {
          setItems((current) => [...current, { id: null, client_key: newClientKey(), section, image: "", alt_text: "" }]);
          notifyForm(rootRef.current);
        }}
        onRequestRemove={setDeleteKey}
      />
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
  const urlErrorKey = `${section}_video_url`;
  const posterAltErrorKey = `${section}_video_poster_alt`;
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
    <div id={`${section}_video_url`} ref={rootRef} className={`${ADMIN_FORM_STACK_CLASS_NAME} scroll-mt-28`} data-project-video-collection={section}>
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
          <MediaVideoFields
            presentation="panel"
            videoUrl={item.video_url}
            onVideoUrlChange={(video_url) => update(item.client_key, { video_url })}
            defaultThumbnail={item.poster_image}
            videoThumbnail={item.poster_image}
            onVideoThumbnailChange={(poster_image) => update(item.client_key, { poster_image })}
            nativeBinding={{
              urlId: index === 0 ? `${section}_video_url_input` : `${section}-${item.client_key}-video-url`,
              urlErrorName: urlErrorKey,
              thumbnailName: "video_poster_image",
              thumbnailAltName: "video_poster_alt",
              thumbnailAltId: index === 0 ? `${section}_video_poster_alt` : `${section}-${item.client_key}-poster-alt`,
              thumbnailAltErrorName: posterAltErrorKey,
              thumbnailAlt: item.poster_alt,
              onThumbnailAltChange: (poster_alt) => update(item.client_key, { poster_alt }),
              browseFolder: "images/projects/videos",
              mediaSlot: projectMediaSlot("project-media"),
            }}
          />
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
