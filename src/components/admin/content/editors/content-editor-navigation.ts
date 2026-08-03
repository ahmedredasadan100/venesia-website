export const CONTENT_EDITOR_NAVIGATION_EVENT = "content-editor:navigate";

export type ContentEditorNavigationDetail = {
  tabId: string;
  targetId?: string;
};

export function navigateContentEditor(
  detail: ContentEditorNavigationDetail,
) {
  window.dispatchEvent(
    new CustomEvent<ContentEditorNavigationDetail>(
      CONTENT_EDITOR_NAVIGATION_EVENT,
      { detail },
    ),
  );
}
