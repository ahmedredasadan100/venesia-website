"use client";

import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import {
  markdownToRichTextHtml,
  normalizeArticleMarkdown,
  normalizeRichTextContent,
  richTextHtmlToMarkdown,
} from "../../lib/rich-text/html-utils";
import {
  AdminFormError,
  useOptionalAdminFormRuntime,
} from "./ui/AdminFormRuntime";

export { normalizeRichTextContent };

type AdminRichTextEditorProps = {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  minHeight?: number;
  /** full = all tools; minimal = Bold (+ optional text align). Backward-compatible default: full. */
  toolbarMode?: "full" | "minimal";
  /** Home Story only — show paragraph alignment controls next to Bold. */
  enableTextAlign?: boolean;
  /**
   * top = toolbar above editor (default for all existing editors).
   * side = toolbar beside editor on md+ (Hero editor compact layout only).
   */
  toolbarPlacement?: "top" | "side";
  /**
   * Optional visibility toggle appended to the toolbar (Hero description only).
   * Writes a hidden input; does not change other editors.
   */
  visibilityName?: string;
  visibilityDefault?: boolean;
  helperText?: string;
  appearance?: "dark" | "light";
  /** Keep HTML as the default contract; Article consumers opt into their existing Markdown contract. */
  storageFormat?: "html" | "markdown";
  /** Enables the Article block structure while retaining the same TipTap editor engine. */
  enableArticleStructure?: boolean;
  /** Locks editor input and toolbar commands without removing its submitted value. */
  readOnly?: boolean;
  onValueChange?: (value: string) => void;
};

type TextAlignValue = "right" | "center" | "left" | "justify";

function ToolButton({
  label,
  title,
  active,
  onClick,
  appearance = "dark",
}: {
  label: string;
  title?: string;
  active?: boolean;
  onClick: () => void;
  appearance?: "dark" | "light";
}) {
  return (
    <button
      type="button"
      title={title ?? label}
      aria-label={title ?? label}
      aria-pressed={Boolean(active)}
      onClick={onClick}
      className={[
        "min-w-9 cursor-pointer rounded-xl border px-2.5 py-2 text-xs font-semibold transition sm:min-w-10 sm:px-3",
        active
          ? appearance === "light"
            ? "border-[#b98724]/50 bg-amber-50 text-[#8a5b12]"
            : "border-[#D8B87A]/35 bg-[#D8B87A]/15 text-[#F2D99B]"
          : appearance === "light"
            ? "border-slate-200 bg-white text-slate-600 hover:border-[#b98724]/40 hover:bg-amber-50 hover:text-[#8a5b12]"
            : "border-white/10 bg-white/[0.035] text-white/72 hover:border-[#D8B87A]/35 hover:bg-[#D8B87A]/10 hover:text-[#F2D99B]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

export default function AdminRichTextEditor({
  name,
  label,
  defaultValue = "",
  placeholder = "اكتب المحتوى هنا...",
  minHeight = 220,
  toolbarMode = "full",
  enableTextAlign = false,
  toolbarPlacement = "top",
  visibilityName,
  visibilityDefault = true,
  helperText,
  appearance = "dark",
  storageFormat = "html",
  enableArticleStructure = false,
  readOnly = false,
  onValueChange,
}: AdminRichTextEditorProps) {
  const runtime = useOptionalAdminFormRuntime();
  const pending = runtime?.pending ?? false;
  const editorReadOnly = pending || readOnly;
  const hasError = Boolean(runtime?.fieldErrors[name]?.length);
  const styleScope = `rich-text-${useId().replace(/:/g, "")}`;
  const initialValue = useMemo(
    () => storageFormat === "markdown"
      ? defaultValue
      : normalizeRichTextContent(defaultValue),
    [defaultValue, storageFormat],
  );
  const initialContent = useMemo(
    () => storageFormat === "markdown"
      ? markdownToRichTextHtml(normalizeArticleMarkdown(initialValue))
      : initialValue,
    [initialValue, storageFormat],
  );
  const [contentVisible, setContentVisible] = useState(visibilityDefault);
  const [linkEditorOpen, setLinkEditorOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const valueInputRef = useRef<HTMLInputElement>(null);
  const currentValueRef = useRef(initialValue);
  const hasUserInteractedRef = useRef(false);
  const isMinimal = toolbarMode === "minimal";
  const withTextAlign = enableTextAlign;
  const sideToolbar = toolbarPlacement === "side";
  const withVisibility = Boolean(visibilityName);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: enableArticleStructure ? { levels: [1, 2, 3] } : false,
        codeBlock: false,
        blockquote: enableArticleStructure ? {} : false,
        horizontalRule: false,
        link: false,
        underline: false,
        ...(isMinimal
          ? {
              italic: false,
              bulletList: false,
              orderedList: false,
              listItem: false,
            }
          : {}),
      }),
      ...(isMinimal
        ? []
        : [
            Underline,
            Link.configure({
              openOnClick: false,
              autolink: true,
              defaultProtocol: "https",
            }),
          ]),
      ...(withTextAlign
        ? [
            TextAlign.configure({
              types: ["paragraph"],
              alignments: ["left", "center", "right", "justify"],
              defaultAlignment: "right",
            }),
          ]
        : []),
      Placeholder.configure({ placeholder }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        id: `${name}-editor`,
        class: "admin-rich-text-content focus:outline-none",
        dir: "rtl",
        role: "textbox",
        "aria-label": label,
        "aria-invalid": hasError ? "true" : "false",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      if (!hasUserInteractedRef.current) return;
      const nextHtml = currentEditor.isEmpty ? "" : currentEditor.getHTML();
      const nextValue = storageFormat === "markdown"
        ? richTextHtmlToMarkdown(nextHtml)
        : nextHtml;
      if (nextValue === currentValueRef.current) return;
      currentValueRef.current = nextValue;
      if (valueInputRef.current) {
        valueInputRef.current.value = nextValue;
        valueInputRef.current.dispatchEvent(new Event("input", { bubbles: true }));
      }
      onValueChange?.(nextValue);
    },
    onFocus: () => {
      hasUserInteractedRef.current = true;
    },
  }, [enableArticleStructure, hasError, isMinimal, label, name, onValueChange, storageFormat, withTextAlign]);

  useEffect(() => {
    if (!editor) return;
    const currentHtml = editor.isEmpty ? "" : editor.getHTML();
    if (currentHtml !== initialContent) {
      editor.commands.setContent(initialContent, { emitUpdate: false });
    }
    currentValueRef.current = initialValue;
    hasUserInteractedRef.current = false;
    if (valueInputRef.current) valueInputRef.current.value = initialValue;
  }, [editor, initialContent, initialValue]);

  useEffect(() => {
    editor?.setEditable(!editorReadOnly);
  }, [editor, editorReadOnly]);

  function openLinkEditor() {
    if (!editor) return;

    const previousUrl = editor.getAttributes("link").href as string | undefined;
    setLinkUrl(previousUrl ?? "https://");
    setLinkEditorOpen(true);
  }

  function applyLink() {
    if (!editor) return;
    if (!linkUrl.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setLinkEditorOpen(false);
      return;
    }

    const normalized = /^(https?:\/\/|mailto:|tel:|\/|#)/i.test(linkUrl.trim())
      ? linkUrl.trim()
      : `https://${linkUrl.trim()}`;

    editor.chain().focus().extendMarkRange("link").setLink({ href: normalized }).run();
    setLinkEditorOpen(false);
  }

  function removeLink() {
    editor?.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkEditorOpen(false);
  }

  function setAlign(alignment: TextAlignValue) {
    editor?.chain().focus().setTextAlign(alignment).run();
  }

  const toolbar = (
    <div
      className={[
        "flex flex-wrap gap-2 p-3",
        appearance === "light" ? "bg-slate-50" : "bg-[#05070B]",
        sideToolbar
          ? `border-b md:w-[7.5rem] md:shrink-0 md:flex-col md:border-b-0 md:border-l ${appearance === "light" ? "border-slate-200 md:border-slate-200" : "border-white/10 md:border-white/10"}`
          : appearance === "light" ? "border-b border-slate-200" : "border-b border-white/10",
      ].join(" ")}
      role="toolbar"
      aria-label={`شريط أدوات ${label}`}
    >
      <ToolButton
        label="B"
        title="خط عريض"
        active={editor?.isActive("bold")}
        onClick={() => editor?.chain().focus().toggleBold().run()}
        appearance={appearance}
      />
      {enableArticleStructure ? (
        <>
          <ToolButton
            label="فقرة"
            title="فقرة"
            active={editor?.isActive("paragraph")}
            onClick={() => editor?.chain().focus().setParagraph().run()}
            appearance={appearance}
          />
          <ToolButton
            label="H2"
            title="عنوان رئيسي داخل المقال"
            active={editor?.isActive("heading", { level: 2 })}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            appearance={appearance}
          />
          <ToolButton
            label="H3"
            title="عنوان فرعي داخل المقال"
            active={editor?.isActive("heading", { level: 3 })}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
            appearance={appearance}
          />
        </>
      ) : null}
      {withTextAlign ? (
        <>
          <ToolButton
            label="يمين"
            title="محاذاة لليمين"
            active={editor?.isActive({ textAlign: "right" })}
            onClick={() => setAlign("right")}
            appearance={appearance}
          />
          <ToolButton
            label="وسط"
            title="محاذاة للوسط"
            active={editor?.isActive({ textAlign: "center" })}
            onClick={() => setAlign("center")}
            appearance={appearance}
          />
          <ToolButton
            label="يسار"
            title="محاذاة لليسار"
            active={editor?.isActive({ textAlign: "left" })}
            onClick={() => setAlign("left")}
            appearance={appearance}
          />
          <ToolButton
            label="ضبط"
            title="ضبط النص من الجانبين"
            active={editor?.isActive({ textAlign: "justify" })}
            onClick={() => setAlign("justify")}
            appearance={appearance}
          />
        </>
      ) : null}
      {withVisibility ? (
        <>
          <span className="mx-0.5 hidden h-5 w-px bg-white/10 sm:inline-block" aria-hidden />
          <ToolButton
            label={contentVisible ? "إخفاء" : "إظهار"}
            title={contentVisible ? "إخفاء العنصر" : "إظهار العنصر"}
            active={contentVisible}
            onClick={() => setContentVisible((current) => !current)}
            appearance={appearance}
          />
        </>
      ) : null}
      {!isMinimal ? (
        <>
          <ToolButton
            label="I"
            title="مائل"
            active={editor?.isActive("italic")}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            appearance={appearance}
          />
          <ToolButton
            label="U"
            title="تحته خط"
            active={editor?.isActive("underline")}
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
            appearance={appearance}
          />
          <ToolButton
            label="•"
            title="قائمة نقطية"
            active={editor?.isActive("bulletList")}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            appearance={appearance}
          />
          <ToolButton
            label="1."
            title="قائمة مرقمة"
            active={editor?.isActive("orderedList")}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            appearance={appearance}
          />
          <ToolButton
            label="🔗"
            title="رابط"
            active={editor?.isActive("link")}
            onClick={openLinkEditor}
            appearance={appearance}
          />
        </>
      ) : null}
      {linkEditorOpen ? (
        <div
          className={`flex basis-full flex-wrap items-end gap-2 rounded-xl border p-2 ${appearance === "light" ? "border-slate-200 bg-white" : "border-white/10 bg-black/30"}`}
          data-admin-rich-text-link-editor=""
        >
          <label className="min-w-52 flex-1 space-y-1 text-right">
            <span className={`block text-[11px] font-semibold ${appearance === "light" ? "text-slate-600" : "text-white/55"}`}>
              عنوان الرابط
            </span>
            <input
              type="text"
              value={linkUrl}
              autoFocus
              dir="ltr"
              aria-label="عنوان الرابط"
              onChange={(event) => setLinkUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyLink();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setLinkEditorOpen(false);
                  editor?.chain().focus().run();
                }
              }}
              className={`h-9 w-full rounded-lg border px-3 text-xs outline-none ${appearance === "light" ? "border-slate-200 bg-white text-slate-800 focus:border-[#b98724]/50" : "border-white/10 bg-[#05070B] text-white focus:border-[#D8B87A]/40"}`}
            />
          </label>
          <button
            type="button"
            onClick={applyLink}
            className="h-9 rounded-lg bg-[#D8B87A] px-3 text-xs font-semibold text-[#080B10]"
          >
            تطبيق الرابط
          </button>
          {editor?.isActive("link") ? (
            <button
              type="button"
              onClick={removeLink}
              className={`h-9 rounded-lg border px-3 text-xs font-semibold ${appearance === "light" ? "border-slate-200 text-slate-600" : "border-white/10 text-white/65"}`}
            >
              إزالة الرابط
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setLinkEditorOpen(false);
              editor?.chain().focus().run();
            }}
            className={`h-9 rounded-lg border px-3 text-xs font-semibold ${appearance === "light" ? "border-slate-200 text-slate-600" : "border-white/10 text-white/65"}`}
          >
            إلغاء
          </button>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-2" data-admin-rich-text-scope={styleScope}>
      {withVisibility && visibilityName ? (
        <input type="hidden" name={visibilityName} value={contentVisible ? "true" : "false"} />
      ) : null}
      <input ref={valueInputRef} type="hidden" name={name} defaultValue={initialValue} />

      {label ? (
        <span className={`text-sm font-medium ${appearance === "light" ? "text-slate-700" : "text-white/70"}`}>
          {label}
        </span>
      ) : null}

      <fieldset
        disabled={editorReadOnly}
        className="contents"
        data-admin-rich-text-readonly={editorReadOnly ? "true" : "false"}
      >
        <div
          className={[
            "overflow-hidden rounded-[24px] border",
            appearance === "light" ? "border-slate-200 bg-white" : "border-white/10 bg-black/25",
            sideToolbar ? "md:flex md:flex-row-reverse md:items-stretch" : "",
          ].join(" ")}
        >
          {toolbar}

          <div className="admin-rich-text-editor min-w-0 flex-1 px-4 py-4" style={{ minHeight }}>
            <EditorContent editor={editor} />
          </div>
        </div>
      </fieldset>

      {helperText ? (
        <p className={`text-xs leading-6 ${appearance === "light" ? "text-slate-500" : "text-white/45"}`}>
          {helperText}
        </p>
      ) : null}

      <AdminFormError name={name} />

      <style jsx global>{`
        [data-admin-rich-text-scope="${styleScope}"] .admin-rich-text-editor .ProseMirror {
          min-height: ${minHeight}px;
          outline: none;
        }
        [data-admin-rich-text-scope="${styleScope}"] .admin-rich-text-editor .ProseMirror p.is-editor-empty:first-child::before {
          color: ${appearance === "light" ? "rgba(100, 116, 139, 0.65)" : "rgba(255, 255, 255, 0.28)"};
          content: attr(data-placeholder);
          float: right;
          height: 0;
          pointer-events: none;
        }
        [data-admin-rich-text-scope="${styleScope}"] .admin-rich-text-content {
          color: ${appearance === "light" ? "#334155" : "rgba(255, 255, 255, 0.82)"};
          font-size: 15px;
          line-height: 2;
        }
        [data-admin-rich-text-scope="${styleScope}"] .admin-rich-text-content p {
          margin: 0 0 16px;
        }
        [data-admin-rich-text-scope="${styleScope}"] .admin-rich-text-content p:last-child {
          margin-bottom: 0;
        }
        [data-admin-rich-text-scope="${styleScope}"] .admin-rich-text-content h1,
        [data-admin-rich-text-scope="${styleScope}"] .admin-rich-text-content h2,
        [data-admin-rich-text-scope="${styleScope}"] .admin-rich-text-content h3 {
          color: ${appearance === "light" ? "#1e293b" : "#f8fafc"};
          font-weight: 750;
        }
        [data-admin-rich-text-scope="${styleScope}"] .admin-rich-text-content h1 {
          margin: 0 0 18px;
          font-size: 1.75rem;
          line-height: 1.55;
        }
        [data-admin-rich-text-scope="${styleScope}"] .admin-rich-text-content h2 {
          margin: 30px 0 12px;
          font-size: 1.4rem;
          line-height: 1.65;
        }
        [data-admin-rich-text-scope="${styleScope}"] .admin-rich-text-content h3 {
          margin: 24px 0 10px;
          font-size: 1.15rem;
          line-height: 1.7;
        }
        [data-admin-rich-text-scope="${styleScope}"] .admin-rich-text-content ul,
        [data-admin-rich-text-scope="${styleScope}"] .admin-rich-text-content ol {
          margin: 0 0 18px;
          padding-right: 24px;
        }
        [data-admin-rich-text-scope="${styleScope}"] .admin-rich-text-content li {
          margin-bottom: 6px;
        }
        [data-admin-rich-text-scope="${styleScope}"] .admin-rich-text-content a {
          color: #d8b87a;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        [data-admin-rich-text-scope="${styleScope}"] .admin-rich-text-content strong {
          color: ${appearance === "light" ? "#713f12" : "#f2d99b"};
          font-weight: 700;
        }
      `}</style>
    </div>
  );
}
