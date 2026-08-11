"use client";

import { ReactNode } from "react";
import MediaSidebar from "./MediaSidebar";
import { useMediaCenterCmsBlocks } from "./MediaCenterCmsBlocksContext";
import type { MediaSidebarModulesState } from "../../lib/media-sidebar-modules/types";
import type { PublicContentSearchSuggestion } from "../../lib/content/public-content-read";

type MediaPageShellProps = {
  children: ReactNode;
  sidebarModules: MediaSidebarModulesState;
  searchBasePath?: string;
  searchQuery?: string;
  searchSuggestions?: readonly PublicContentSearchSuggestion[];
  searchResultCount?: number;
  prefixBlocks?: ReactNode;
  suffixBlocks?: ReactNode;
};

export default function MediaPageShell({
  children,
  sidebarModules,
  searchBasePath,
  searchQuery,
  searchSuggestions,
  searchResultCount,
  prefixBlocks: prefixBlocksProp,
  suffixBlocks: suffixBlocksProp,
}: MediaPageShellProps) {
  const cmsBlocks = useMediaCenterCmsBlocks();
  const prefixBlocks = prefixBlocksProp ?? cmsBlocks.prefixBlocks;
  const suffixBlocks = suffixBlocksProp ?? cmsBlocks.suffixBlocks;

  return (
    <section className="relative py-12">
        <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <MediaSidebar
              searchBasePath={searchBasePath}
              searchQuery={searchQuery}
              searchSuggestions={searchSuggestions}
              searchResultCount={searchResultCount}
              sidebarModules={sidebarModules}
            />
          </div>

          <div className="min-w-0">
            <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] p-8 shadow-[0_20px_80px_rgba(0,0,0,0.25)]">
              {prefixBlocks || suffixBlocks ? (
                <>
                  {prefixBlocks ? <div className="mb-8">{prefixBlocks}</div> : null}
                  {children}
                  {suffixBlocks ? <div className="mt-8">{suffixBlocks}</div> : null}
                </>
              ) : (
                children
              )}
            </div>
          </div>
        </div>
    </section>
  );
}
