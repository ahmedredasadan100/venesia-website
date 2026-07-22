export const TOPIC_EDITOR_NAVIGATION_EVENT = "topic-editor:navigate";

export type TopicEditorNavigationDetail =
  | string
  | {
      tabId: string;
      targetId?: string;
    };

export function navigateTopicEditor(tabId: string, targetId?: string) {
  window.dispatchEvent(
    new CustomEvent<TopicEditorNavigationDetail>(TOPIC_EDITOR_NAVIGATION_EVENT, {
      detail: targetId ? { tabId, targetId } : tabId,
    }),
  );
}
