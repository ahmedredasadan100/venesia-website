# Media Slot Presence & Deleted Asset Presentation

Status: IN PROGRESS — not closed.
Baseline: 9c1aa675b2c1aead6089a46c0566548ba76acd5a. Fresh local main, fetched origin/main and GitHub main agree; initial worktree clean. Production dpl_DZoeiMsrP8esiDYDBBB6AUTxPBKv READY on the same SHA.

## Inventory and architecture

Asset availability belongs to Catalog/public projection. Geometry belongs to the selected presentation. Extend MediaSlotContract; no schema or content mutation. Reused entity image guidance cannot prescribe one presence policy across all presentations.

| Consumer | Template/variant | Slot | Content | Absence today | Final decision | Owner |
|---|---|---|---|---|---|---|
| Home Story | home-story/about-intro | main + secondary | Replaceable retained | Frames and column collapse | RESERVED, explicit owner request | HomeStorySection + contentModuleMediaSlot |
| Home Contact | home-contact | building/background | Replaceable retained | Mobile 440px and desktop 52% image allowance disappear | RESERVED: structural composition, not incidental decoration | HomeContactSection + contentModuleMediaSlot |
| Home Trust | home-trust | card backgrounds | Optional | Card/copy remain | RESERVED, preserve | HomeTrustSection |
| Home Projects | home-projects | cover | Replaceable | Fixed frame, direct Image lacks empty-source guard | RESERVED; adopt existing guarded PublicMediaImage | HomeProjectsSection |
| Projects | list/featured | cover | Replaceable | Existing cover frame remains | RESERVED, preserve | ProjectsListSection / ProjectsFeaturedSection |
| Project details | hero/overview/district/plans | structural frames | Varies | Existing frames; optional collections can disappear | RESERVED rendered frames; COLLAPSIBLE optional entries | ProjectDetailsHero / ResidentialProjectDetails / ProjectDistrictSection / ProjectPlansAndAreasSection / ProjectImageGalleries |
| Topics / Media Center | collection list/grid | thumbnail | Optional/display-controlled | Text-only layout | COLLAPSIBLE, preserve | CollectionListingPresenter + resolveContentItemDisplay |
| Article/feed | card variants | thumbnail | Optional | Existing no-image layout | COLLAPSIBLE, preserve | Feed/Card owner from #212 |
| Sidebar | latest/most-read/series | thumbnail | Optional | Removes thumbnail/column | COLLAPSIBLE, preserve | Sidebar widgets + resolveContentImageVisibility |
| Featured | overlay card standard/large | background | Display-controlled | Card remains at 290px or 360/480px while only Image is gated | RESERVED, preserve | FeaturedContentCard + item display resolver |
| Featured | carousel row | thumbnail | Optional | 112px column and minimum 98px frame disappear | COLLAPSIBLE, preserve | FeaturedCarousel |
| Media gallery | detail | entry frame | Optional collection | Deleted entries filtered; surviving frames 4:3 | COLLAPSIBLE entry; RESERVED surviving frame | public-content-read + MediaDetailArticle |
| Page Blocks | about-intro-single-image / vision-goals | editorial illustration | Optional | Media frame and editorial-flow layout disappear; copy remains | COLLAPSIBLE, preserve | AboutIntroSingleImageModuleSection / VisionGoalsModuleSection |
| Page Blocks | about-cta (non-Home) | side image | Optional | Column remains at 250px/220px even without Image | RESERVED, preserve | AboutCtaModuleSection |
| Hero | selected template/device | slide | Independent device selection | Existing variant-owned geometry | Preserve; no Hero runtime change | hero-content-controls / DynamicHeroSection |
| Admin | single/gallery | preview | Empty or retained | Truthy retained URL still renders | RESERVED selected card; no deleted/missing preview | Shared Image/Gallery + useAdminMediaReferenceState |

Story geometry stays exactly in its current presentation: container minimum height 280/360/500px; main frame 220/265/380px and 70/74/78%; secondary 185/220/320px and 58/60/65% at the existing container breakpoints. Contact retains mobile 440px minimum and desktop right 52% content inset because its full-bleed building image is a structural area alongside the contact stack. Neither decision introduces pixel guidance or changes file dimensions.

## Admin root cause

The hook reduced Catalog deleted[] to a count. Image/Gallery rendered directly from retained URL truthiness, independently of that result. CDN cache could keep serving that old URL; no Catalog active-preview or rendition resolution guarded it. The shared hook now exposes per-value deleted/missing state. Preview waits for reference-state truth and shows an explicit unavailable state when the read fails. Hidden references, alt/caption, ordering and save authorization are preserved. Retained references appear in collapsed technical details instead of active preview presentation.

Fresh read-only Catalog query confirmed Story assets 32d23f4e-319a-4c9f-99bc-d73e7af45840 and 2bf3c55e-be87-47c7-8091-87004fa6de32 and Contact asset 0a3388db-55d1-4630-8120-4998336a44ff remain deleted. Their missing_object flags are false, demonstrating why deletion status must take precedence.

Missing/deleting/missing_object Catalog states extend presentation filtering only. Confirmed-deletion save exemptions still call the unchanged readDeletedManagedValues(..., true). No MIME, permission, lifecycle, schema or stored-reference edits.

Seven legacy project covers remain OWNER-DELETED / OWNER-TO-REPLACE, with no reference changes or restoration. This phase does not register legacy paths as managed assets or infer tombstones from HTTP errors.

## Verification and release

Applicability: six affected existing form consumers PASS. Remaining verification/release evidence pending. Do not infer closure from source changes.


## Evidence collected

Production before: Home 5/5 at 375/390/430/1440; Story has zero media frames. Admin content/25 has two image elements whose sources are Next optimizer URLs around the retained deleted Storage URLs, while the same fields display Catalog deletion notices. This directly confirms the render bypass (not an invented active Catalog rendition). Read-only network guard blocked editor server-action POSTs; reference_state POSTs alone were permitted.

Fixture browser: Story frame x/y/width/height and Contact section geometry equal between valid/deleted states at 375/390/430/1440; no image elements for deleted state. Admin default/compact/gallery deleted and missing references issue no image requests; references, alt and caption survive. Local fixture serialization/reload preserves row data; replacement selection and serialization/reload render the new valid image. This is a safe fixture persistence proof, not a Production save.

Media owner: 107/107 checks; Feed/Card 8 cases x 29 variants; public read 199 assertions; Home 7 cases plus complete render plan. Final reruns and Admin Runtime/release still pending.

Detailed inventory source review distinguishes Featured overlay geometry (RESERVED) from Featured carousel thumbnails (COLLAPSIBLE). Home Trust retains its 14.375rem card geometry while removing the optional flip-back image interaction. These existing designs are not modified.


Final adoption review also found the internal Topics preview reading saved image/gallery URLs directly. It now supplies the same Catalog state to AdminMediaPreview without modifying the row, gallery cardinality or captions. Its registered product surface is admin-content-topic-preview (preview, runtime not_applicable), nested under the existing content editor; it is not a new Form/Collection. Project Admin preview already delegates to the now-filtered project read owner, and Hero measurement uses the public route. Four actual saved-preview render cases prove active/deleted/missing/empty behavior. Compact gallery status text was separately proven to fit at 375/390/430px; overlay padding is reserved only for the single-image field whose controls overlap the preview.
