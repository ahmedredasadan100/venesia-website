"use client";

import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useMemo, useState } from "react";

import { normalizeRichTextContent } from "../../lib/rich-text/html-utils";

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
  helperText?: string;
};

type TextAlignValue = "right" | "center" | "left" | "justify";

function ToolButton({
  label,
  title,
  active,
  onClick,
}: {
  label: string;
  title?: string;
  active?: boolean;
  onClick: () => void;
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
          ? "border-[#D8B87A]/35 bg-[#D8B87A]/15 text-[#F2D99B]"
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
  helperText,
}: AdminRichTextEditorProps) {
  const initialContent = useMemo(() => normalizeRichTextContent(defaultValue), [defaultValue]);
  const [html, setHtml] = useState(initialContent);
  const [syncedContent, setSyncedContent] = useState(initialContent);
  const isMinimal = toolbarMode === "minimal";
  const withTextAlign = enableTextAlign;

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
        class: "admin-rich-text-content focus:outline-none",
        dir: "rtl",
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      setHtml(currentEditor.getHTML());
    },
  }, [initialContent, isMinimal, withTextAlign]);

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

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={html} />

      <span className="text-sm font-medium text-white/70">{label}</span>

      <div className="overflow-hidden rounded-[24px] border border-white/10 bg-black/25">
        <div className="flex flex-wrap gap-2 border-b border-white/10 bg-[#05070B] p-3">
          <ToolButton
            label="B"
            title="عريض"
            active={editor?.isActive("bold")}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          />
          {withTextAlign ? (
            <>
              <ToolButton
                label="يمين"
                title="محاذاة يمين"
                active={editor?.isActive({ textAlign: "right" })}
                onClick={() => setAlign("right")}
              />
              <ToolButton
                label="وسط"
                title="توسيط"
                active={editor?.isActive({ textAlign: "center" })}
                onClick={() => setAlign("center")}
              />
              <ToolButton
                label="يسار"
                title="محاذاة يسار"
                active={editor?.isActive({ textAlign: "left" })}
                onClick={() => setAlign("left")}
              />
              <ToolButton
                label="ضبط"
                title="ضبط النص من الجانبين"
                active={editor?.isActive({ textAlign: "justify" })}
                onClick={() => setAlign("justify")}
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
              />
              <ToolButton
                label="U"
                title="تحته خط"
                active={editor?.isActive("underline")}
                onClick={() => editor?.chain().focus().toggleUnderline().run()}
              />
              <ToolButton
                label="•"
                title="قائمة نقطية"
                active={editor?.isActive("bulletList")}
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
              />
              <ToolButton
                label="1."
                title="قائمة مرقمة"
                active={editor?.isActive("orderedList")}
                onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              />
              <ToolButton
                label="🔗"
                title="رابط"
                active={editor?.isActive("link")}
                onClick={toggleLink}
              />
            </>
          ) : null}
        </div>

        <div className="admin-rich-text-editor px-4 py-4" style={{ minHeight }}>
          <EditorContent editor={editor} />
        </div>
      </div>

      {helperText ? <p className="text-xs leading-6 text-white/45">{helperText}</p> : null}

      <style jsx global>{`
        .admin-rich-text-editor .ProseMirror {
          min-height: ${minHeight}px;
          outline: none;
        }
        .admin-rich-text-editor .ProseMirror p.is-editor-empty:first-child::before {
          color: rgba(255, 255, 255, 0.28);
          content: attr(data-placeholder);
          float: right;
          height: 0;
          pointer-events: none;
        }
        .admin-rich-text-content {
          color: rgba(255, 255, 255, 0.82);
          font-size: 15px;
          line-height: 2;
        }
        .admin-rich-text-content p {
          margin: 0 0 16px;
        }
        .admin-rich-text-content p:last-child {
          margin-bottom: 0;
        }
        .admin-rich-text-content ul,
        .admin-rich-text-content ol {
          margin: 0 0 18px;
          padding-right: 24px;
        }
        .admin-rich-text-content li {
          margin-bottom: 6px;
        }
        .admin-rich-text-content a {
          color: #d8b87a;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .admin-rich-text-content strong {
          color: #f2d99b;
          font-weight: 700;
        }
      `}</style>
    </div>
  );
}
