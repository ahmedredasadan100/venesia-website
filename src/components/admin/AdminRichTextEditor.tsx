"use client";

import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
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
};

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
      onClick={onClick}
      className={[
        "min-w-10 cursor-pointer rounded-xl border px-3 py-2 text-xs font-semibold transition",
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
}: AdminRichTextEditorProps) {
  const initialContent = useMemo(() => normalizeRichTextContent(defaultValue), [defaultValue]);
  const [html, setHtml] = useState(initialContent);
  const [syncedContent, setSyncedContent] = useState(initialContent);

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
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
      }),
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
  }, [initialContent]);

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
        </div>

        <div className="admin-rich-text-editor px-4 py-4" style={{ minHeight }}>
          <EditorContent editor={editor} />
        </div>
      </div>

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
