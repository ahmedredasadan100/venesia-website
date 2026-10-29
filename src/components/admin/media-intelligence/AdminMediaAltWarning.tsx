"use client";

import { useEffect, useState } from "react";

type AdminMediaAltWarningProps = {
  formId: string;
  imageFieldName?: string;
  altFieldName?: string;
  requiredForPublish?: boolean;
};

function readFieldValue(form: HTMLFormElement, name: string) {
  const field = form.elements.namedItem(name);
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    return field.value.trim();
  }
  return "";
}

export default function AdminMediaAltWarning({
  formId,
  imageFieldName = "image",
  altFieldName = "image_alt",
  requiredForPublish = false,
}: AdminMediaAltWarningProps) {
  const [image, setImage] = useState("");
  const [alt, setAlt] = useState("");

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;

    const sync = () => {
      setImage(readFieldValue(form, imageFieldName));
      setAlt(readFieldValue(form, altFieldName));
    };
    // Read after React's root listener commits the controlled field edit.
    const observe = (event: Event) => {
      if (event.target instanceof Node && form.contains(event.target)) sync();
    };

    sync();
    form.ownerDocument.addEventListener("input", observe);
    form.ownerDocument.addEventListener("change", observe);

    return () => {
      form.ownerDocument.removeEventListener("input", observe);
      form.ownerDocument.removeEventListener("change", observe);
    };
  }, [formId, imageFieldName, altFieldName]);

  if (!image || alt) return null;

  return (
    <div className="rounded-[18px] border border-amber-400/20 bg-amber-500/8 px-4 py-3 text-sm text-amber-100">
      <p className="font-semibold">Alt Text مفقود</p>
      <p className="mt-1 text-xs leading-6 text-amber-100/80">
        {requiredForPublish
          ? "وصف الصورة مطلوب قبل النشر — يحسّن SEO وإتاحة الوصول."
          : "أضف وصفًا مختصرًا للصورة — يُفضّل إكماله قبل النشر."}
      </p>
    </div>
  );
}
