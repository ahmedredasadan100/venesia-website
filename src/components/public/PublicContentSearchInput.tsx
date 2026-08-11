"use client";

import { useRouter } from "next/navigation";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from "react";

import {
  normalizePublicContentSearchQuery,
  PUBLIC_CONTENT_SEARCH_DEBOUNCE_MS,
  PUBLIC_CONTENT_SEARCH_MAX_LENGTH,
  type PublicContentSearchSuggestion,
} from "../../lib/content/public-content-read";

type PublicContentSearchInputProps = {
  basePath: string;
  query?: string;
  suggestions?: readonly PublicContentSearchSuggestion[];
  resultCount?: number;
  placeholder: string;
  ariaLabel: string;
  helpText: string;
};

export default function PublicContentSearchInput({
  basePath,
  query = "",
  suggestions = [],
  resultCount = 0,
  placeholder,
  ariaLabel,
  helpText,
}: PublicContentSearchInputProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const initialQuery = normalizePublicContentSearchQuery(query);
  const requestedQueryRef = useRef(initialQuery);
  const draftQueryRef = useRef(initialQuery);
  const hasPendingNavigationRef = useRef(false);
  const searchTimerRef = useRef<number | null>(null);
  const listboxId = useId();
  const statusId = useId();
  const [draftQuery, setDraftQuery] = useState(query);
  const [listboxOpen, setListboxOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [isPending, startTransition] = useTransition();

  const committedQuery = normalizePublicContentSearchQuery(query);
  const normalizedDraft = normalizePublicContentSearchQuery(draftQuery);
  const showSuggestions =
    listboxOpen &&
    Boolean(committedQuery) &&
    normalizedDraft === committedQuery &&
    suggestions.length > 0;

  const navigateToSearch = useCallback(
    (nextQuery: string) => {
      const normalized = normalizePublicContentSearchQuery(nextQuery);
      requestedQueryRef.current = normalized;
      hasPendingNavigationRef.current = true;

      const currentUrl = new URL(window.location.href);
      const params = currentUrl.pathname === basePath
        ? new URLSearchParams(currentUrl.search)
        : new URLSearchParams();

      params.delete("page");
      if (normalized) params.set("q", normalized);
      else params.delete("q");

      const queryString = params.toString();
      const href = queryString ? `${basePath}?${queryString}` : basePath;
      startTransition(() => router.replace(href, { scroll: false }));
    },
    [basePath, router],
  );

  useEffect(() => {
    const hasNewerDraft =
      normalizePublicContentSearchQuery(draftQueryRef.current) !==
      requestedQueryRef.current;

    if (
      hasPendingNavigationRef.current &&
      (committedQuery !== requestedQueryRef.current || hasNewerDraft)
    ) {
      return;
    }

    hasPendingNavigationRef.current = false;
    requestedQueryRef.current = committedQuery;
    draftQueryRef.current = query;
    setDraftQuery(query);
    setActiveSuggestion(-1);
  }, [committedQuery, query]);

  useEffect(() => {
    if (normalizedDraft === requestedQueryRef.current) return;

    searchTimerRef.current = window.setTimeout(() => {
      searchTimerRef.current = null;
      navigateToSearch(normalizedDraft);
    }, PUBLIC_CONTENT_SEARCH_DEBOUNCE_MS);

    return () => {
      if (searchTimerRef.current !== null) {
        window.clearTimeout(searchTimerRef.current);
        searchTimerRef.current = null;
      }
    };
  }, [navigateToSearch, normalizedDraft]);

  function selectSuggestion(index: number) {
    const suggestion = suggestions[index];
    if (!suggestion) return;
    setListboxOpen(false);
    setActiveSuggestion(-1);
    startTransition(() => router.push(suggestion.href));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && normalizedDraft !== committedQuery) {
      event.preventDefault();
      if (searchTimerRef.current !== null) {
        window.clearTimeout(searchTimerRef.current);
        searchTimerRef.current = null;
      }
      setListboxOpen(false);
      setActiveSuggestion(-1);
      navigateToSearch(normalizedDraft);
      return;
    }

    if (!suggestions.length || normalizedDraft !== committedQuery) {
      if (event.key === "Escape") setListboxOpen(false);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setListboxOpen(true);
      setActiveSuggestion((current) => (current + 1) % suggestions.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setListboxOpen(true);
      setActiveSuggestion((current) =>
        current <= 0 ? suggestions.length - 1 : current - 1,
      );
      return;
    }

    if (event.key === "Enter" && activeSuggestion >= 0) {
      event.preventDefault();
      selectSuggestion(activeSuggestion);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setListboxOpen(false);
      setActiveSuggestion(-1);
    }
  }

  function clearSearch() {
    requestedQueryRef.current = "";
    draftQueryRef.current = "";
    setDraftQuery("");
    setListboxOpen(false);
    setActiveSuggestion(-1);
    navigateToSearch("");
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        value={draftQuery}
        onChange={(event) => {
          const nextDraft = event.currentTarget.value;
          draftQueryRef.current = nextDraft;
          setDraftQuery(nextDraft);
          setListboxOpen(true);
          setActiveSuggestion(-1);
        }}
        onFocus={() => setListboxOpen(true)}
        onBlur={(event) => {
          if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) {
            setListboxOpen(false);
            setActiveSuggestion(-1);
          }
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-controls={showSuggestions ? listboxId : undefined}
        aria-expanded={showSuggestions}
        aria-haspopup="listbox"
        aria-activedescendant={
          showSuggestions && activeSuggestion >= 0
            ? `${listboxId}-${activeSuggestion}`
            : undefined
        }
        aria-describedby={statusId}
        aria-busy={isPending || normalizedDraft !== committedQuery}
        autoComplete="off"
        maxLength={PUBLIC_CONTENT_SEARCH_MAX_LENGTH}
        className="w-full rounded-full border border-white/10 bg-black/20 py-3 pe-12 ps-5 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-[#D8B87A]/45 focus:bg-black/30 focus:ring-2 focus:ring-[#D8B87A]/10"
      />

      {normalizedDraft ? (
        <button
          type="button"
          onClick={clearSearch}
          aria-label="مسح البحث"
          className="absolute end-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-xs text-white/45 transition hover:border-[#D8B87A]/30 hover:text-[#D8B87A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]/55"
        >
          ×
        </button>
      ) : null}

      {showSuggestions ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label="اقتراحات البحث"
          className="absolute inset-x-0 top-[calc(100%+0.55rem)] z-40 overflow-hidden rounded-2xl border border-white/12 bg-[#080B10]/98 p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.48)] backdrop-blur-xl"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              id={`${listboxId}-${index}`}
              type="button"
              role="option"
              aria-selected={index === activeSuggestion}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveSuggestion(index)}
              onClick={() => selectSuggestion(index)}
              className={`block w-full rounded-xl px-3 py-2.5 text-start transition ${
                index === activeSuggestion
                  ? "bg-[#D8B87A]/12 text-[#D8B87A]"
                  : "text-white/78 hover:bg-white/[0.05] hover:text-white"
              }`}
            >
              <span className="block text-sm leading-6">{suggestion.title}</span>
              {suggestion.meta ? (
                <span className="mt-0.5 block text-xs text-white/38">
                  {suggestion.meta}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      <p id={statusId} className="sr-only" role="status" aria-live="polite">
        {isPending || normalizedDraft !== committedQuery
          ? "جارٍ البحث"
          : committedQuery
            ? `تم العثور على ${resultCount} نتيجة`
            : helpText}
      </p>

      <p className="mt-3 text-xs leading-6 text-white/35">{helpText}</p>
    </div>
  );
}
