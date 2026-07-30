"use client";

import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { normalizeRichTextContent } from "../../lib/rich-text/html-utils";
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
}: AdminRichTextEditorProps) {
  const runtime = useOptionalAdminFormRuntime();
  const pending = runtime?.pending ?? false;
  const hasError = Boolean(runtime?.fieldErrors[name]?.length);
  const styleScope = `rich-text-${useId().replace(/:/g, "")}`;
  const initialContent = useMemo(() => normalizeRichTextContent(defaultValue), [defaultValue]);
  const [html, setHtml] = useState(initialContent);
  const [syncedContent, setSyncedContent] = useState(initialContent);
  const [contentVisible, setContentVisible] = useState(visibilityDefault);
  const valueInputRef = useRef<HTMLInputElement>(null);
  const isMinimal = toolbarMode === "minimal";
  const withTextAlign = enableTextAlign;
  const sideToolbar = toolbarPlacement === "side";
  const withVisibility = Boolean(visibilityName);

  if (initialContent !== syncedContent) {
    setSyncedContent(initialContent);
    setHtml(initialContent);
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
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
      const nextHtml = currentEditor.isEmpty ? "" : currentEditor.getHTML();
      if (nextHtml === valueInputRef.current?.value) return;
      setHtml(nextHtml);
      if (valueInputRef.current) {
        valueInputRef.current.value = nextHtml;
        valueInputRef.current.dispatchEvent(new Event("input", { bubbles: true }));
      }
    },
  }, [hasError, initialContent, isMinimal, label, name, withTextAlign]);

  useEffect(() => {
    editor?.setEditable(!pending);
  }, [editor, pending]);

  function toggleLink() {
    if (!editor) return;

    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("أدخل الرابط", previousUrl ?? "https://");

    if (url === null) return;

    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    const normalized = /^https?:\/\//i.test(url.trim()) || url.startsWith("/") || url.startsWith("mailto:")
      ? url.trim()
      : `https://${url.trim()}`;

    editor.chain().focus().extendMarkRange("link").setLink({ href: normalized }).run();
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
            onClick={toggleLink}
            appearance={appearance}
          />
        </>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-2" data-admin-rich-text-scope={styleScope}>
      {withVisibility && visibilityName ? (
        <input type="hidden" name={visibilityName} value={contentVisible ? "true" : "false"} />
      ) : null}
      <input ref={valueInputRef} type="hidden" name={name} value={html} readOnly />

      {label ? (
        <span className={`text-sm font-medium ${appearance === "light" ? "text-slate-700" : "text-white/70"}`}>
          {label}
        </span>
      ) : null}

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
