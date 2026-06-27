import {
  categoriesLinkProvider,
  mediaLinkProvider,
  pagesLinkProvider,
  projectsLinkProvider,
  seriesLinkProvider,
  staticRoutesLinkProvider,
  topicsLinkProvider,
} from "./resources";
import { registerAdminLinkProvider } from "../registry";

let initialized = false;

export function ensureAdminLinkProvidersRegistered() {
  if (initialized) return;
  [
    pagesLinkProvider,
    projectsLinkProvider,
    topicsLinkProvider,
    categoriesLinkProvider,
    seriesLinkProvider,
    mediaLinkProvider,
    staticRoutesLinkProvider,
  ].forEach(registerAdminLinkProvider);
  initialized = true;
}

export {
  categoriesLinkProvider,
  mediaLinkProvider,
  pagesLinkProvider,
  projectsLinkProvider,
  seriesLinkProvider,
  staticRoutesLinkProvider,
  topicsLinkProvider,
};
