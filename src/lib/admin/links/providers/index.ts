import {
  categoriesLinkProvider,
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
    staticRoutesLinkProvider,
  ].forEach(registerAdminLinkProvider);
  initialized = true;
}

export {
  categoriesLinkProvider,
  pagesLinkProvider,
  projectsLinkProvider,
  seriesLinkProvider,
  staticRoutesLinkProvider,
  topicsLinkProvider,
};
