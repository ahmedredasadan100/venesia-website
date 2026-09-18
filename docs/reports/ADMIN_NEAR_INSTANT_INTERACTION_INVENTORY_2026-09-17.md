# System-wide Admin Interaction Inventory and Journey Matrix

Baseline: `78b719aeebecd9ea2e6587836649bfbd8e80c504` (accepted PR #165 merge). This is a report projection of current authoritative source and manifests, not a new runtime, registry or Source of Truth.

## Evidence boundary

The source inventory covers all **69 Admin page entrypoints**, **188 reachable Admin source owners containing interactions**, **1331 interactive JSX callsites**, and **80 declared tabs**. Existing manifests contain 34 Collection and 34 Form registrations. The retained navigation matrix has **50 mixed route/embedded-family entries: 4 Active, 12 Dormant, 31 Not Eligible, 3 Decision Required**. These are different counting units; they must not be summed or called independent benchmarks.

All tracked baseline TypeScript/JavaScript was read from the immutable Git object in one batch. Local imports were resolved through named barrel exports, excluding type-only imports. Route reachability includes conditional/dynamic imports and all functions in an imported source file. Therefore the appendix enumerates source callsites, not a proof that every conditional control is mounted simultaneously. No runtime click, login, remote request, mutation, benchmark, bootstrap or test was performed by this inventory task.

Every route and source-callsite has a classification cell. **I** means insufficient performance evidence for a safe causal optimization decision; it does not create a new product/security decision. **H** applies to static placeholder/guidance bodies. New proven read-path/command deltas are tracked separately as **C/F**, while their complete journey timing remains unknown. No unmeasured interaction is marked A. A cached pagination proof must never classify an entire editor/save/back journey as Near-Instant.

Machine-readable complete source appendix: `.tmp-qa/admin-near-instant-2026-09-17/complete-interaction-inventory.json`. Full reporting matrix with every requested column: `.tmp-qa/admin-near-instant-2026-09-17/interaction-journey-adoption-matrix.json`. These are static evidence artifacts, not executable adoption owners.

## Accepted evidence reused

- `.tmp-qa/system-wide-admin-navigation/final-adoption-matrix.json` — SHA256 `72cf46f5d34f3917d27e957bcbf408d0a37e84d7638ea196285ecd2b222e39e8`.
- `.tmp-qa/system-wide-admin-navigation/owner-inventory.json` — SHA256 `7092bd6524d144c55bdaf0392337dc183a2c9f7f127e90d889a6e8abbc9c5db2`.
- `.tmp-qa/navigation-eligibility-review/FINAL-DELIVERY.md` — SHA256 `333dbecb5353d502eb6cce62f3d243acaac417ee6cac5b510c6cd480e557f73e`.
- `.tmp-qa/navigation-eligibility-review/final-gate.json` — SHA256 `650678c1fbb3f1814f20bc1e76b2d77f00a27920b639b69a6ca4a7eba1db0d58`.
- `.tmp-qa/pr165-closure/merge-proof.json` — SHA256 `0857413967fa24535ab254460a95d567ffb139100de09f5c5c4843dfe62b2a8b`.

Accepted #165 collection policy/identity/dedup/cancellation/invalidation/foreground priority, 30s freshness and 5min GC, isolated bootstrap/RLS/migration provenance and 135/135 local / 7/7 merge / 11/11 Public evidence are historical scoped evidence. They are reused where relevant dependencies remain equal; this inventory does not rerun or expand their claims. Current Active/Dormant labels come from the retained September 15 census, not a new Production census.

## Journey matrix

| ID | Surface | End-to-end steps | Current owners | Correct-target usable criterion | Class |
|---|---|---|---|---|---|
| J01 | Article + news/press/site_update/video/gallery | Topics query/filter/sort/limit/pagination → row/card/action → matching content-type editor → basic/content/FAQ where applicable/SEO/publish → category/series/media/date/reference → save/confirm → close/back → same list query usable | TopicArticle/Media editor → ContentEditorShell / AdminFormRuntime; unified content actions; existing collection invalidation | Entity identity, version, taxonomy options, media references and fields must be usable; save needs committed server result; back needs original query and current rows. | I |
| J02 | Category create/edit | Categories list → create or row edit → parent/color/publication/SEO fields → save → back → same filtered list | CategoryForm / AdminFormRuntime; taxonomy form loader/actions; categories Data Runtime | Parent options and existing unpublished parent remain correct; failed reference read cannot become empty successful choices. | I |
| J03 | Series create/edit | Series list → create or row edit → category/SEO/publication → save → back | SeriesForm / AdminFormRuntime; taxonomy form loader/actions; series Data Runtime | Current category and revision usable; duplicate/category constraints preserved. | I |
| J04 | Residential + commercial projects | Projects hub → type list → create or row edit → basic/location/overview/plans/delivery/media/SEO/review → save/publish → preview or back | ProjectEditForm / AdminFormRuntime; project-entry-data; project write owner; projects Data Runtime | Project identity plus all persisted draft sections; location cascade, floor-plan detail editing and media selection correct. No independent units route exists in this baseline; floor plans/details are embedded. | I |
| J05 | Four hierarchy levels | Locations hub → governorates/cities/districts/sub-districts list → create/edit modal → parent hierarchy → save/status/delete → modal close/list reconcile | ProjectLocationsManagementClient / ProjectLocationFormModal; canonical location domain/read model; shared Data/Form | Parent scope, domain restrictions, row revision and list selection/query preserved. | I |
| J06 | Tracking profile/stages/items/updates | Construction hub or project → tracking profile → stages list → stage → items list → item → updates → create/edit/modal/media/video/date/publication → save/back along parents | TrackingCollections / TrackingForms / TrackingVideoFields; tracking-actions and canonical tracking loaders | Every parent identity/scope and nested collection preserved; no whole-journey speed claim from one pagination proof. | I |
| J07 | Pages composition/SEO | Pages list → quick-create or page open → modules/map/SEO tabs → assignment filter/sort/list/grid → assign template/slot or block link → block settings → save → contextual return page → return list | PagesTableClient / PageBlocksClient / PageSeoPanel; page assignment/query/action owners; ModuleEditorPresentation contextual back | Correct page assignments and title; target module kind/id; versioned save, order and contextual back retained. Pages remote pagination semantics remain decision-required from #165. | I |
| J08 | All nine registered module kinds | Block hub → hero/content/cta/cards/breadcrumb/feed/featured/media-sidebar/media-hub list → create or row settings → registered tabs/sections → module references/assignments/media/link → save/duplicate/delete → return source page or module list | BlockModuleManagerClient and module-specific manager/edit clients; ModuleEditorPresentation; page-block admin queries/actions | Every registered kind retained separately in route inventory; content slug dispatch variants retain their registered ownership. | I |
| J09 | Menus and menu item builder | Menus list → create/menu edit → item hierarchy → create/edit item → link resource picker + optional media → sort/reparent/status/delete/save → back | MenuBuilderClient / MenuItemForm / MenuItemsTableClient; AdminLinkField/Picker; canonical menu actions | Correct link resource identity, menu target and ordering; stale picker responses must never replace current resource results. | I |
| J10 | Footer singleton aggregate | Footer → slot/column/card editor → manual links or selected menu → link picker/media → reorder → save → usable aggregate | FooterBuilderClient / FooterBuilderEditors / FooterSlotEditorCard; canonical footer actions | Draft identity, selected menu/manual link mode, ordering and server commitment. | I |
| J11 | Library manage and shared selection | Media library or image/gallery/file field → picker → images/videos/documents folder → search/filter/load more/item → detail/usage → select/upload/rename/delete as applicable → return exact field | MediaLibraryCore / AdminMediaPickerModal / AdminMedia*Field; existing media library/catalog/action owners | Selected asset and usage truth; correct return field/gallery position. Manage/Picker specialized navigation decisions retained; no mutation exercised on Production. | I |
| J12 | Redirect create/edit | Redirects list → row/create modal → source/destination/status/code → save/status/delete → confirmed list reconcile | RedirectsClient / RedirectFormModal / shared Data and Form owners; redirect actions | Domain validation, current row identity and mutation truth. | I |
| J13 | Global metadata | Meta manager → site metadata/social/organization controls → edit inheritance/default → save → confirmed usable state | MetaManagerClient / shared form lifecycle; existing global SEO read/write owners | Singleton SEO semantics and fallback resolution; no inherited public timing claim. | I |
| J14 | Sitemap diagnostics | Sitemap monitor → diagnostic rows and filters → check/refresh → result detail/link → return | SitemapMonitorClient; current sitemap diagnostics owner | Actual diagnostic completion and data match, not loading-indicator disappearance. | I |
| J15 | Admin users and roles | Users list → create/edit modal → identity/role/status/password fields → save → activate/deactivate/delete → list reconcile | UsersManagementClient / AdminUserFormModal; Auth-domain actions; shared Data/Form | No security-policy or identity semantics change; current admin/session validation preserved. | I |
| J16 | Activity log | Activity log → query/search/filter/sort/limit/page → activity row/popover/details → return | ActivityLogClient; existing activity Data Runtime and AdminActivityPopover | Correct selected event and actor/time/details; historical Active navigation proof does not time every popover. | I |
| J17 | Reports hub/details/image report | Reports hub → report key or topics-without-image → query → record link/editor → add image/save → back to report | AdminReportsView / AdminReportDetailView / TopicsWithoutImageReportClient; report loaders; ContentEditorShell report invalidation | No-image report stale records removed after committed image save; #165 shared freshness proof retained separately. | I |
| J18 | Integration platform/wizard | Integrations → provider row → connection wizard → account/resource/test/status step → connection result/back | AdminIntegrationsPlatform / IntegrationConnectionWizard; existing integration read/action owners | Security-sensitive connection semantics unchanged; production connection/test mutations not executed. | I |
| J19 | Vault server configuration | Integrations server configuration → provider credential panel → replacement/test → confirmed state/back | IntegrationsServerConfiguration; vault aggregate with concurrency/test limits | Sensitive command completion requires authorized isolated proof; never expose credentials or infer generic Form adoption. | I |
| J20 | Company identity/maintenance | General settings → identity text/logo/media → save; maintenance toggle → confirm → visible state | CompanyIdentityPanel / MaintenanceModePanel; domain singleton writes; shared form/feedback/confirmation | Persisted singleton revision and maintenance semantics; no Production mutation. | I |
| J21 | Media policies and recovery | Media settings → upload/deletion/storage policy → save; recovery queue → inspect/repair/reconcile action → confirmed queue | MediaSettingsPanel / MediaRecoveryCenter; existing media policy and saga owners | Storage/delete/recovery domain correctness; specialized command costs remain unmeasured. | I |
| J22 | Security/password/session | Security settings → password/session/security policy → guarded command → result | SecuritySettingsClient; Auth-domain commands | New session/login/revoke is a mutation requiring allowed isolated environment; no production login attempted. | I |
| J23 | Appearance/theme placeholders | Appearance/theme → informational placeholder → available navigation | AdminPlaceholderPage | No actual editor/read exists; retain H for placeholder body rather than inventing controls. | H |
| J24 | Login and password guidance | Login → credentials → authentication/redirect; forgot-password → guidance/back | AdminLoginForm; existing Auth/session boundary | Authentication usable route and identity require authorized session evidence; forgot-password guidance has no entity form. | I |
| J25 | Dashboard and shell | Shell sidebar/account navigation → dashboard metrics/shortcut/activity link → correct target; account/logout → session result | AdminShell / AdminDashboardView / existing shell navigation and dashboard loader | Sidebar source/owner reused from #165. Dashboard summaries and each destination remain independently timed. | I |
| J26 | Link resource chooser | Any AdminLinkField → picker open → pages/menus/projects/topics/categories/series/static route → search/menu scope → select/apply → exact caller field | AdminLinkPicker; links/actions; links/recent (persisted user choices, not entity cache) | Correct requested resource/search response required. External/anchor/download draft modes retained; download delegates media picker. | I |
| J27 | Shared local interaction owners | Tabs/accordion/row more/column chooser/filter popover/date picker/confirmation/feedback/preview → accessible correct control → dismiss/focus return | AdminModuleTabs / AdminSingleOpenAccordion / DataGridRowActions / DatePicker / ConfirmDialog / Feedback | Local or already resident does not imply measured near-instant. Data-backed caller and identity must be proven. | I |

Before/After/median/variance/network columns for complete journeys are **unmeasured**, explicitly null in JSON. No P95 is reported. Each route below maps to one or more journey families; every actual invocation and final UI state still needs appropriate evidence before performance closure.

## Every Admin route

| Route | Journey | Route/RSC owner | Existing manifest IDs | Class |
|---|---|---|---|---|
| `/admin/forgot-password` | J24 | `src/app/admin/(auth)/forgot-password/page.tsx` | `admin-auth-pages` | H |
| `/admin/login` | J24 | `src/app/admin/(auth)/login/page.tsx` | `admin-auth-pages`, `authentication-login` | I |
| `/admin/activity-log` | J16 | `src/app/admin/activity-log/page.tsx` | `activity-log` | I |
| `/admin/content/categories/[id]` | J02 | `src/app/admin/content/categories/[id]/page.tsx` | `content-editor-pages`, `topic-category-create-edit` | I |
| `/admin/content/categories/new` | J02 | `src/app/admin/content/categories/new/page.tsx` | `content-editor-pages`, `topic-category-create-edit` | I |
| `/admin/content/categories` | J02 | `src/app/admin/content/categories/page.tsx` | `content-categories` | I |
| `/admin/content/series/[id]` | J03 | `src/app/admin/content/series/[id]/page.tsx` | `content-editor-pages`, `topic-series-create-edit` | I |
| `/admin/content/series/new` | J03 | `src/app/admin/content/series/new/page.tsx` | `content-editor-pages`, `topic-series-create-edit` | I |
| `/admin/content/series` | J03 | `src/app/admin/content/series/page.tsx` | `content-series` | I |
| `/admin/content/topics/[id]` | J01 | `src/app/admin/content/topics/[id]/page.tsx` | `content-editor-pages`, `topic-article-create-edit`, `topic-media-create-edit` | I |
| `/admin/content/topics/[id]/preview` | J01 | `src/app/admin/content/topics/[id]/preview/page.tsx` | `content-editor-pages` | I |
| `/admin/content/topics/new` | J01 | `src/app/admin/content/topics/new/page.tsx` | `content-editor-pages`, `topic-article-create-edit`, `topic-media-create-edit` | I |
| `/admin/content/topics` | J01 | `src/app/admin/content/topics/page.tsx` | `content-topics` | I |
| `/admin/media-library` | J11 | `src/app/admin/media-library/page.tsx` | `media-library` | I |
| `/admin` | J25 | `src/app/admin/page.tsx` | `dashboard-recent-content` | I |
| `/admin/pages-blocks/blocks/breadcrumb/[id]` | J08 | `src/app/admin/pages-blocks/blocks/breadcrumb/[id]/page.tsx` | `block-template-breadcrumb-editor` | I |
| `/admin/pages-blocks/blocks/breadcrumb` | J08 | `src/app/admin/pages-blocks/blocks/breadcrumb/page.tsx` | `block-template-libraries`, `block-template-create-modals` | I |
| `/admin/pages-blocks/blocks/cards/[id]` | J08 | `src/app/admin/pages-blocks/blocks/cards/[id]/page.tsx` | `block-template-cards-editor` | I |
| `/admin/pages-blocks/blocks/cards` | J08 | `src/app/admin/pages-blocks/blocks/cards/page.tsx` | `block-template-libraries`, `block-template-create-modals` | I |
| `/admin/pages-blocks/blocks/content/[id]` | J08 | `src/app/admin/pages-blocks/blocks/content/[id]/page.tsx` | `block-template-content-editor` | I |
| `/admin/pages-blocks/blocks/content` | J08 | `src/app/admin/pages-blocks/blocks/content/page.tsx` | `block-template-libraries`, `block-template-create-modals` | I |
| `/admin/pages-blocks/blocks/cta/[id]` | J08 | `src/app/admin/pages-blocks/blocks/cta/[id]/page.tsx` | `block-template-cta-editor` | I |
| `/admin/pages-blocks/blocks/cta` | J08 | `src/app/admin/pages-blocks/blocks/cta/page.tsx` | `block-template-libraries`, `block-template-create-modals` | I |
| `/admin/pages-blocks/blocks/featured/[id]` | J08 | `src/app/admin/pages-blocks/blocks/featured/[id]/page.tsx` | `block-template-featured-editor` | I |
| `/admin/pages-blocks/blocks/featured` | J08 | `src/app/admin/pages-blocks/blocks/featured/page.tsx` | `block-template-libraries`, `block-template-create-modals` | I |
| `/admin/pages-blocks/blocks/feed/[id]` | J08 | `src/app/admin/pages-blocks/blocks/feed/[id]/page.tsx` | `block-template-feed-editor` | I |
| `/admin/pages-blocks/blocks/feed` | J08 | `src/app/admin/pages-blocks/blocks/feed/page.tsx` | `block-template-libraries`, `block-template-create-modals` | I |
| `/admin/pages-blocks/blocks/hero/[id]` | J08 | `src/app/admin/pages-blocks/blocks/hero/[id]/page.tsx` | `block-template-hero-editor` | I |
| `/admin/pages-blocks/blocks/hero` | J08 | `src/app/admin/pages-blocks/blocks/hero/page.tsx` | `block-template-libraries`, `block-template-create-modals` | I |
| `/admin/pages-blocks/blocks/media-hub/[id]` | J08 | `src/app/admin/pages-blocks/blocks/media-hub/[id]/page.tsx` | `block-template-media-hub-editor` | I |
| `/admin/pages-blocks/blocks/media-hub` | J08 | `src/app/admin/pages-blocks/blocks/media-hub/page.tsx` | `block-template-libraries` | I |
| `/admin/pages-blocks/blocks/media-sidebar/[id]` | J08 | `src/app/admin/pages-blocks/blocks/media-sidebar/[id]/page.tsx` | `block-template-media-sidebar-editor` | I |
| `/admin/pages-blocks/blocks/media-sidebar` | J08 | `src/app/admin/pages-blocks/blocks/media-sidebar/page.tsx` | `block-template-libraries` | I |
| `/admin/pages-blocks/blocks` | J08 | `src/app/admin/pages-blocks/blocks/page.tsx` | `blocks-library-hub` | I |
| `/admin/pages-blocks/footer` | J10 | `src/app/admin/pages-blocks/footer/page.tsx` | `footer-builder-shell`, `footer-fixed-slots`, `footer-manual-links`, `footer-builder` | I |
| `/admin/pages-blocks/menus/[id]` | J09 | `src/app/admin/pages-blocks/menus/[id]/page.tsx` | `menu-editor-shell`, `menu-items`, `menu-builder` | I |
| `/admin/pages-blocks/menus` | J09 | `src/app/admin/pages-blocks/menus/page.tsx` | `menus-list`, `menu-quick-create`, `menu-builder` | I |
| `/admin/pages-blocks/pages/[id]` | J07 | `src/app/admin/pages-blocks/pages/[id]/page.tsx` | `page-composition-shell`, `page-block-assignments`, `page-composition-and-seo` | I |
| `/admin/pages-blocks/pages` | J07 | `src/app/admin/pages-blocks/pages/page.tsx` | `pages`, `pages-quick-create` | I |
| `/admin/projects/[id]` | J04 | `src/app/admin/projects/[id]/page.tsx` | `project-editor-pages`, `projects-create-edit` | I |
| `/admin/projects/[id]/preview` | J04 | `src/app/admin/projects/[id]/preview/page.tsx` | `project-editor-pages` | I |
| `/admin/projects/[id]/tracking/items/[itemId]` | J06 | `src/app/admin/projects/[id]/tracking/items/[itemId]/page.tsx` | `project-construction-tracking`, `project-tracking-create-edit` | I |
| `/admin/projects/[id]/tracking` | J06 | `src/app/admin/projects/[id]/tracking/page.tsx` | `project-construction-tracking`, `project-tracking-create-edit` | I |
| `/admin/projects/[id]/tracking/stages/[stageId]` | J06 | `src/app/admin/projects/[id]/tracking/stages/[stageId]/page.tsx` | `project-construction-tracking`, `project-tracking-create-edit` | I |
| `/admin/projects/commercial` | J04 | `src/app/admin/projects/commercial/page.tsx` | `projects-residential-commercial` | I |
| `/admin/projects/construction-updates` | J06 | `src/app/admin/projects/construction-updates/page.tsx` | `construction-updates-hub` | I |
| `/admin/projects/locations/cities` | J05 | `src/app/admin/projects/locations/cities/page.tsx` | `project-locations`, `project-locations-create-edit` | I |
| `/admin/projects/locations/districts` | J05 | `src/app/admin/projects/locations/districts/page.tsx` | `project-locations`, `project-locations-create-edit` | I |
| `/admin/projects/locations/governorates` | J05 | `src/app/admin/projects/locations/governorates/page.tsx` | `project-locations`, `project-locations-create-edit` | I |
| `/admin/projects/locations` | J05 | `src/app/admin/projects/locations/page.tsx` | `project-locations-hub` | I |
| `/admin/projects/locations/sub-districts` | J05 | `src/app/admin/projects/locations/sub-districts/page.tsx` | `project-locations`, `project-locations-create-edit` | I |
| `/admin/projects/new` | J04 | `src/app/admin/projects/new/page.tsx` | `project-editor-pages`, `projects-create-edit` | I |
| `/admin/projects` | J04 | `src/app/admin/projects/page.tsx` | `projects-hub` | I |
| `/admin/projects/residential` | J04 | `src/app/admin/projects/residential/page.tsx` | `projects-residential-commercial` | I |
| `/admin/reports/[report]` | J17 | `src/app/admin/reports/[report]/page.tsx` | `reports-hub` | I |
| `/admin/reports` | J17 | `src/app/admin/reports/page.tsx` | `reports-hub` | I |
| `/admin/reports/topics-without-image` | J17 | `src/app/admin/reports/topics-without-image/page.tsx` | `topics-without-image-report` | I |
| `/admin/seo/meta-manager` | J13 | `src/app/admin/seo/meta-manager/page.tsx` | `seo-meta-manager`, `global-seo-settings` | I |
| `/admin/seo/redirects` | J12 | `src/app/admin/seo/redirects/page.tsx` | `seo-redirects`, `redirects-create-edit` | I |
| `/admin/seo/sitemap` | J14 | `src/app/admin/seo/sitemap/page.tsx` | `sitemap-monitor` | I |
| `/admin/settings/appearance` | J20, J21, J22, J23 | `src/app/admin/settings/appearance/page.tsx` | `settings-pages` | I |
| `/admin/settings/general` | J20, J21, J22, J23 | `src/app/admin/settings/general/page.tsx` | `settings-pages`, `company-identity-settings`, `maintenance-immediate-setting` | I |
| `/admin/settings/integrations/[integration]` | J18, J19 | `src/app/admin/settings/integrations/[integration]/page.tsx` | `settings-pages` | I |
| `/admin/settings/integrations` | J18, J19 | `src/app/admin/settings/integrations/page.tsx` | `settings-pages` | I |
| `/admin/settings/integrations/server-configuration` | J18, J19 | `src/app/admin/settings/integrations/server-configuration/page.tsx` | `settings-pages`, `integrations-server-configuration` | I |
| `/admin/settings/media` | J20, J21, J22, J23 | `src/app/admin/settings/media/page.tsx` | `media-recovery-queue`, `settings-pages`, `media-library-settings` | I |
| `/admin/settings/security` | J20, J21, J22, J23 | `src/app/admin/settings/security/page.tsx` | `settings-pages`, `security-settings` | I |
| `/admin/settings/theme` | J20, J21, J22, J23 | `src/app/admin/settings/theme/page.tsx` | `settings-pages` | I |
| `/admin/users-roles` | J15 | `src/app/admin/users-roles/page.tsx` | `users-and-roles`, `users-create-edit`, `users-and-roles` | I |

Route renderer imports and direct data-owner imports are preserved in `routeOwnerDetails` in the source appendix. Shared atomic/Media-command manifest registrations are excluded from the route table for readability and retained in JSON. Preview routes remain in the inventory; their route presentation is separate from the entity editor.

## Every registered Form surface

| Manifest ID | Actual surfaces | Classification already declared | Existing source owner |
|---|---|---|---|
| `topic-article-create-edit` | create, edit | shared_reference | `src/components/admin/content/editors/ArticleCreateEditor.tsx`, `src/components/admin/content/editors/ArticleEditor.tsx` |
| `topic-category-create-edit` | create, edit | shared_reference | `src/app/admin/content/categories/CategoryForm.tsx` |
| `topic-series-create-edit` | create, edit | shared_reference | `src/app/admin/content/series/SeriesForm.tsx` |
| `topic-media-create-edit` | news:create, news:edit, press:create, press:edit, site_update:create, site_update:edit, video:create, video:edit, gallery:create, gallery:edit | shared_adopter | `src/components/admin/content/editors/media/MediaContentForm.tsx` |
| `projects-create-edit` | residential:create, residential:edit, commercial:create, commercial:edit | shared_adopter | `src/app/admin/projects/ProjectEditForm.tsx`, `src/components/admin/projects/ProjectPublishChecklistPanel.tsx` |
| `project-locations-create-edit` | governorate:create, governorate:edit, city:create, city:edit, district:create, district:edit, sub-district:create, sub-district:edit | shared_adopter | `src/app/admin/projects/locations/ProjectLocationFormModal.tsx` |
| `project-tracking-create-edit` | tracking-profile, stage-create, stage-edit, item-create, item-edit, update-create, update-edit | shared_adopter | `src/components/admin/projects/tracking/TrackingForms.tsx`, `src/components/admin/projects/tracking/TrackingVideoFields.tsx` |
| `pages-quick-create` | create | shared_adopter | `src/app/admin/pages-blocks/pages/CreatePageModal.tsx` |
| `redirects-create-edit` | create, edit | shared_adopter | `src/app/admin/seo/redirects/RedirectFormModal.tsx` |
| `page-composition-and-seo` | composition, assignment, seo | specialized_exception | `src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx`, `src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksAssignModal.tsx`, `src/app/admin/pages-blocks/pages/[id]/PageSeoPanel.tsx` |
| `block-template-create-modals` | content:create, hero:create, breadcrumb:create, cards:create, cta:create, feed:create, featured:create | shared_adopter | `src/components/admin/page-blocks/BlockModuleManagerClient.tsx`, `src/app/admin/pages-blocks/blocks/content/ContentBlocksTableClient.tsx`, `src/app/admin/pages-blocks/blocks/hero/HeroManagerClient.tsx` |
| `block-template-hero-editor` | hero:template-edit, hero:template-command | specialized_exception | `src/app/admin/pages-blocks/blocks/hero/[id]/page.tsx` |
| `block-template-content-editor` | content:template-edit, content:template-command | specialized_exception | `src/app/admin/pages-blocks/blocks/content/[id]/page.tsx` |
| `block-template-cta-editor` | cta:template-edit, cta:template-command | specialized_exception | `src/app/admin/pages-blocks/blocks/cta/[id]/page.tsx` |
| `block-template-cards-editor` | cards:template-edit, cards:template-command | specialized_exception | `src/app/admin/pages-blocks/blocks/cards/[id]/page.tsx` |
| `block-template-breadcrumb-editor` | breadcrumb:template-edit, breadcrumb:template-command | specialized_exception | `src/app/admin/pages-blocks/blocks/breadcrumb/[id]/page.tsx` |
| `block-template-feed-editor` | feed:template-edit, feed:template-command | specialized_exception | `src/app/admin/pages-blocks/blocks/feed/[id]/page.tsx` |
| `block-template-featured-editor` | featured:template-edit, featured:template-command | specialized_exception | `src/app/admin/pages-blocks/blocks/featured/[id]/page.tsx` |
| `block-template-media-sidebar-editor` | media-sidebar:template-edit, media-sidebar:template-command | specialized_exception | `src/app/admin/pages-blocks/blocks/media-sidebar/[id]/page.tsx` |
| `block-template-media-hub-editor` | media-hub:template-edit, media-hub:template-command | specialized_exception | `src/app/admin/pages-blocks/blocks/media-hub/[id]/page.tsx` |
| `menu-quick-create` | menu-create | shared_adopter | `src/app/admin/pages-blocks/menus/AddMenuPanelClient.tsx` |
| `menu-builder` | menu-edit, item-edit, ordering, row-command | specialized_exception | `src/app/admin/pages-blocks/menus/MenuBuilderClient.tsx`, `src/app/admin/pages-blocks/menus/MenuItemForm.tsx`, `src/app/admin/pages-blocks/menus/MenuItemsTableClient.tsx`, `src/app/admin/pages-blocks/menus/MenusTableClient.tsx` |
| `footer-builder` | footer-compose, footer-link-edit, ordering | specialized_exception | `src/app/admin/pages-blocks/footer/FooterBuilderClient.tsx`, `src/app/admin/pages-blocks/footer/FooterLinksDataGrid.tsx` |
| `global-seo-settings` | global-meta | specialized_exception | `src/app/admin/seo/meta-manager/MetaManagerClient.tsx` |
| `company-identity-settings` | singleton-settings | shared_adopter | `src/app/admin/settings/general/CompanyIdentityPanel.tsx` |
| `media-library-settings` | media-policy-settings | specialized_exception | `src/app/admin/settings/media/MediaSettingsPanel.tsx` |
| `security-settings` | password, session, security-policy | specialized_exception | `src/app/admin/settings/security/SecuritySettingsClient.tsx` |
| `integrations-server-configuration` | provider-app-credentials, vault-replacement, configuration-test | specialized_exception | `src/components/admin/integrations/IntegrationsServerConfiguration.tsx` |
| `users-create-edit` | user-create, user-edit | shared_adopter | `src/app/admin/users-roles/AdminUserFormModal.tsx` |
| `users-and-roles` | identity-collection, status-command, delete-command | specialized_exception | `src/app/admin/users-roles/UsersManagementClient.tsx` |
| `maintenance-immediate-setting` | immediate-toggle | explicit_exception | `src/app/admin/settings/general/MaintenanceModePanel.tsx` |
| `authentication-login` | admin-login, maintenance-login | explicit_exception | `src/app/admin/(auth)/login/AdminLoginForm.tsx`, `src/app/maintenance/MaintenanceLoginForm.tsx` |
| `list-bulk-row-one-shot-actions` | bulk-command, row-command, duplicate-command | explicit_exception | `src/components/admin/ui/AdminBulkActionBar.tsx`, `src/components/admin/ui/AdminDataGridRowActions.tsx`, `src/components/admin/ui/AdminDuplicateResourceModal.tsx`, `src/components/admin/AdminRowActions.tsx`, `src/app/admin/pages-blocks/pages/PagesTableClient.tsx`, `src/app/admin/seo/redirects/RedirectsClient.tsx`, `src/components/admin/content/TopicsListClient.tsx`, `src/components/admin/content/UnifiedContentList.tsx`, `src/components/admin/content/UnifiedContentRowActions.tsx`, `src/app/admin/pages-blocks/blocks/BlockTemplateSummaryListClient.tsx` |
| `activity-sitemap-media-commands` | activity-query, sitemap-check, media-command, media-usage | explicit_exception | `src/app/admin/activity-log/ActivityLogClient.tsx`, `src/app/admin/seo/sitemap/SitemapMonitorClient.tsx`, `src/components/admin/media/AdminMediaPickerModal.tsx`, `src/components/admin/media/MediaLibraryCore.tsx`, `src/components/admin/media-intelligence/AdminMediaLibraryClient.tsx`, `src/components/admin/media-intelligence/MediaUsagePanel.tsx`, `src/app/admin/reports/topics-without-image/TopicsWithoutImageReportClient.tsx` |

This is existing capability adoption, not proof of performance. Page composition, menu/footer builders, specialized module editors, Security, Integrations, Media commands and atomic row/bulk actions retain their existing explicitly scoped ownership.

## Every nested owner containing interactive callsites

Each row retains all callsite IDs, source line numbers, JSX tag, handler/action/href expressions, route reachability, direct data imports, manifest bindings and tabs in JSON. Generic reusable owners appear once here and carry their complete caller-route list there; this avoids disguising one shared control as dozens of independent implementations.

| Source owner | Callsites | Roles | Declared tabs | Direct registered consumers | Performance class |
|---|---:|---|---|---|---|
| `src/app/admin/(auth)/forgot-password/page.tsx` | 1 | navigation |  | admin-auth-pages | I |
| `src/app/admin/(auth)/login/AdminLoginForm.tsx` | 6 | mutation-form, field-input, interactive-control, navigation |  | authentication-login | I |
| `src/app/admin/activity-log/ActivityLogClient.tsx` | 2 | interactive-control, pagination |  | activity-sitemap-media-commands, activity-log | I |
| `src/app/admin/content/TaxonomyExpectedRevisionInput.tsx` | 1 | field-input |  |  | I |
| `src/app/admin/content/categories/CategoriesListClient.tsx` | 2 | interactive-control, pagination |  | content-categories | B |
| `src/app/admin/content/categories/CategoryForm.tsx` | 5 | mutation-form, field-input, reference-picker |  | topic-category-create-edit, content-editor-pages | B |
| `src/app/admin/content/categories/CategoryRowActions.tsx` | 1 | row-bulk-actions |  |  | B |
| `src/app/admin/content/categories/[id]/page.tsx` | 3 | navigation |  | content-editor-pages | C |
| `src/app/admin/content/categories/categories-columns.tsx` | 4 | interactive-control, navigation, row-bulk-actions |  |  | B |
| `src/app/admin/content/categories/new/page.tsx` | 3 | navigation |  | content-editor-pages | I |
| `src/app/admin/content/categories/page.tsx` | 4 | navigation |  | content-categories | I |
| `src/app/admin/content/series/SeriesForm.tsx` | 4 | mutation-form, field-input, reference-picker |  | topic-series-create-edit, content-editor-pages | B |
| `src/app/admin/content/series/SeriesTableClient.tsx` | 2 | interactive-control, pagination |  | content-series | B |
| `src/app/admin/content/series/[id]/page.tsx` | 3 | navigation |  | content-editor-pages | C |
| `src/app/admin/content/series/new/page.tsx` | 3 | navigation |  | content-editor-pages | I |
| `src/app/admin/content/series/page.tsx` | 4 | navigation |  | content-series | I |
| `src/app/admin/content/series/series-columns.tsx` | 4 | row-bulk-actions, navigation |  |  | B |
| `src/app/admin/content/topics/[id]/page.tsx` | 3 | navigation | topic.id | content-editor-pages | C |
| `src/app/admin/content/topics/[id]/preview/page.tsx` | 1 | navigation |  | content-editor-pages | I |
| `src/app/admin/content/topics/new/page.tsx` | 4 | interactive-control, navigation |  | content-editor-pages | I |
| `src/app/admin/content/topics/page.tsx` | 4 | navigation |  | content-topics | I |
| `src/app/admin/pages-blocks/blocks/BlockTemplateSummaryListClient.tsx` | 12 | interactive-control, row-bulk-actions, navigation, pagination |  | list-bulk-row-one-shot-actions, block-template-libraries | I |
| `src/app/admin/pages-blocks/blocks/content/ContentBlocksTableClient.tsx` | 18 | interactive-control, row-bulk-actions, navigation, pagination, modal-drawer, mutation-form, field-input, reference-picker |  | block-template-create-modals, block-template-libraries | I |
| `src/app/admin/pages-blocks/blocks/hero/HeroManagerClient.tsx` | 22 | interactive-control, row-bulk-actions, navigation, pagination, modal-drawer, mutation-form, field-input, reference-picker |  | block-template-create-modals, block-template-libraries | I |
| `src/app/admin/pages-blocks/blocks/hero/[id]/HeroCtaFields.tsx` | 3 | field-input |  |  | I |
| `src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx` | 11 | field-input, reference-picker, interactive-control, tabs-sections | "content", "buttons", "media", "order", "display" |  | I |
| `src/app/admin/pages-blocks/blocks/hero/[id]/HeroElementOrderEditor.tsx` | 6 | field-input, interactive-control |  |  | I |
| `src/app/admin/pages-blocks/blocks/hero/[id]/HeroTextFieldRow.tsx` | 1 | field-input |  |  | I |
| `src/app/admin/pages-blocks/blocks/page.tsx` | 2 | navigation |  | blocks-library-hub | I |
| `src/app/admin/pages-blocks/footer/FooterBuilderClient.tsx` | 8 | interactive-control, tabs-sections | "overview", `column-${index}`, "contact-data", "social-legal" | footer-builder, footer-builder-shell | I |
| `src/app/admin/pages-blocks/footer/FooterBuilderEditors.tsx` | 16 | interactive-control, field-input, reference-picker |  | footer-fixed-slots | I |
| `src/app/admin/pages-blocks/footer/FooterLinksDataGrid.tsx` | 11 | interactive-control, row-bulk-actions, pagination, modal-drawer, field-input, reference-picker |  | footer-builder, footer-manual-links | I |
| `src/app/admin/pages-blocks/footer/FooterMenuPreviewDataGrid.tsx` | 4 | navigation |  | footer-fixed-slots | I |
| `src/app/admin/pages-blocks/footer/FooterSlotConfigFields.tsx` | 28 | interactive-control, reference-picker, field-input, navigation |  |  | I |
| `src/app/admin/pages-blocks/footer/FooterSlotEditorCard.tsx` | 7 | field-input, reference-picker, interactive-control |  |  | I |
| `src/app/admin/pages-blocks/menus/AddMenuPanelClient.tsx` | 7 | interactive-control, modal-drawer, mutation-form, field-input, reference-picker |  | menu-quick-create | I |
| `src/app/admin/pages-blocks/menus/MenuBuilderClient.tsx` | 8 | mutation-form, field-input, reference-picker, interactive-control, tabs-sections | "items", "menu-settings", "add-item" | menu-builder, menu-editor-shell | I |
| `src/app/admin/pages-blocks/menus/MenuItemForm.tsx` | 9 | mutation-form, field-input, reference-picker, interactive-control |  | menu-builder | I |
| `src/app/admin/pages-blocks/menus/MenuItemLinkSection.tsx` | 1 | field-input |  |  | I |
| `src/app/admin/pages-blocks/menus/MenuItemsTableClient.tsx` | 9 | navigation, interactive-control, row-bulk-actions, pagination, modal-drawer, mutation-form |  | menu-builder, menu-items | I |
| `src/app/admin/pages-blocks/menus/MenusTableClient.tsx` | 7 | interactive-control, row-bulk-actions, navigation, pagination |  | menu-builder, menus-list | I |
| `src/app/admin/pages-blocks/menus/[id]/page.tsx` | 1 | navigation |  | menu-editor-shell, menu-items | I |
| `src/app/admin/pages-blocks/pages/CreatePageModal.tsx` | 7 | interactive-control, modal-drawer, mutation-form, field-input |  | pages-quick-create | I |
| `src/app/admin/pages-blocks/pages/PagesTableClient.tsx` | 7 | row-bulk-actions, navigation, modal-drawer, interactive-control, pagination |  | list-bulk-row-one-shot-actions, pages | I |
| `src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx` | 5 | tabs-sections, interactive-control, row-bulk-actions, pagination, modal-drawer | "seo", "map", "modules" | page-composition-and-seo, page-block-assignments | I |
| `src/app/admin/pages-blocks/pages/[id]/PageSeoPanel.tsx` | 10 | mutation-form, field-input, interactive-control |  | page-composition-and-seo | I |
| `src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksAssignModal.tsx` | 14 | modal-drawer, mutation-form, field-input, reference-picker, navigation |  | page-composition-and-seo | I |
| `src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksAssignmentRow.tsx` | 5 | interactive-control, navigation, reference-picker, row-bulk-actions |  | page-block-assignments | I |
| `src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksAssignmentsGrid.tsx` | 1 | interactive-control |  | page-block-assignments | I |
| `src/app/admin/pages-blocks/pages/[id]/page-blocks/PageBlocksHeader.tsx` | 5 | navigation, interactive-control |  | page-composition-shell | I |
| `src/app/admin/projects/AddProjectPanelClient.tsx` | 1 | navigation |  |  | I |
| `src/app/admin/projects/ProjectEditForm.tsx` | 20 | field-input, reference-picker, interactive-control, mutation-form, tabs-sections | PROJECT_ENTRY_TAB_IDS.basic, PROJECT_ENTRY_TAB_IDS.location, PROJECT_ENTRY_TAB_IDS.overview, PROJECT_ENTRY_TAB_IDS.plans, PROJECT_ENTRY_TAB_IDS.delivery, PROJECT_ENTRY_TAB_IDS.media, PROJECT_ENTRY_TAB_IDS.seo, PROJECT_ENTRY_TAB_IDS.review | projects-create-edit, project-editor-pages | B |
| `src/app/admin/projects/ProjectsTableClient.tsx` | 2 | interactive-control, pagination |  | projects-residential-commercial | B |
| `src/app/admin/projects/[id]/page.tsx` | 3 | navigation |  | project-editor-pages | B |
| `src/app/admin/projects/[id]/preview/page.tsx` | 1 | navigation |  | project-editor-pages | I |
| `src/app/admin/projects/commercial/page.tsx` | 1 | navigation |  | projects-residential-commercial | I |
| `src/app/admin/projects/construction-updates/page.tsx` | 3 | navigation, mutation-form |  | construction-updates-hub | I |
| `src/app/admin/projects/locations/ProjectLocationFormModal.tsx` | 10 | modal-drawer, mutation-form, field-input, reference-picker |  | project-locations-create-edit | I |
| `src/app/admin/projects/locations/ProjectLocationsManagementClient.tsx` | 8 | row-bulk-actions, navigation, interactive-control, pagination, modal-drawer |  | project-locations | I |
| `src/app/admin/projects/locations/page.tsx` | 1 | navigation |  | project-locations-hub | I |
| `src/app/admin/projects/new/page.tsx` | 1 | navigation |  | project-editor-pages | I |
| `src/app/admin/projects/page.tsx` | 2 | navigation |  | projects-hub | I |
| `src/app/admin/projects/projects-table/ProjectsHubCard.tsx` | 1 | navigation |  | projects-hub | I |
| `src/app/admin/projects/projects-table/ReferenceProjectsTable.tsx` | 5 | row-bulk-actions, navigation |  |  | B |
| `src/app/admin/projects/residential/page.tsx` | 2 | navigation |  | projects-residential-commercial | I |
| `src/app/admin/reports/topics-without-image/TopicsWithoutImageReportClient.tsx` | 4 | navigation, row-bulk-actions, interactive-control, pagination |  | activity-sitemap-media-commands, topics-without-image-report | I |
| `src/app/admin/seo/meta-manager/MetaManagerClient.tsx` | 10 | field-input, reference-picker, mutation-form, tabs-sections | "defaults", "identity", "crawl", "preview" | global-seo-settings, seo-meta-manager | I |
| `src/app/admin/seo/redirects/RedirectFormModal.tsx` | 10 | modal-drawer, mutation-form, field-input, reference-picker |  | redirects-create-edit | I |
| `src/app/admin/seo/redirects/RedirectsClient.tsx` | 7 | row-bulk-actions, interactive-control, pagination, modal-drawer |  | list-bulk-row-one-shot-actions, seo-redirects | I |
| `src/app/admin/seo/sitemap/SitemapMonitorClient.tsx` | 2 | interactive-control, navigation |  | activity-sitemap-media-commands, sitemap-monitor | I |
| `src/app/admin/settings/general/CompanyIdentityPanel.tsx` | 5 | mutation-form, field-input, reference-picker |  | company-identity-settings, settings-pages | I |
| `src/app/admin/settings/general/MaintenanceModePanel.tsx` | 2 | interactive-control |  | maintenance-immediate-setting, settings-pages | I |
| `src/app/admin/settings/media/MediaRecoveryCenter.tsx` | 2 | interactive-control |  | media-recovery-queue | I |
| `src/app/admin/settings/media/MediaSettingsPanel.tsx` | 9 | interactive-control, mutation-form, field-input |  | media-library-settings, settings-pages | I |
| `src/app/admin/settings/security/SecuritySettingsClient.tsx` | 14 | mutation-form, field-input, interactive-control, tabs-sections | "password", "account", "sessions" | security-settings, settings-pages | I |
| `src/app/admin/users-roles/AdminUserFormModal.tsx` | 12 | modal-drawer, mutation-form, field-input |  | users-create-edit | I |
| `src/app/admin/users-roles/UsersManagementClient.tsx` | 6 | row-bulk-actions, interactive-control, pagination, modal-drawer |  | users-and-roles, users-and-roles | I |
| `src/components/admin/AdminNotice.tsx` | 2 | navigation |  |  | I |
| `src/components/admin/AdminNoticeDismissibleFrame.tsx` | 1 | interactive-control |  |  | I |
| `src/components/admin/AdminPlaceholderPage.tsx` | 2 | navigation |  | settings-pages | I |
| `src/components/admin/AdminRichTextEditor.tsx` | 14 | interactive-control, field-input |  |  | I |
| `src/components/admin/AdminRowActions.tsx` | 4 | field-input, navigation, mutation-form, interactive-control |  | list-bulk-row-one-shot-actions | I |
| `src/components/admin/AdminShell.tsx` | 9 | navigation, interactive-control |  |  | I |
| `src/components/admin/AdminTagsField.tsx` | 5 | field-input, interactive-control |  |  | I |
| `src/components/admin/VenesiaModal.tsx` | 2 | interactive-control |  |  | I |
| `src/components/admin/content-workflow/ContentTemplatePicker.tsx` | 2 | reference-picker, interactive-control |  |  | I |
| `src/components/admin/content/CategoryColorPicker.tsx` | 3 | field-input, interactive-control |  |  | I |
| `src/components/admin/content/TopicsListClient.tsx` | 2 | interactive-control, pagination |  | list-bulk-row-one-shot-actions, content-topics | I |
| `src/components/admin/content/UnifiedContentList.tsx` | 2 | interactive-control, reference-picker |  | list-bulk-row-one-shot-actions, content-topics | I |
| `src/components/admin/content/UnifiedContentRowActions.tsx` | 1 | row-bulk-actions |  | list-bulk-row-one-shot-actions | I |
| `src/components/admin/content/editors/ArticleCreateEditor.tsx` | 5 | interactive-control, navigation, mutation-form | "basic", "faq", "seo", "publish" | topic-article-create-edit, content-editor-pages | I |
| `src/components/admin/content/editors/ArticleEditor.tsx` | 5 | interactive-control, navigation, mutation-form | "basic", "faq", "seo", "publish" | topic-article-create-edit, content-editor-pages | I |
| `src/components/admin/content/editors/ContentBasicDataPanel.tsx` | 4 | reference-picker, interactive-control |  |  | I |
| `src/components/admin/content/editors/ContentCategorySelect.tsx` | 1 | reference-picker |  |  | I |
| `src/components/admin/content/editors/ContentEditorShell.tsx` | 9 | mutation-form, field-input, reference-picker, tabs-sections, interactive-control | tab.id |  | I |
| `src/components/admin/content/editors/ContentPublishingOptions.tsx` | 2 | field-input |  |  | I |
| `src/components/admin/content/editors/TopicContentTypeControl.tsx` | 1 | reference-picker |  |  | I |
| `src/components/admin/content/editors/article/FaqEditor.tsx` | 13 | field-input, interactive-control |  |  | I |
| `src/components/admin/content/editors/article/TopicCharacterField.tsx` | 2 | field-input |  |  | I |
| `src/components/admin/content/editors/article/TopicDateLabelField.tsx` | 3 | interactive-control, reference-picker, field-input |  |  | I |
| `src/components/admin/content/editors/article/TopicImageField.tsx` | 2 | reference-picker, field-input |  |  | I |
| `src/components/admin/content/editors/article/TopicMarkdownEditor.tsx` | 3 | interactive-control |  |  | I |
| `src/components/admin/content/editors/article/TopicSeriesFields.tsx` | 3 | reference-picker, field-input |  |  | I |
| `src/components/admin/content/editors/article/TopicSlugInput.tsx` | 2 | field-input, interactive-control |  |  | I |
| `src/components/admin/content/editors/media/MediaContentForm.tsx` | 7 | field-input, reference-picker, interactive-control, mutation-form | "basic", "seo", "publish" | topic-media-create-edit | I |
| `src/components/admin/content/editors/media/MediaVideoFields.tsx` | 5 | field-input, reference-picker |  |  | I |
| `src/components/admin/content/unified-content-columns.tsx` | 4 | navigation, row-bulk-actions |  |  | I |
| `src/components/admin/dashboard/AdminDashboardView.tsx` | 5 | navigation, row-bulk-actions |  | dashboard-recent-content | I |
| `src/components/admin/entity-list/AdminEntityList.tsx` | 4 | interactive-control, row-bulk-actions, reference-picker |  |  | I |
| `src/components/admin/entity-list/AdminEntityListFilters.tsx` | 15 | interactive-control, reference-picker, field-input, modal-drawer |  |  | I |
| `src/components/admin/entity-list/AdminEntityListTable.tsx` | 4 | navigation, interactive-control |  |  | I |
| `src/components/admin/entity-list/AdminEntityTrashHeader.tsx` | 1 | interactive-control |  |  | I |
| `src/components/admin/integrations/AdminIntegrationsPlatform.tsx` | 15 | interactive-control, navigation, field-input, reference-picker |  | settings-pages | I |
| `src/components/admin/integrations/IntegrationConnectionWizard.tsx` | 11 | navigation, reference-picker, interactive-control |  | settings-pages | I |
| `src/components/admin/integrations/IntegrationsServerConfiguration.tsx` | 11 | navigation, mutation-form, field-input, interactive-control |  | integrations-server-configuration, settings-pages | I |
| `src/components/admin/media-intelligence/MediaUsagePanel.tsx` | 1 | navigation |  | activity-sitemap-media-commands | I |
| `src/components/admin/media/AdminMediaGalleryField.tsx` | 11 | field-input, interactive-control, reference-picker |  |  | I |
| `src/components/admin/media/AdminMediaImageField.tsx` | 12 | field-input, interactive-control, reference-picker |  |  | I |
| `src/components/admin/media/AdminMediaPickerModal.tsx` | 1 | modal-drawer |  | activity-sitemap-media-commands | I |
| `src/components/admin/media/MediaLibraryCore.tsx` | 41 | navigation, interactive-control, field-input, pagination, mutation-form |  | activity-sitemap-media-commands, media-library | I |
| `src/components/admin/page-blocks/BlockEditorContextHeader.tsx` | 1 | navigation |  |  | I |
| `src/components/admin/page-blocks/BlockModuleManagerClient.tsx` | 26 | interactive-control, row-bulk-actions, navigation, pagination, modal-drawer, mutation-form, field-input, reference-picker |  | block-template-create-modals, block-template-libraries | I |
| `src/components/admin/page-blocks/BreadcrumbModuleEditClient.tsx` | 7 | mutation-form, field-input, tabs-sections, reference-picker | "content", "pages" |  | I |
| `src/components/admin/page-blocks/CardsModuleEditClient.tsx` | 10 | mutation-form, field-input, reference-picker, tabs-sections | "content", "pages" |  | I |
| `src/components/admin/page-blocks/CollectionModuleFields.tsx` | 9 | field-input, reference-picker |  |  | I |
| `src/components/admin/page-blocks/ContentModuleEditClient.tsx` | 49 | navigation, interactive-control, field-input, tabs-sections | "pages", "content", "buttons", "order", "details", "display", "text", "images", "cta", "text", "image", "cta", "contacts", "text", "image", "cta", "contacts", "content" |  | I |
| `src/components/admin/page-blocks/CtaModuleEditClient.tsx` | 13 | mutation-form, field-input, reference-picker, tabs-sections | "content", "pages" |  | I |
| `src/components/admin/page-blocks/FeaturedModuleEditClient.tsx` | 23 | field-input, mutation-form, tabs-sections, reference-picker, interactive-control | "content", "presentation", "pages" |  | I |
| `src/components/admin/page-blocks/FeedModuleEditClient.tsx` | 10 | mutation-form, field-input, reference-picker, tabs-sections | "content", "pages" |  | I |
| `src/components/admin/page-blocks/FeedModuleFilterFields.tsx` | 3 | field-input, interactive-control |  |  | I |
| `src/components/admin/page-blocks/MediaHubModuleEditClient.tsx` | 29 | field-input, mutation-form, reference-picker, tabs-sections | "content", "presentation", "pages" |  | I |
| `src/components/admin/page-blocks/MediaSidebarModuleEditClient.tsx` | 10 | mutation-form, field-input, tabs-sections, reference-picker | "content", "pages" |  | I |
| `src/components/admin/page-blocks/ModuleCrossPageUsageBanner.tsx` | 1 | navigation |  |  | I |
| `src/components/admin/page-blocks/ModuleEditorPresentation.tsx` | 8 | tabs-sections, field-input, interactive-control |  |  | I |
| `src/components/admin/page-blocks/ModulePageAssignmentsField.tsx` | 1 | navigation |  |  | I |
| `src/components/admin/page-blocks/PageVisualSlotMap.tsx` | 2 | navigation |  |  | I |
| `src/components/admin/page-blocks/editors/AboutApproachModuleEditor.tsx` | 2 | field-input |  |  | I |
| `src/components/admin/page-blocks/editors/AboutCtaModuleEditor.tsx` | 13 | field-input, reference-picker, interactive-control |  |  | I |
| `src/components/admin/page-blocks/editors/AboutIntroModuleEditor.tsx` | 23 | field-input, interactive-control, reference-picker |  |  | I |
| `src/components/admin/page-blocks/editors/AboutIntroSingleImageModuleEditor.tsx` | 9 | field-input, reference-picker, interactive-control |  |  | I |
| `src/components/admin/page-blocks/editors/AboutPrinciplesModuleEditor.tsx` | 15 | field-input, interactive-control, reference-picker |  |  | I |
| `src/components/admin/page-blocks/editors/AdminCardsItemsField.tsx` | 7 | interactive-control, field-input |  |  | I |
| `src/components/admin/page-blocks/editors/BreadcrumbManualItemsField.tsx` | 5 | interactive-control, field-input |  |  | I |
| `src/components/admin/page-blocks/editors/CollectionModuleEditor.tsx` | 6 | field-input, reference-picker |  |  | I |
| `src/components/admin/page-blocks/editors/GenericContentModuleEditor.tsx` | 3 | field-input |  |  | I |
| `src/components/admin/page-blocks/editors/HomeProjectsPlacementEditor.tsx` | 7 | field-input, reference-picker |  |  | I |
| `src/components/admin/page-blocks/editors/ProjectsHubFeaturedModuleEditor.tsx` | 6 | field-input, reference-picker |  |  | I |
| `src/components/admin/page-blocks/editors/ProjectsHubHeroModuleEditor.tsx` | 8 | field-input, reference-picker |  |  | I |
| `src/components/admin/page-blocks/editors/ProjectsHubListingModuleEditor.tsx` | 7 | field-input, reference-picker |  |  | I |
| `src/components/admin/page-blocks/editors/ProjectsHubMapModuleEditor.tsx` | 13 | field-input, reference-picker, interactive-control |  |  | I |
| `src/components/admin/page-blocks/editors/SearchPlatformModuleEditor.tsx` | 5 | field-input, reference-picker |  |  | I |
| `src/components/admin/page-blocks/editors/VisionGoalsModuleEditor.tsx` | 11 | field-input, reference-picker |  |  | I |
| `src/components/admin/projects/entry/ProjectLocationEditor.tsx` | 12 | reference-picker, field-input, interactive-control, navigation |  |  | I |
| `src/components/admin/projects/entry/ProjectMediaEditors.tsx` | 20 | interactive-control, field-input, reference-picker, navigation |  |  | I |
| `src/components/admin/projects/entry/ProjectRepeaters.tsx` | 39 | interactive-control, field-input, reference-picker |  |  | I |
| `src/components/admin/projects/tracking/TrackingCollections.tsx` | 32 | interactive-control, pagination, navigation, row-bulk-actions, modal-drawer |  | project-construction-tracking | I |
| `src/components/admin/projects/tracking/TrackingForms.tsx` | 40 | modal-drawer, mutation-form, field-input, reference-picker |  | project-tracking-create-edit | I |
| `src/components/admin/projects/tracking/TrackingSchemaUnavailable.tsx` | 1 | navigation |  |  | I |
| `src/components/admin/projects/tracking/TrackingVideoFields.tsx` | 6 | field-input, interactive-control, reference-picker |  | project-tracking-create-edit | I |
| `src/components/admin/reports/AdminReportActions.tsx` | 2 | navigation, interactive-control |  | reports-hub | I |
| `src/components/admin/reports/AdminReportDetailView.tsx` | 9 | navigation |  | reports-hub | I |
| `src/components/admin/reports/AdminReportsView.tsx` | 8 | navigation |  | reports-hub | I |
| `src/components/admin/review/AdminEntityReviewPanel.tsx` | 3 | interactive-control |  |  | I |
| `src/components/admin/seo/AdminEntitySeoPanel.tsx` | 12 | interactive-control, field-input, tabs-sections, reference-picker | "search-result-preview", "open-graph-preview", "live-seo-analysis" |  | I |
| `src/components/admin/ui/AdminActionButton.tsx` | 2 | navigation, interactive-control |  |  | I |
| `src/components/admin/ui/AdminActivityPopover.tsx` | 1 | mutation-form |  |  | I |
| `src/components/admin/ui/AdminBulkActionBar.tsx` | 8 | mutation-form, field-input, reference-picker, interactive-control, row-bulk-actions |  | list-bulk-row-one-shot-actions | I |
| `src/components/admin/ui/AdminCheckbox.tsx` | 1 | field-input |  |  | I |
| `src/components/admin/ui/AdminColumnVisibilityMenu.tsx` | 3 | interactive-control |  |  | I |
| `src/components/admin/ui/AdminConfirmDialog.tsx` | 3 | interactive-control, modal-drawer |  |  | I |
| `src/components/admin/ui/AdminDataGrid.tsx` | 7 | interactive-control, navigation, mutation-form |  |  | I |
| `src/components/admin/ui/AdminDataGridRowActions.tsx` | 7 | mutation-form, navigation, interactive-control |  | list-bulk-row-one-shot-actions | I |
| `src/components/admin/ui/AdminDatePicker.tsx` | 1 | field-input |  |  | I |
| `src/components/admin/ui/AdminEntityPreviewActions.tsx` | 2 | navigation |  |  | I |
| `src/components/admin/ui/AdminFormListboxSelect.tsx` | 2 | interactive-control, reference-picker |  |  | I |
| `src/components/admin/ui/AdminFormRuntime.tsx` | 5 | interactive-control, mutation-form |  |  | I |
| `src/components/admin/ui/AdminFormSwitch.tsx` | 2 | field-input |  |  | I |
| `src/components/admin/ui/AdminLinkField.tsx` | 14 | field-input, reference-picker, interactive-control |  |  | I |
| `src/components/admin/ui/AdminLinkPicker.tsx` | 17 | interactive-control, field-input, reference-picker, modal-drawer |  |  | C |
| `src/components/admin/ui/AdminListEmptyState.tsx` | 1 | navigation |  |  | I |
| `src/components/admin/ui/AdminListboxSelect.tsx` | 5 | field-input, interactive-control |  |  | I |
| `src/components/admin/ui/AdminModalButtons.tsx` | 3 | interactive-control |  |  | I |
| `src/components/admin/ui/AdminModuleTabs.tsx` | 1 | interactive-control |  |  | I |
| `src/components/admin/ui/AdminSearchInput.tsx` | 2 | field-input, interactive-control |  |  | I |
| `src/components/admin/ui/AdminSingleOpenAccordion.tsx` | 1 | interactive-control |  |  | I |
| `src/components/admin/ui/AdminSlugField.tsx` | 2 | interactive-control, field-input |  |  | I |
| `src/components/admin/ui/AdminTablePagination.tsx` | 8 | interactive-control, navigation |  |  | I |
| `src/components/admin/ui/AdminTextFormatControls.tsx` | 2 | interactive-control |  |  | I |

## Every declared tab

| Source | Line | Tab identity | Label / metadata | Class |
|---|---:|---|---|---|
| `src/app/admin/content/topics/[id]/page.tsx` | 137 | `topic.id` | topic.title | I |
| `src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx` | 737 | `"content"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx` | 741 | `"buttons"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx` | 785 | `"media"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx` | 846 | `"order"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx` | 852 | `"display"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/app/admin/pages-blocks/footer/FooterBuilderClient.tsx` | 183 | `"overview"` | "نظرة عامة" | I |
| `src/app/admin/pages-blocks/footer/FooterBuilderClient.tsx` | 248 | ``column-${index}`` | FOOTER_COLUMN_LABELS[index] | I |
| `src/app/admin/pages-blocks/footer/FooterBuilderClient.tsx` | 267 | `"contact-data"` | "بيانات التواصل" | I |
| `src/app/admin/pages-blocks/footer/FooterBuilderClient.tsx` | 283 | `"social-legal"` | "السوشيال والقانوني" | I |
| `src/app/admin/pages-blocks/menus/MenuBuilderClient.tsx` | 39 | `"items"` | "العناصر" | I |
| `src/app/admin/pages-blocks/menus/MenuBuilderClient.tsx` | 57 | `"menu-settings"` | "بيانات القائمة" | I |
| `src/app/admin/pages-blocks/menus/MenuBuilderClient.tsx` | 110 | `"add-item"` | "إضافة عنصر" | I |
| `src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx` | 786 | `"seo"` | "SEO" | I |
| `src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx` | 814 | `"map"` | "الخريطة" | I |
| `src/app/admin/pages-blocks/pages/[id]/PageBlocksClient.tsx` | 826 | `"modules"` | "الموديولات" | I |
| `src/app/admin/projects/ProjectEditForm.tsx` | 566 | `PROJECT_ENTRY_TAB_IDS.basic` | "البيانات" | I |
| `src/app/admin/projects/ProjectEditForm.tsx` | 574 | `PROJECT_ENTRY_TAB_IDS.location` | "الموقع" | I |
| `src/app/admin/projects/ProjectEditForm.tsx` | 639 | `PROJECT_ENTRY_TAB_IDS.overview` | "نظرة عامة" | I |
| `src/app/admin/projects/ProjectEditForm.tsx` | 648 | `PROJECT_ENTRY_TAB_IDS.plans` | "المساحات" | I |
| `src/app/admin/projects/ProjectEditForm.tsx` | 676 | `PROJECT_ENTRY_TAB_IDS.delivery` | "المواصفات" | I |
| `src/app/admin/projects/ProjectEditForm.tsx` | 685 | `PROJECT_ENTRY_TAB_IDS.media` | "الميديا" | I |
| `src/app/admin/projects/ProjectEditForm.tsx` | 720 | `PROJECT_ENTRY_TAB_IDS.seo` | "SEO" | I |
| `src/app/admin/projects/ProjectEditForm.tsx` | 729 | `PROJECT_ENTRY_TAB_IDS.review` | ADMIN_ENTITY_REVIEW_TAB_LABEL | I |
| `src/app/admin/seo/meta-manager/MetaManagerClient.tsx` | 481 | `"defaults"` | "Defaults" | I |
| `src/app/admin/seo/meta-manager/MetaManagerClient.tsx` | 490 | `"identity"` | "Identity" | I |
| `src/app/admin/seo/meta-manager/MetaManagerClient.tsx` | 499 | `"crawl"` | "Crawl" | I |
| `src/app/admin/seo/meta-manager/MetaManagerClient.tsx` | 508 | `"preview"` | "Preview" | I |
| `src/app/admin/settings/security/SecuritySettingsClient.tsx` | 164 | `"password"` | "كلمة المرور" | I |
| `src/app/admin/settings/security/SecuritySettingsClient.tsx` | 244 | `"account"` | "بيانات الحساب" | I |
| `src/app/admin/settings/security/SecuritySettingsClient.tsx` | 383 | `"sessions"` | "الأمان والجلسات" | I |
| `src/components/admin/content/editors/ArticleCreateEditor.tsx` | 57 | `"basic"` | "المحتوى" | I |
| `src/components/admin/content/editors/ArticleCreateEditor.tsx` | 91 | `"faq"` | "الأسئلة" | I |
| `src/components/admin/content/editors/ArticleCreateEditor.tsx` | 99 | `"seo"` | "SEO" | I |
| `src/components/admin/content/editors/ArticleCreateEditor.tsx` | 135 | `"publish"` | "المراجعة" | I |
| `src/components/admin/content/editors/ArticleEditor.tsx` | 141 | `"basic"` | "المحتوى" | I |
| `src/components/admin/content/editors/ArticleEditor.tsx` | 196 | `"faq"` | "الأسئلة" | I |
| `src/components/admin/content/editors/ArticleEditor.tsx` | 210 | `"seo"` | "SEO" | I |
| `src/components/admin/content/editors/ArticleEditor.tsx` | 246 | `"publish"` | "المراجعة" | I |
| `src/components/admin/content/editors/ContentEditorShell.tsx` | 101 | `tab.id` | Metadata resolved by ModuleEditorPresentation | I |
| `src/components/admin/content/editors/media/MediaContentForm.tsx` | 238 | `"basic"` | "المحتوى" | I |
| `src/components/admin/content/editors/media/MediaContentForm.tsx` | 283 | `"seo"` | "SEO" | I |
| `src/components/admin/content/editors/media/MediaContentForm.tsx` | 306 | `"publish"` | "المراجعة" | I |
| `src/components/admin/page-blocks/BreadcrumbModuleEditClient.tsx` | 70 | `"content"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/components/admin/page-blocks/BreadcrumbModuleEditClient.tsx` | 113 | `"pages"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/components/admin/page-blocks/CardsModuleEditClient.tsx` | 92 | `"content"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/components/admin/page-blocks/CardsModuleEditClient.tsx` | 146 | `"pages"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/components/admin/page-blocks/ContentModuleEditClient.tsx` | 212 | `"pages"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/components/admin/page-blocks/ContentModuleEditClient.tsx` | 219 | `"content"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/components/admin/page-blocks/ContentModuleEditClient.tsx` | 223 | `"buttons"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/components/admin/page-blocks/ContentModuleEditClient.tsx` | 237 | `"order"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/components/admin/page-blocks/ContentModuleEditClient.tsx` | 248 | `"details"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/components/admin/page-blocks/ContentModuleEditClient.tsx` | 256 | `"display"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/components/admin/page-blocks/ContentModuleEditClient.tsx` | 267 | `"text"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/components/admin/page-blocks/ContentModuleEditClient.tsx` | 271 | `"images"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/components/admin/page-blocks/ContentModuleEditClient.tsx` | 275 | `"cta"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/components/admin/page-blocks/ContentModuleEditClient.tsx` | 285 | `"text"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/components/admin/page-blocks/ContentModuleEditClient.tsx` | 289 | `"image"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/components/admin/page-blocks/ContentModuleEditClient.tsx` | 293 | `"cta"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/components/admin/page-blocks/ContentModuleEditClient.tsx` | 297 | `"contacts"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/components/admin/page-blocks/ContentModuleEditClient.tsx` | 307 | `"text"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/components/admin/page-blocks/ContentModuleEditClient.tsx` | 311 | `"image"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/components/admin/page-blocks/ContentModuleEditClient.tsx` | 315 | `"cta"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/components/admin/page-blocks/ContentModuleEditClient.tsx` | 319 | `"contacts"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/components/admin/page-blocks/ContentModuleEditClient.tsx` | 647 | `"content"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/components/admin/page-blocks/CtaModuleEditClient.tsx` | 92 | `"content"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/components/admin/page-blocks/CtaModuleEditClient.tsx` | 231 | `"pages"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/components/admin/page-blocks/FeaturedModuleEditClient.tsx` | 245 | `"content"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/components/admin/page-blocks/FeaturedModuleEditClient.tsx` | 486 | `"presentation"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/components/admin/page-blocks/FeaturedModuleEditClient.tsx` | 744 | `"pages"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/components/admin/page-blocks/FeedModuleEditClient.tsx` | 119 | `"content"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/components/admin/page-blocks/FeedModuleEditClient.tsx` | 268 | `"pages"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/components/admin/page-blocks/MediaHubModuleEditClient.tsx` | 239 | `"content"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/components/admin/page-blocks/MediaHubModuleEditClient.tsx` | 307 | `"presentation"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/components/admin/page-blocks/MediaHubModuleEditClient.tsx` | 332 | `"pages"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/components/admin/page-blocks/MediaSidebarModuleEditClient.tsx` | 168 | `"content"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/components/admin/page-blocks/MediaSidebarModuleEditClient.tsx` | 346 | `"pages"` | Metadata resolved by ModuleEditorPresentation | I |
| `src/components/admin/seo/AdminEntitySeoPanel.tsx` | 846 | `"search-result-preview"` | "معاينة نتائج البحث" | I |
| `src/components/admin/seo/AdminEntitySeoPanel.tsx` | 852 | `"open-graph-preview"` | ADMIN_ENTITY_SEO_TERMINOLOGY.socialPreview | I |
| `src/components/admin/seo/AdminEntitySeoPanel.tsx` | 859 | `"live-seo-analysis"` | "تحليل SEO المباشر" | I |

## Parent execution delta ledger

The following entries identify the authorized implementation work running alongside this inventory. Their existence does not change the unknown whole-journey Before/After columns. Parent final delivery must attach final source hashes and completed tests/diagnostics; planned evidence is not PASS.

| Delta | Class | Change at existing owner | Evidence status |
|---|---|---|---|
| D-AUTH | C | Resolve current admin from one freshly validated credential-free row instead of duplicated read; same Auth owner and session checks. | Implementation / verification in parent task; Root-owned deterministic Auth/performance verification; live target-usable latency unmeasured. |
| D-TAXONOMY | C | Existing entity and reference reads run concurrently in canonical form-data loader; no cache. | Controlled delayed-transport diagnostic; not browser time; .tmp-qa/admin-near-instant-2026-09-17/entity-open/before.json; .tmp-qa/admin-near-instant-2026-09-17/entity-open/after.json |
| D-PROJECT | C | Floor-plan-details waits for floor plans only and overlaps unrelated children after project prerequisite. | Controlled delayed-transport diagnostic; not browser time; .tmp-qa/admin-near-instant-2026-09-17/entity-open/before.json; .tmp-qa/admin-near-instant-2026-09-17/entity-open/after.json |
| PB-1 | F | Batch duplicate page-module mutation revalidation at existing owner; 8 update actions retain both detached and assigned public paths. | Implementation / verification in parent task; .tmp-qa/admin-near-instant-2026-09-17/pages-open/before.json; final after evidence pending parent |
| PB-2 | C | Template summary projection for all 9 kinds; same 18 reads and SEO/assignment meaning. | Implementation / verification in parent task; .tmp-qa/admin-near-instant-2026-09-17/pages-open/before.json; final after evidence pending parent |
| PB-3 | C | Independent Featured references and public-item reads execute concurrently. | Implementation / verification in parent task; .tmp-qa/admin-near-instant-2026-09-17/pages-open/before.json; final after evidence pending parent |
| PB-4 | C | Categories-only references at Featured/create defaults, Topics-listing Content edit/validation and Media-sidebar edit; Feed keeps full catalog. | Pages owner controlled parity verification complete; .tmp-qa/admin-near-instant-2026-09-17/pages-open/summary.json |
| D-RETURN-QUERY | B | Existing Form closeHref receives validated exact-origin list query through6 edit-existing title/action links and3 RSC/form consumers. Canonical Collection query writer reused; default navigation and security retained. | Form safe-return129 assertions + mounted clean/dirty/cancel/confirm18 assertions passed; source-proof status in verification.json; .tmp-qa/admin-near-instant-2026-09-17/return-state/{before.json,verification.json,form-system.log,guarded-close.log} |
| D-LINK-PICKER | C | Immediate open/resource/menu read, retain typed-search debounce; suppress obsolete responses within shared picker. | Candidate under parent measurement / implementation; Parent-owned mounted actual component diagnostics; no second cache/prefetch engine. |

Entity controlled diagnostics reported by the entity agent keep five samples per case, including outliers. Deliberately delayed isolated transport gives medians Category **85.39 → 42.07ms (2 reads)**, Series **91.98 → 45.48ms (2 reads)**, Topic **94.96 → 47.11ms (3 reads)**, Project **198.54 → 155.27ms (9 reads)**. This proves removal of artificial serial dependencies under controlled delay; **it is not measured browser click → usable latency**. Parallel taxonomy loading may issue +1 reference read for missing/error Category/Series or +2 for Topic before discovering invalid entity; this bounded error-path speculation is recorded, not hidden.

## Shared owners and remaining decisions

- Collection/Data/query/cache/instant-mutation owners and the 50-entry eligibility projection are reused from #165. Every known eligible collection already opts into the shared policy; do not repeat its discovery or benchmarks without dependency drift.
- Form lifecycle is `AdminFormRuntime`; Content editors use `ContentEditorShell`; page/block composition remains at existing page-block query/actions and `ModuleEditorPresentation`; no separate entity QueryClient or editor cache exists in this phase.
- Link picker is shared through `AdminLinkField`, with `src/lib/admin/links/actions.ts` as read/action owner. It reaches breadcrumb/cards/content/cta/hero editors, menu builder and footer. Applicable existing Form IDs: `block-template-{breadcrumb,cards,content,cta,hero}-editor`, `menu-builder`, `footer-builder`. It is not an unregistered standalone Collection/Form consumer. Existing accessibility guard: `scripts/verify-venesia-modal-accessibility.mts`.
- Categories/Series, link resource catalogs, media manage/selection, project location cascade, page assignments/templates and Featured references are distinct actual owners. A global blind reference cache would bypass their identity/mutation/domain scopes.
- Pages pagination/read semantics, Media Manage/Picker specialized behavior and Topics CMS manageability remain explicit existing decisions. Their presence is not permission to invent pagination, publication or a CMS row.
- Source enumeration does not establish React render, hydration, network/SQL CPU, remote floor, or total user latency. Auth/RSC/read timings overlap; do not add them as sequential components.
- Back navigation remains an explicit step in every entity and nested-builder journey. Query/scroll preservation and stale data after save need real control/domain evidence, even where source adoption is present.

## Exact inventory claim

Complete enumeration of the baseline Admin route surface and statically reachable Admin interaction callsites, augmented with the accepted Collection/Form inventory and named journeys. This is **not** complete runtime exercise, timing proof, end-to-end correctness closure or Global Admin Performance Closure. Every unmeasured surface remains visible in the matrix, and parent implementation evidence must preserve these boundaries.
