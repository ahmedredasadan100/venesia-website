"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type FocusEvent, type KeyboardEvent } from "react";

type AdminTagsFieldProps = {
  name: string;
  label: string;
  defaultTags?: string[];
  placeholder?: string;
  helperText?: string;
  appearance?: "dark" | "light";
};

const TAG_SPLIT_PATTERN = /[,;،؛]+/;

function normalizeTag(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function splitTagInput(value: string) {
  return value
    .split(TAG_SPLIT_PATTERN)
    .map(normalizeTag)
    .filter(Boolean);
}

function mergeTags(current: string[], incoming: string[]) {
  const next = [...current];
  for (const tag of incoming) {
    if (!next.includes(tag)) next.push(tag);
  }
  return next;
}

function isTagDelimiterKey(key: string) {
  return key === "," || key === ";" || key === "،" || key === "؛";
}

export default function AdminTagsField({
  name,
  label,
  defaultTags = [],
  placeholder = "اكتب كلمة مفتاحية ثم Enter أو , أو ;",
  helperText = "يمكن أن تحتوي الكلمة على مسافات، مثل: بيت الوطن",
  appearance = "dark",
}: AdminTagsFieldProps) {
  const [tags, setTags] = useState<string[]>(() => defaultTags.filter(Boolean));
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const hiddenRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const tagsRef = useRef(tags);

  useEffect(() => {
    tagsRef.current = tags;
  }, [tags]);

  function getComposeValue() {
    return inputRef.current?.value ?? "";
  }

  function clearComposeValue() {
    if (inputRef.current) inputRef.current.value = "";
  }

  function syncHiddenValue(nextTags: string[]) {
    if (!hiddenRef.current) return;
    hiddenRef.current.value = nextTags.join(", ");
    hiddenRef.current.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function applyTags(nextTags: string[]) {
    tagsRef.current = nextTags;
    setTags(nextTags);
    syncHiddenValue(nextTags);
  }

  function addTagsFromText(raw: string, baseTags = tagsRef.current) {
    const incoming = splitTagInput(raw);
    if (!incoming.length) return baseTags;
    const nextTags = mergeTags(baseTags, incoming);
    applyTags(nextTags);
    clearComposeValue();
    return nextTags;
  }

  function addSingleTag(raw: string, baseTags = tagsRef.current) {
    const tag = normalizeTag(raw);
    if (!tag) return baseTags;
    const nextTags = mergeTags(baseTags, [tag]);
    applyTags(nextTags);
    clearComposeValue();
    return nextTags;
  }

  function flushPendingInput(baseTags = tagsRef.current) {
    const pending = normalizeTag(getComposeValue());
    if (!pending) return baseTags;
    return addSingleTag(pending, baseTags);
  }

  const flushPendingInputRef = useRef(flushPendingInput);

  useEffect(() => {
    flushPendingInputRef.current = flushPendingInput;
  });

  useEffect(() => {
    const form = hiddenRef.current?.closest("form");
    if (!form) return;

    function handleSubmit() {
      flushPendingInputRef.current();
    }

    form.addEventListener("submit", handleSubmit);
    return () => form.removeEventListener("submit", handleSubmit);
  }, []);

  function removeTag(index: number) {
    applyTags(tagsRef.current.filter((_, itemIndex) => itemIndex !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setEditingValue("");
    }
  }

  function startEditing(index: number) {
    setEditingIndex(index);
    setEditingValue(tagsRef.current[index] ?? "");
  }

  function commitEdit() {
    if (editingIndex === null) return;

    const nextTag = normalizeTag(editingValue);
    const current = tagsRef.current;

    if (!nextTag) {
      applyTags(current.filter((_, index) => index !== editingIndex));
    } else {
      const withoutEdited = current.filter((_, index) => index !== editingIndex);
      if (withoutEdited.includes(nextTag)) {
        applyTags(withoutEdited);
      } else {
        const next = [...current];
        next[editingIndex] = nextTag;
        applyTags(next);
      }
    }

    setEditingIndex(null);
    setEditingValue("");
  }

  function cancelEdit() {
    setEditingIndex(null);
    setEditingValue("");
    syncHiddenValue(tagsRef.current);
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;

    if (event.key === "Enter") {
      event.preventDefault();
      addSingleTag(getComposeValue());
      return;
    }

    if (isTagDelimiterKey(event.key)) {
      event.preventDefault();
      addSingleTag(getComposeValue());
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text");
    if (!TAG_SPLIT_PATTERN.test(pasted)) return;

    event.preventDefault();
    addTagsFromText(`${getComposeValue()}${pasted}`);
  }

  function handleComposeBlur(event: FocusEvent<HTMLInputElement>) {
    const root = rootRef.current;
    const nextTarget = event.relatedTarget as Node | null;
    if (root && nextTarget && root.contains(nextTarget)) return;
    flushPendingInput();
  }

  function handleEditKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;

    if (event.key === "Enter") {
      event.preventDefault();
      commitEdit();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
    }
  }

  function handleComposeInput(event: React.SyntheticEvent<HTMLInputElement>) {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    const pending = normalizeTag(event.currentTarget.value);
    syncHiddenValue(pending ? [...tagsRef.current, pending] : tagsRef.current);
  }

  return (
    <div ref={rootRef} data-admin-tags-field className="mt-6">
      <input ref={hiddenRef} type="hidden" name={name} defaultValue={tags.join(", ")} />

      <span className={`text-sm font-medium ${appearance === "light" ? "text-slate-700" : "text-white/75"}`}>{label}</span>

      <div className={`mt-3 rounded-2xl border px-3 py-3 focus-within:border-[#D8B87A]/45 ${appearance === "light" ? "border-slate-200 bg-white" : "border-white/10 bg-black/30"}`}>
        {tags.length ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {tags.map((tag, index) =>
              editingIndex === index ? (
                <input
                  key={`${tag}-${index}-edit`}
                  autoFocus
                  value={editingValue}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setEditingValue(nextValue);
                    const nextTags = [...tagsRef.current];
                    nextTags[index] = normalizeTag(nextValue);
                    syncHiddenValue(nextTags.filter(Boolean));
                  }}
                  onBlur={commitEdit}
                  onKeyDown={handleEditKeyDown}
                  className={`min-w-[140px] rounded-full border border-[#D8B87A]/35 px-3 py-1.5 text-sm outline-none ${appearance === "light" ? "bg-white text-slate-800" : "bg-black/40 text-white"}`}
                />
              ) : (
                <span
                  key={`${tag}-${index}`}
                  className={`inline-flex max-w-full items-center gap-1 rounded-full border border-[#D8B87A]/25 bg-[#D8B87A]/10 px-3 py-1.5 text-sm ${appearance === "light" ? "text-[#8a5b12]" : "text-[#F2D99B]"}`}
                >
                  <button
                    type="button"
                    onClick={() => startEditing(index)}
                    className={`cursor-pointer truncate text-right ${appearance === "light" ? "hover:text-slate-950" : "hover:text-white"}`}
                    title="انقر للتعديل"
                  >
                    {tag}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeTag(index)}
                    className={`cursor-pointer rounded-full px-1 text-xs transition ${appearance === "light" ? "text-slate-500 hover:bg-slate-100 hover:text-slate-950" : "text-white/45 hover:bg-white/10 hover:text-white"}`}
                    aria-label={`حذف ${tag}`}
                  >
                    ×
                  </button>
                </span>
              ),
            )}
          </div>
        ) : null}

        <input
          ref={inputRef}
          type="text"
          defaultValue=""
          onKeyDown={handleInputKeyDown}
          onPaste={handlePaste}
          onBlur={handleComposeBlur}
          onInput={handleComposeInput}
          placeholder={placeholder}
          className={`w-full bg-transparent px-1 py-1 text-sm outline-none ${appearance === "light" ? "text-slate-900 placeholder:text-slate-400" : "text-white placeholder:text-white/30"}`}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <p className={`mt-2 text-xs ${appearance === "light" ? "text-slate-500" : "text-white/35"}`}>
        {helperText} — عدد الكلمات الحالية: {tags.length}
      </p>
    </div>
  );
}
