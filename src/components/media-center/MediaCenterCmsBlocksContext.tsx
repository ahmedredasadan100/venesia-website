"use client";

import { createContext, useContext, type ReactNode } from "react";

type MediaCenterCmsBlocksContextValue = {
  prefixBlocks?: ReactNode;
  suffixBlocks?: ReactNode;
};

const MediaCenterCmsBlocksContext = createContext<MediaCenterCmsBlocksContextValue>({});

export function MediaCenterCmsBlocksProvider({
  prefixBlocks,
  suffixBlocks,
  children,
}: MediaCenterCmsBlocksContextValue & { children: ReactNode }) {
  return (
    <MediaCenterCmsBlocksContext.Provider value={{ prefixBlocks, suffixBlocks }}>
      {children}
    </MediaCenterCmsBlocksContext.Provider>
  );
}

export function useMediaCenterCmsBlocks() {
  return useContext(MediaCenterCmsBlocksContext);
}
