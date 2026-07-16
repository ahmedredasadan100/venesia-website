import TopicImage from "./TopicImage";
import Link from "next/link";
import type { ReactNode } from "react";

import type { Topic } from "../../lib/topics/types";

type TopicArticleProps = {
  topic: Topic;
  relatedTopics?: Topic[];
};

function renderInlineFormatting(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }

    return part;
  });
}

function renderContent(content: string) {
  const lines = content.split("\n");
  const elements: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (!listItems.length) return;

    elements.push(
      <ul
        key={`list-${elements.length}`}
        className="my-7 space-y-3 border-r border-[#D8B87A]/30 pr-5"
      >
        {listItems.map((item, index) => (
          <li
            key={index}
            className="relative text-[15px] leading-9 text-white/68 md:text-base"
          >
            {renderInlineFormatting(item)}
          </li>
        ))}
      </ul>
    );

    listItems = [];
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();

    if (!line) {
      flushList();
      return;
    }

    if (line.startsWith("- ")) {
      listItems.push(line.slice(2));
      return;
    }

    flushList();

    if (line.startsWith("# ")) {
      elements.push(
        <h1
          key={`h1-${elements.length}`}
          className="mt-2 text-3xl font-semibold leading-tight text-white md:text-4xl"
        >
          {renderInlineFormatting(line.slice(2))}
        </h1>
      );
      return;
    }

    if (line.startsWith("## ")) {
      elements.push(
        <h2
          key={`h2-${elements.length}`}
          className="mt-10 text-2xl font-semibold leading-tight text-white md:text-3xl"
        >
          {renderInlineFormatting(line.slice(3))}
        </h2>
      );
      return;
    }

    if (line.startsWith("### ")) {
      elements.push(
        <h3
          key={`h3-${elements.length}`}
          className="mt-8 text-xl font-semibold leading-tight text-[#D8B87A]"
        >
          {renderInlineFormatting(line.slice(4))}
        </h3>
      );
      return;
    }

    elements.push(
      <p
        key={`p-${elements.length}`}
        className="text-[15px] leading-9 text-white/68 md:text-base"
      >
        {renderInlineFormatting(line)}
      </p>
    );
  });

  flushList();

  return elements;
}

export default function TopicArticle({
  topic,
  relatedTopics = [],
}: TopicArticleProps) {
  const hasContent = Boolean(topic.content?.trim());

  return (
    <article className="space-y-10">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-[#D8B87A]/35 bg-[#D8B87A]/10 px-4 py-1.5 text-xs font-medium text-[#D8B87A]">
            {topic.category}
          </span>

          <span className="text-sm text-white/45">{topic.date}</span>

          {topic.readingTime ? (
            <span className="text-sm text-white/45">{topic.readingTime}</span>
          ) : null}
        </div>

        <h1 className="mt-5 max-w-4xl text-3xl font-semibold leading-tight text-white md:text-4xl">
          {topic.title}
        </h1>

        <p className="mt-5 max-w-3xl leading-8 text-white/60">
          {topic.excerpt}
        </p>
      </div>

      <div className="relative h-[420px] overflow-hidden rounded-[2rem] border border-white/10">
<TopicImage
  src={topic.image}
  alt={topic.title}
  fill
  priority
  sizes="(min-width: 1024px) 900px, 100vw"
  className="object-cover"
/>

        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#05070B]/55 via-transparent to-transparent"
        />
      </div>

      <div className="rounded-[2rem] border border-white/10 bg-black/15 p-7 md:p-9">
        <div className="space-y-6">
          {hasContent ? (
            renderContent(topic.content ?? "")
          ) : (
            <p className="text-[15px] leading-9 text-white/68 md:text-base">
              {topic.excerpt}
            </p>
          )}
        </div>
      </div>

      {relatedTopics.length ? (
        <section className="space-y-5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#D8B87A]/70">
              Related Topics
            </p>

            <h2 className="mt-3 text-2xl font-semibold text-white">
              موضوعات ذات صلة
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {relatedTopics.map((item) => (
              <Link
                key={item.id}
                href={`/topics/${item.slug}`}
                className="group rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5 transition duration-500 hover:-translate-y-1 hover:border-[#D8B87A]/30"
              >
                <p className="text-xs text-[#D8B87A]/75">{item.category}</p>

                <h3 className="mt-3 line-clamp-2 text-lg font-semibold leading-7 text-white transition group-hover:text-[#D8B87A]">
                  {item.title}
                </h3>

                <p className="mt-3 line-clamp-2 text-sm leading-7 text-white/55">
                  {item.excerpt}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
