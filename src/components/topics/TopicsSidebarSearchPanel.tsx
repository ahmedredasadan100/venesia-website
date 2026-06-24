import { SidebarFeedPanel } from "../sidebar-feeds/SidebarFeedPanel";

export default function TopicsSidebarSearchPanel() {
  return (
    <SidebarFeedPanel eyebrow="Search" title="ابحث في الموضوعات">
      <div className="rounded-full border border-white/10 bg-black/20 px-5 py-3 text-sm text-white/35">
        اكتب كلمة البحث...
      </div>
    </SidebarFeedPanel>
  );
}
