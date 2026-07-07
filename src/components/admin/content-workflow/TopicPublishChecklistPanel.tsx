"use client";

import { useEffect, useMemo, useState } from "react";

import {
  buildTopicPublishChecklist,
  type TopicFaqItem,
  type TopicPublishInput,
} from "../../../lib/admin/content-workflow/topic-publish-validation";
import PublishChecklist from "./PublishChecklist";

type TopicPublishChecklistPanelProps = {
  formId: string;
  initial: TopicPublishInput;
};

function readInputValue(form: HTMLFormElement, name: string) {
  const field = form.elements.namedItem(name);
  if (!field) return "";
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
    return field.value;
  }
  return "";
}

function readFaq(form: HTMLFormElement): TopicFaqItem[] {
  const questions = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="faq_question"]')).map(
    (input) => input.value,
  );
  const answers = Array.from(form.querySelectorAll<HTMLTextAreaElement>('textarea[name="faq_answer"]')).map(
    (input) => input.value,
  );

  return questions.map((question, index) => ({
    question,
    answer: answers[index] ?? "",
  }));
}

function readTopicPublishInput(form: HTMLFormElement, seed: TopicPublishInput): TopicPublishInput {
  return {
    title: readInputValue(form, "title"),
    slug: readInputValue(form, "slug"),
    excerpt: readInputValue(form, "excerpt"),
    content: readInputValue(form, "content"),
    image: readInputValue(form, "image") || seed.image,
    imageAlt: readInputValue(form, "image_alt"),
    categorySlug: readInputValue(form, "category_slug"),
    seoTitle: readInputValue(form, "seo_title"),
    seoDescription: readInputValue(form, "seo_description"),
    focusKeyword: readInputValue(form, "focus_keyword"),
    faq: readFaq(form),
  };
}

export default function TopicPublishChecklistPanel({ formId, initial }: TopicPublishChecklistPanelProps) {
  const [input, setInput] = useState<TopicPublishInput>(initial);

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;

    const sync = () => setInput(readTopicPublishInput(form, initial));

    sync();
    form.addEventListener("input", sync);
    form.addEventListener("change", sync);

    return () => {
      form.removeEventListener("input", sync);
      form.removeEventListener("change", sync);
    };
  }, [formId, initial]);

  const items = useMemo(() => buildTopicPublishChecklist(input), [input]);

  return <PublishChecklist items={items} />;
}
