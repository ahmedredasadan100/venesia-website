"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type FocusEvent, type KeyboardEvent } from "react";

type AdminTagsFieldProps = {
  name: string;
  label: string;
  defaultTags?: string[];
  placeholder?: string;
  helperText?: string;
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

  useEffect(() => {
    const form = hiddenRef.current?.closest("form");
    if (!form) return;

    function handleSubmit() {
      flushPendingInput();
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

  function stopComposeInputBubble(event: React.SyntheticEvent<HTMLInputElement>) {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
  }

  return (
    <div ref={rootRef} data-admin-tags-field className="mt-6">
      <input ref={hiddenRef} type="hidden" name={name} defaultValue={tags.join(", ")} />

      <span className="text-sm font-medium text-white/75">{label}</span>

      <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-3 focus-within:border-[#D8B87A]/45">
        {tags.length ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {tags.map((tag, index) =>
              editingIndex === index ? (
                <input
                  key={`${tag}-${index}-edit`}
                  autoFocus
                  value={editingValue}
                  onChange={(event) => setEditingValue(event.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={handleEditKeyDown}
                  className="min-w-[140px] rounded-full border border-[#D8B87A]/35 bg-black/40 px-3 py-1.5 text-sm text-white outline-none"
                />
              ) : (
                <span
                  key={`${tag}-${index}`}
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#D8B87A]/25 bg-[#D8B87A]/10 px-3 py-1.5 text-sm text-[#F2D99B]"
                >
                  <button
                    type="button"
                    onClick={() => startEditing(index)}
                    className="cursor-pointer truncate text-right hover:text-white"
                    title="انقر للتعديل"
                  >
                    {tag}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeTag(index)}
                    className="cursor-pointer rounded-full px-1 text-xs text-white/45 transition hover:bg-white/10 hover:text-white"
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
          onInput={stopComposeInputBubble}
          onChange={stopComposeInputBubble}
          placeholder={placeholder}
          className="w-full bg-transparent px-1 py-1 text-sm text-white outline-none placeholder:text-white/30"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <p className="mt-2 text-xs text-white/35">
        {helperText} — عدد الكلمات الحالية: {tags.length}
      </p>
    </div>
  );
}
