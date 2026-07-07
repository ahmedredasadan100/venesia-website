"use client";

import { useEffect, useMemo, useState } from "react";

import {
  buildMediaPublishChecklist,
  type MediaPublishInput,
} from "../../../lib/admin/content-workflow/media-publish-validation";
import type { MediaTopicPayload } from "../../../lib/admin/media-topic-payload";
import type { MediaEditableContentType } from "../../../lib/admin/content-workflow/media-publish-validation";
import PublishChecklist from "./PublishChecklist";

type MediaPublishChecklistPanelProps = {
  formId: string;
  initial: MediaPublishInput;
};

function readValue(form: HTMLFormElement, name: string) {
  const field = form.elements.namedItem(name);
  if (!field) return "";
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
    return field.value;
  }
  return "";
}

function readMediaPayload(form: HTMLFormElement, contentType: MediaEditableContentType): MediaTopicPayload | null {
  if (contentType === "video") {
    return {
      kind: "video",
      provider: "youtube",
      video_url: readValue(form, "video_url"),
      thumbnail: readValue(form, "video_thumbnail") || null,
      duration: readValue(form, "video_duration") || null,
    };
  }

  if (contentType === "gallery") {
    const urls = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="gallery_image_url"]')).map(
      (input) => input.value.trim(),
    );
    const alts = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="gallery_image_alt"]')).map(
      (input) => input.value.trim(),
    );
    const captions = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="gallery_image_caption"]')).map(
      (input) => input.value.trim(),
    );

    return {
      kind: "gallery",
      images: urls
        .map((url, index) => ({
          url,
          alt: alts[index] || null,
          caption: captions[index] || null,
        }))
        .filter((item) => item.url),
    };
  }

  return null;
}

export default function MediaPublishChecklistPanel({ formId, initial }: MediaPublishChecklistPanelProps) {
  const [input, setInput] = useState<MediaPublishInput>(initial);

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;

    const sync = () => {
      const section = readValue(form, "category_slug") || initial.categorySlug;
      const contentType =
        section === "media-videos"
          ? "video"
          : section === "media-gallery"
            ? "gallery"
            : section === "media-press"
              ? "press"
              : section === "media-site-updates"
                ? "site_update"
                : "news";

      setInput({
        title: readValue(form, "title"),
        slug: readValue(form, "slug"),
        excerpt: readValue(form, "excerpt"),
        content: readValue(form, "content"),
        image: readValue(form, "image") || initial.image,
        imageAlt: readValue(form, "image_alt"),
        categorySlug: section,
        contentType: contentType as MediaEditableContentType,
        mediaPayload: readMediaPayload(form, contentType as MediaEditableContentType),
      });
    };

    sync();
    form.addEventListener("input", sync);
    form.addEventListener("change", sync);

    return () => {
      form.removeEventListener("input", sync);
      form.removeEventListener("change", sync);
    };
  }, [formId, initial]);

  const items = useMemo(() => buildMediaPublishChecklist(input), [input]);

  return <PublishChecklist items={items} title="قائمة جاهزية المحتوى الإعلامي" />;
}
