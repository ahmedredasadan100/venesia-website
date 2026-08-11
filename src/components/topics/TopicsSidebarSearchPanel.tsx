import { SidebarFeedPanel } from "../sidebar-feeds/SidebarFeedPanel";
import PublicContentSearchInput from "../public/PublicContentSearchInput";
import type { PublicContentSearchSuggestion } from "../../lib/content/public-content-read";

type TopicsSidebarSearchPanelProps = {
  query?: string;
  suggestions?: readonly PublicContentSearchSuggestion[];
  resultCount?: number;
};

export default function TopicsSidebarSearchPanel({
  query = "",
  suggestions = [],
  resultCount = 0,
}: TopicsSidebarSearchPanelProps) {
  return (
    <SidebarFeedPanel eyebrow="Search" title="ابحث في الموضوعات">
      <PublicContentSearchInput
        basePath="/topics"
        query={query}
        suggestions={suggestions}
        resultCount={resultCount}
        placeholder="اكتب كلمة البحث..."
        ariaLabel="ابحث داخل الموضوعات"
        helpText="ابحث بالعنوان أو الملخص أو الرابط أو التصنيف أو السلسلة."
      />
    </SidebarFeedPanel>
  );
}
