"use client";

import { useEffect, useMemo, useState } from "react";

import PublishChecklist from "../content-workflow/PublishChecklist";
import {
  buildProjectPublishChecklist,
  type ProjectPublishInput,
} from "../../../lib/admin/projects/project-publish-validation";

type ProjectPublishChecklistPanelProps = {
  formId: string;
  initial: ProjectPublishInput;
};

function readFormValue(form: HTMLFormElement, name: string) {
  const field = form.elements.namedItem(name);
  if (!field) return "";
  if (field instanceof RadioNodeList) {
    return String(field.value ?? "").trim();
  }
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
    return field.value.trim();
  }
  return "";
}

function readInputFromForm(form: HTMLFormElement, initial: ProjectPublishInput): ProjectPublishInput {
  return {
    ...initial,
    arabicName: readFormValue(form, "arabic_name"),
    slug: readFormValue(form, "slug"),
    locationLabel: readFormValue(form, "location_label"),
    mapArea: readFormValue(form, "map_area"),
    status: readFormValue(form, "status") || initial.status,
    statusLabel: readFormValue(form, "status_label") || initial.statusLabel,
    image: readFormValue(form, "image"),
    heroImage: readFormValue(form, "hero_image"),
    shortDescription: readFormValue(form, "short_description"),
    seoTitle: readFormValue(form, "seo_title"),
    seoDescription: readFormValue(form, "seo_description"),
    progress: Number.parseInt(readFormValue(form, "progress"), 10) || initial.progress,
    overviewTitle: readFormValue(form, "overview_title") || initial.overviewTitle,
    deliverySpecsTitle: readFormValue(form, "delivery_specs_title") || initial.deliverySpecsTitle,
  };
}

export default function ProjectPublishChecklistPanel({ formId, initial }: ProjectPublishChecklistPanelProps) {
  const [input, setInput] = useState(initial);

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;

    const sync = () => setInput(readInputFromForm(form, initial));
    sync();
    form.addEventListener("input", sync);
    form.addEventListener("change", sync);
    return () => {
      form.removeEventListener("input", sync);
      form.removeEventListener("change", sync);
    };
  }, [formId, initial]);

  const items = useMemo(() => buildProjectPublishChecklist(input), [input]);

  return <PublishChecklist items={items} title="قائمة جاهزية نشر المشروع" />;
}
