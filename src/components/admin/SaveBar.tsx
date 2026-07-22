"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useFormStatus } from "react-dom";
import { AdminStickyFormBar } from "./ui";
import TopicPreviousTabButton from "./content/editors/article/TopicPreviousTabButton";

type TopicFormAction = (formData: FormData) => void | Promise<void>;
type SaveActionName =
  | "save"
  | "save-and-close"
  | "draft"
  | "publish"
  | "unpublish";

type SaveBarSharedProps = {
  closeHref?: string;
};

type CreateSaveBarProps = SaveBarSharedProps & {
  mode: "create";
};

type EditSaveBarProps = SaveBarSharedProps & {
  mode: "edit";
  topicId: number | string;
  slug?: string | null;
  status?: string | null;
  saveAction: TopicFormAction;
  saveAndCloseAction: TopicFormAction;
  draftAction: TopicFormAction;
  publishAction: TopicFormAction;
  unpublishAction: TopicFormAction;
};

type SaveBarProps = CreateSaveBarProps | EditSaveBarProps;

const LEAVE_WARNING = "لديك تعديلات غير محفوظة. هل تريد الإغلاق دون حفظها؟";
const ACTION_LABELS: Record<SaveActionName, string> = {
  save: "جارٍ الحفظ...",
  "save-and-close": "جارٍ الحفظ والإغلاق...",
  draft: "جارٍ التحويل...",
  publish: "جارٍ النشر...",
  unpublish: "جارٍ الإخفاء...",
};

const buttonBaseClassName =
  "inline-flex min-h-11 min-w-[7.5rem] flex-1 items-center justify-center rounded-full px-3 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]/70 disabled:cursor-not-allowed disabled:opacity-45 sm:min-w-[8.5rem] sm:flex-none sm:px-4";

function serializeForm(form: HTMLFormElement) {
  return JSON.stringify(
    Array.from(new FormData(form).entries()).map(([name, value]) => [
      name,
      typeof value === "string"
        ? value
        : `${value.name}:${value.size}:${value.type}:${value.lastModified}`,
    ]),
  );
}

function getSaveActionName(submitter: HTMLElement | null): SaveActionName {
  const action = submitter?.dataset.topicSaveAction;
  if (
    action === "save-and-close" ||
    action === "draft" ||
    action === "publish" ||
    action === "unpublish"
  ) {
    return action;
  }
  return "save";
}

export default function SaveBar(props: SaveBarProps) {
  const router = useRouter();
  const { pending } = useFormStatus();
  const rootRef = useRef<HTMLDivElement>(null);
  const initialFormRef = useRef("");
  const dirtyRef = useRef(false);
  const allowNavigationRef = useRef(false);
  const wasPendingRef = useRef(false);
  const pendingRef = useRef(false);
  const [isDirty, setIsDirty] = useState(false);
  const [activeAction, setActiveAction] = useState<SaveActionName | null>(null);
  const closeHref = props.closeHref ?? "/admin/content/topics";
  const isPublished = props.mode === "edit" && props.status === "published";
  const canConvertToDraft = props.mode === "edit" && props.status !== "draft";

  function updateDirty(nextDirty: boolean) {
    dirtyRef.current = nextDirty;
    setIsDirty(nextDirty);
  }

  useLayoutEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;
    initialFormRef.current = serializeForm(form);
  }, []);

  useEffect(() => {
    const closestForm = rootRef.current?.closest("form");
    if (!closestForm) return;
    const form: HTMLFormElement = closestForm;

    function handleFormChange() {
      updateDirty(serializeForm(form) !== initialFormRef.current);
    }

    function handleSubmit(event: SubmitEvent) {
      setActiveAction(getSaveActionName(event.submitter as HTMLElement | null));
      allowNavigationRef.current = true;
      updateDirty(false);
    }

    form.addEventListener("input", handleFormChange);
    form.addEventListener("change", handleFormChange);
    form.addEventListener("submit", handleSubmit);
    return () => {
      form.removeEventListener("input", handleFormChange);
      form.removeEventListener("change", handleFormChange);
      form.removeEventListener("submit", handleSubmit);
    };
  }, []);

  useEffect(() => {
    pendingRef.current = pending;
    if (pending) {
      wasPendingRef.current = true;
      return;
    }
    if (!wasPendingRef.current) return;

    wasPendingRef.current = false;
    allowNavigationRef.current = false;
    setActiveAction(null);
    const form = rootRef.current?.closest("form");
    if (form) updateDirty(serializeForm(form) !== initialFormRef.current);
  }, [pending]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirtyRef.current || allowNavigationRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    }

    function handleLinkNavigation(event: MouseEvent) {
      if (pendingRef.current) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (
        !dirtyRef.current ||
        allowNavigationRef.current ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      const anchor = target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const destination = new URL(anchor.href, window.location.href);
      const current = new URL(window.location.href);
      if (
        destination.origin === current.origin &&
        destination.pathname === current.pathname &&
        destination.search === current.search
      ) {
        return;
      }

      if (window.confirm(LEAVE_WARNING)) {
        allowNavigationRef.current = true;
        updateDirty(false);
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleLinkNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleLinkNavigation, true);
    };
  }, []);

  function closeWithoutSaving() {
    if (pending) return;
    if (dirtyRef.current && !window.confirm(LEAVE_WARNING)) return;
    allowNavigationRef.current = true;
    updateDirty(false);
    router.push(closeHref);
  }

  function preventPendingLink(event: ReactMouseEvent<HTMLAnchorElement>) {
    if (pending) event.preventDefault();
  }

  function actionText(action: SaveActionName, fallback: string) {
    return pending && activeAction === action ? ACTION_LABELS[action] : fallback;
  }

  const previewLinkClassName = `${buttonBaseClassName} border border-white/15 text-white/70 hover:border-white/30 hover:text-white ${
    pending ? "pointer-events-none opacity-45" : ""
  }`;

  return (
    <div
      ref={rootRef}
      data-topic-save-bar
      data-topic-save-bar-mode={props.mode}
      data-topic-save-bar-dirty={isDirty ? "true" : "false"}
      aria-busy={pending || undefined}
    >
      <AdminStickyFormBar
        title="إدارة الحفظ والنشر"
        description={
          <span className="hidden sm:inline">
            جميع إجراءات الحفظ والنشر ترسل بيانات الفورم الحالية كاملة أولًا.
          </span>
        }
        className="mt-5"
      >
        <TopicPreviousTabButton disabled={pending} />

        {props.mode === "create" ? (
          <>
            <button
              type="submit"
              name="intent"
              value="draft"
              data-topic-save-action="save"
              disabled={pending}
              className={`${buttonBaseClassName} bg-[#D8B87A] text-[#06101C] hover:bg-[#e5c98d]`}
            >
              {actionText("save", "حفظ")}
            </button>
            <button
              type="submit"
              name="intent"
              value="draft-close"
              data-topic-save-action="save-and-close"
              disabled={pending}
              className={`${buttonBaseClassName} border border-[#D8B87A]/35 text-[#D8B87A] hover:bg-[#D8B87A]/10`}
            >
              {actionText("save-and-close", "حفظ وإغلاق")}
            </button>
          </>
        ) : (
          <>
            <button
              type="submit"
              formAction={props.saveAction}
              data-topic-save-action="save"
              disabled={pending}
              className={`${buttonBaseClassName} bg-[#D8B87A] text-[#06101C] hover:bg-[#e5c98d]`}
            >
              {actionText("save", "حفظ")}
            </button>
            <button
              type="submit"
              formAction={props.saveAndCloseAction}
              data-topic-save-action="save-and-close"
              disabled={pending}
              className={`${buttonBaseClassName} border border-[#D8B87A]/35 text-[#D8B87A] hover:bg-[#D8B87A]/10`}
            >
              {actionText("save-and-close", "حفظ وإغلاق")}
            </button>
          </>
        )}

        <button
          type="button"
          onClick={closeWithoutSaving}
          disabled={pending}
          className={`${buttonBaseClassName} border border-white/15 text-white/65 hover:border-white/30 hover:text-white`}
        >
          إغلاق
        </button>

        {props.mode === "edit" && canConvertToDraft ? (
          <button
            type="submit"
            formAction={props.draftAction}
            data-topic-save-action="draft"
            disabled={pending}
            className={`${buttonBaseClassName} border border-white/10 text-white/55 hover:border-white/25 hover:text-white`}
          >
            {actionText("draft", "تحويل إلى مسودة")}
          </button>
        ) : null}

        {props.mode === "create" ? (
          <button
            type="submit"
            name="intent"
            value="publish"
            data-topic-save-action="publish"
            disabled={pending}
            className={`${buttonBaseClassName} basis-full border border-emerald-400/30 text-emerald-200 hover:bg-emerald-400/10 sm:basis-auto`}
          >
            {actionText("publish", "نشر الموضوع")}
          </button>
        ) : isPublished ? (
          <button
            type="submit"
            formAction={props.unpublishAction}
            data-topic-save-action="unpublish"
            disabled={pending}
            className={`${buttonBaseClassName} basis-full border border-[#D8B87A]/35 text-[#D8B87A] hover:bg-[#D8B87A]/10 sm:basis-auto`}
          >
            {actionText("unpublish", "إخفاء الموضوع")}
          </button>
        ) : (
          <button
            type="submit"
            formAction={props.publishAction}
            data-topic-save-action="publish"
            disabled={pending}
            className={`${buttonBaseClassName} basis-full border border-emerald-400/30 text-emerald-200 hover:bg-emerald-400/10 sm:basis-auto`}
          >
            {actionText("publish", "نشر الموضوع")}
          </button>
        )}

        {props.mode === "edit" ? (
          <Link
            href={`/admin/content/topics/${props.topicId}/preview`}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={pending || undefined}
            tabIndex={pending ? -1 : undefined}
            onClick={preventPendingLink}
            className={previewLinkClassName}
          >
            معاينة داخلية
          </Link>
        ) : null}

        {props.mode === "edit" && isPublished && props.slug ? (
          <Link
            href={`/topics/${props.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={pending || undefined}
            tabIndex={pending ? -1 : undefined}
            onClick={preventPendingLink}
            className={previewLinkClassName}
          >
            النسخة العامة
          </Link>
        ) : null}

        <span className="sr-only" role="status" aria-live="polite">
          {pending ? ACTION_LABELS[activeAction ?? "save"] : ""}
        </span>
      </AdminStickyFormBar>
    </div>
  );
}
