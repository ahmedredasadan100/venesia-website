"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Suggestion = {
  id: number;
  title: string;
  slug: string;
  category?: string | null;
};

type AdminTopicSearchProps = {
  defaultValue?: string;
};

export default function AdminTopicSearch({
  defaultValue = "",
}: AdminTopicSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [value, setValue] = useState(defaultValue);
  const [prevDefaultValue, setPrevDefaultValue] = useState(defaultValue);
  const [fetchSuggestions, setFetchSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  if (defaultValue !== prevDefaultValue) {
    setPrevDefaultValue(defaultValue);
    setValue(defaultValue);
  }

  const trimmed = value.trim();
  const canSearch = trimmed.length >= 2;
  const suggestions = canSearch ? fetchSuggestions : [];

  useEffect(() => {
    if (!canSearch) return;

    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/admin/topics/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );

        const json = await response.json();
        setFetchSuggestions(json.results ?? []);
        setIsOpen(true);
      } catch {
        setFetchSuggestions([]);
        setIsOpen(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, canSearch]);

  function applySearch(nextValue: string) {
    const params = new URLSearchParams(searchParams.toString());
    const cleanValue = nextValue.trim();

    if (cleanValue) {
      params.set("q", cleanValue);
    } else {
      params.delete("q");
    }

    params.delete("page");

    const query = params.toString();
    router.push(query ? `/admin/topics?${query}#topics-table` : "/admin/topics#topics-table");
    setIsOpen(false);
  }

  return (
    <div className="relative">
      <input
        name="q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            applySearch(value);
          }
        }}
        placeholder="ابحث بالعنوان أو الرابط..."
        className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#D8B87A]/45"
      />

      {value ? (
        <button
          type="button"
          onClick={() => {
            setValue("");
            applySearch("");
          }}
          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/10 px-2 py-1 text-xs text-white/45 hover:text-white"
        >
          مسح
        </button>
      ) : null}

      {canSearch && isOpen && suggestions.length > 0 ? (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-full overflow-hidden rounded-[18px] border border-white/10 bg-[#080B10] shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
          {suggestions.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setValue(item.title);
                applySearch(item.title);
              }}
              className="block w-full border-b border-white/10 px-4 py-3 text-right transition last:border-b-0 hover:bg-white/[0.04]"
            >
              <span className="block text-sm font-medium text-white">
                {item.title}
              </span>
              <span className="mt-1 block font-en text-xs text-white/35">
                /topics/{item.slug}
              </span>
              {item.category ? (
                <span className="mt-1 block text-xs text-[#D8B87A]/70">
                  {item.category}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}