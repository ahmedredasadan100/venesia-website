"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import MediaSidebar from "./MediaSidebar";
import { useMediaCenterCmsBlocks } from "./MediaCenterCmsBlocksContext";
import type { MediaSidebarItem } from "../../lib/media-center";
import type { MediaSidebarModulesState } from "../../lib/media-sidebar-modules/types";
import { DEFAULT_MEDIA_SIDEBAR_MODULES } from "../../lib/media-sidebar-modules/defaults";

type MediaSearchContextValue = {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
};

const MediaSearchContext = createContext<MediaSearchContextValue | null>(null);

export function useMediaSearch() {
  const context = useContext(MediaSearchContext);

  if (!context) {
    return {
      searchQuery: "",
      setSearchQuery: () => {},
    };
  }

  return context;
}

type MediaPageShellProps = {
  children: ReactNode;
  latestNewsSidebar?: MediaSidebarItem[];
  popularMediaSidebarItems?: MediaSidebarItem[];
  sidebarModules?: MediaSidebarModulesState;
  prefixBlocks?: ReactNode;
  suffixBlocks?: ReactNode;
};

export default function MediaPageShell({
  children,
  latestNewsSidebar = [],
  popularMediaSidebarItems = [],
  sidebarModules = DEFAULT_MEDIA_SIDEBAR_MODULES,
  prefixBlocks: prefixBlocksProp,
  suffixBlocks: suffixBlocksProp,
}: MediaPageShellProps) {
  const cmsBlocks = useMediaCenterCmsBlocks();
  const prefixBlocks = prefixBlocksProp ?? cmsBlocks.prefixBlocks;
  const suffixBlocks = suffixBlocksProp ?? cmsBlocks.suffixBlocks;
  const [searchQuery, setSearchQuery] = useState("");

  const searchValue = useMemo(
    () => ({ searchQuery, setSearchQuery }),
    [searchQuery]
  );

  return (
    <MediaSearchContext.Provider value={searchValue}>
      <section className="relative py-12">
        <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <MediaSidebar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              latestNewsSidebar={latestNewsSidebar}
              popularMediaSidebarItems={popularMediaSidebarItems}
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
    </MediaSearchContext.Provider>
  );
}
