"use client";

import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
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
import {
  pageBlockTextAlignClass,
  type PageBlockTextAlignment,
} from "../../lib/page-blocks/configs";
import { VENESIA_SCROLLBAR_VISUAL_CLASSES } from "../venesia-scrollbar-styles";

type PublicContentSearchTextDisplay = {
  visible: boolean;
  bold: boolean;
  alignment: PageBlockTextAlignment;
};

type PublicContentSearchInputProps = {
  basePath: string;
  persistentParams?: Readonly<Record<string, string | undefined>>;
  submitPath?: string;
  submitPersistentParams?: Readonly<Record<string, string | undefined>>;
  query?: string;
  suggestions?: readonly PublicContentSearchSuggestion[];
  resultCount?: number;
  placeholder: string;
  ariaLabel: string;
  helpText: string;
  helpTextDisplay?: PublicContentSearchTextDisplay;
  showSearchAction?: boolean;
};

type FloatingListboxPosition = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
};

const FLOATING_LISTBOX_GAP = 9;
const FLOATING_LISTBOX_VIEWPORT_MARGIN = 12;
const FLOATING_LISTBOX_MAX_HEIGHT = 360;
const EMPTY_PERSISTENT_PARAMS: Readonly<Record<string, string | undefined>> = {};

function resolveFloatingListboxPosition(anchor: DOMRect): FloatingListboxPosition {
  const availableWidth = Math.max(0, window.innerWidth - FLOATING_LISTBOX_VIEWPORT_MARGIN * 2);
  const width = Math.min(anchor.width, availableWidth);
  const left = Math.min(
    Math.max(FLOATING_LISTBOX_VIEWPORT_MARGIN, anchor.left),
    Math.max(FLOATING_LISTBOX_VIEWPORT_MARGIN, window.innerWidth - width - FLOATING_LISTBOX_VIEWPORT_MARGIN),
  );
  const availableBelow = Math.max(
    0,
    window.innerHeight - anchor.bottom - FLOATING_LISTBOX_GAP - FLOATING_LISTBOX_VIEWPORT_MARGIN,
  );
  const availableAbove = Math.max(
    0,
    anchor.top - FLOATING_LISTBOX_GAP - FLOATING_LISTBOX_VIEWPORT_MARGIN,
  );
  const placeAbove = availableBelow < 180 && availableAbove > availableBelow;
  const maxHeight = Math.max(
    96,
    Math.min(FLOATING_LISTBOX_MAX_HEIGHT, placeAbove ? availableAbove : availableBelow),
  );

  return {
    left,
    top: placeAbove
      ? Math.max(FLOATING_LISTBOX_VIEWPORT_MARGIN, anchor.top - FLOATING_LISTBOX_GAP - maxHeight)
      : anchor.bottom + FLOATING_LISTBOX_GAP,
    width,
    maxHeight,
  };
}

export default function PublicContentSearchInput({
  basePath,
  persistentParams = EMPTY_PERSISTENT_PARAMS,
  submitPath = basePath,
  submitPersistentParams = persistentParams,
  query = "",
  suggestions = [],
  resultCount = 0,
  placeholder,
  ariaLabel,
  helpText,
  helpTextDisplay,
  showSearchAction = true,
}: PublicContentSearchInputProps) {
  const router = useRouter();
  const anchorRef = useRef<HTMLDivElement>(null);
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
  const [floatingPosition, setFloatingPosition] = useState<FloatingListboxPosition | null>(null);
  const [isPending, startTransition] = useTransition();

  const committedQuery = normalizePublicContentSearchQuery(query);
  const normalizedDraft = normalizePublicContentSearchQuery(draftQuery);
  const showSuggestions =
    listboxOpen &&
    Boolean(committedQuery) &&
    normalizedDraft === committedQuery &&
    suggestions.length > 0;

  const updateFloatingPosition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor?.isConnected || anchor.getClientRects().length === 0) {
      setFloatingPosition(null);
      return;
    }
    setFloatingPosition(resolveFloatingListboxPosition(anchor.getBoundingClientRect()));
  }, []);

  useLayoutEffect(() => {
    if (!showSuggestions) return;

    updateFloatingPosition();
    window.addEventListener("scroll", updateFloatingPosition, true);
    window.addEventListener("resize", updateFloatingPosition);
    window.visualViewport?.addEventListener("scroll", updateFloatingPosition);
    window.visualViewport?.addEventListener("resize", updateFloatingPosition);

    return () => {
      window.removeEventListener("scroll", updateFloatingPosition, true);
      window.removeEventListener("resize", updateFloatingPosition);
      window.visualViewport?.removeEventListener("scroll", updateFloatingPosition);
      window.visualViewport?.removeEventListener("resize", updateFloatingPosition);
    };
  }, [showSuggestions, updateFloatingPosition]);

  const buildSearchHref = useCallback(
    (
      path: string,
      nextQuery: string,
      paramsToPersist: Readonly<Record<string, string | undefined>>,
    ) => {
      const normalized = normalizePublicContentSearchQuery(nextQuery);
      const currentUrl = new URL(window.location.href);
      const params = currentUrl.pathname === path
        ? new URLSearchParams(currentUrl.search)
        : new URLSearchParams();

      for (const [key, value] of Object.entries(paramsToPersist)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }

      params.delete("page");
      if (normalized) params.set("q", normalized);
      else params.delete("q");

      const queryString = params.toString();
      return queryString ? `${path}?${queryString}` : path;
    },
    [],
  );

  const navigateToQuery = useCallback(
    (nextQuery: string) => {
      const normalized = normalizePublicContentSearchQuery(nextQuery);
      requestedQueryRef.current = normalized;
      hasPendingNavigationRef.current = true;
      const href = buildSearchHref(basePath, normalized, persistentParams);
      startTransition(() => router.replace(href, { scroll: false }));
    },
    [basePath, buildSearchHref, persistentParams, router],
  );

  const submitSearch = useCallback(
    (nextQuery: string) => {
      const normalized = normalizePublicContentSearchQuery(nextQuery);
      requestedQueryRef.current = normalized;
      draftQueryRef.current = normalized;
      hasPendingNavigationRef.current = true;
      if (searchTimerRef.current !== null) {
        window.clearTimeout(searchTimerRef.current);
        searchTimerRef.current = null;
      }
      setListboxOpen(false);
      setActiveSuggestion(-1);
      const href = buildSearchHref(
        submitPath,
        normalized,
        submitPersistentParams,
      );
      startTransition(() => router.push(href));
    },
    [buildSearchHref, router, submitPath, submitPersistentParams],
  );

  useLayoutEffect(() => {
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
      navigateToQuery(normalizedDraft);
    }, PUBLIC_CONTENT_SEARCH_DEBOUNCE_MS);

    return () => {
      if (searchTimerRef.current !== null) {
        window.clearTimeout(searchTimerRef.current);
        searchTimerRef.current = null;
      }
    };
  }, [navigateToQuery, normalizedDraft]);

  function selectSuggestion(index: number) {
    const suggestion = suggestions[index];
    if (!suggestion) return;
    setListboxOpen(false);
    setActiveSuggestion(-1);
    startTransition(() => router.push(suggestion.href));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (showSuggestions && activeSuggestion >= 0) {
        selectSuggestion(activeSuggestion);
      } else {
        submitSearch(normalizedDraft);
      }
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
    navigateToQuery("");
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  const listbox = showSuggestions && floatingPosition
    ? createPortal(
        <div
          id={listboxId}
          role="listbox"
          aria-label="اقتراحات البحث"
          data-public-content-search-listbox=""
          dir="rtl"
          style={{
            position: "fixed",
            left: floatingPosition.left,
            top: floatingPosition.top,
            width: floatingPosition.width,
            maxHeight: floatingPosition.maxHeight,
            zIndex: 60,
          }}
          className={`overflow-y-auto overscroll-contain rounded-2xl border border-white/12 bg-[#080B10]/98 p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.48)] backdrop-blur-xl ${VENESIA_SCROLLBAR_VISUAL_CLASSES}`}
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
        </div>,
        document.body,
      )
    : null;

  return (
    <div>
      <div
        ref={anchorRef}
        data-public-content-search-field=""
        className="relative"
      >
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
          className={`w-full rounded-full border border-white/10 bg-black/20 py-3 ps-12 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-[#D8B87A]/45 focus:bg-black/30 focus:ring-2 focus:ring-[#D8B87A]/10 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden ${showSearchAction ? "pe-12" : "pe-4"}`}
        />

        {showSearchAction ? (
          <button
            type="button"
            onClick={() => submitSearch(normalizedDraft)}
            aria-label="تنفيذ البحث"
            data-public-content-search-action=""
            className="absolute end-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-[#D8B87A] text-[#111] transition hover:bg-[#E4C98F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]/70"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="6" />
              <path d="m16 16 4 4" />
            </svg>
          </button>
        ) : null}

        {normalizedDraft ? (
          <button
            type="button"
            onClick={clearSearch}
            aria-label="مسح البحث"
            className="absolute start-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-xs text-white/45 transition hover:border-[#D8B87A]/30 hover:text-[#D8B87A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B87A]/55"
          >
            ×
          </button>
        ) : null}
      </div>

      {listbox}

      <p id={statusId} className="sr-only" role="status" aria-live="polite">
        {isPending || normalizedDraft !== committedQuery
          ? "جارٍ البحث"
          : committedQuery
            ? `تم العثور على ${resultCount} نتيجة`
            : helpText}
      </p>

      {helpTextDisplay?.visible !== false ? (
        <p
          className={`mt-3 text-xs leading-6 text-white/35 ${helpTextDisplay?.bold ? "font-bold" : "font-normal"} ${pageBlockTextAlignClass(helpTextDisplay?.alignment ?? "right")}`}
          data-public-content-search-help=""
        >
          {helpText}
        </p>
      ) : null}
    </div>
  );
}
