# Media Dimensions Truth — Consumer/Template-Owned Guidance

Baseline: 714941af19d77f9e5c28f104807d78039653a421 (local main, origin/main, GitHub main verified equal).

## Scope and ownership

The existing Media capability remains the shared owner. Template/presentation owners supply a serializable MediaSlotContract to Image/Gallery fields; generic fields neither select templates nor own design numbers. No database migration is needed: rendering requirements are code-owned, alongside existing presentation contracts. Catalog width/height remain original-file metadata; no resize, data backfill, MIME change or new upload validation.

## Discovery matrix

| Consumer | Template/variant | Slot | Previous guidance/source | Actual rendering truth | Final guidance | Owner |
|---|---|---|---|---|---|---|
| Hero editor | home-cinematic / projects-hub | desktopHero | HARDCODED 1920×1080 / 16:9 in generic fields | min-height:100vh; content may grow; cover; composition preset; Ken Burns | Responsive, no fixed pixel size; desktop >=768px | hero-content-controls / DynamicHeroSection |
| Hero editor | home-cinematic / projects-hub | mobileHero | HARDCODED 1080×1920 / 9:16 | Same responsive minimum height, mobile list <=767px, full-list fallback | Mobile-specific source rule and responsive/crop guidance | Same Hero owner |
| Hero editor | internal-page | desktopHero/mobileHero | Same generic Hero numbers, STALE for this template | height:min(62vh,580px); min-height:440px; cover | Exact container rule, explicitly not image pixel requirement | Same Hero owner |
| Hero editor | project-detail | domain image | Domain message; no editable template image | ProjectDetailsHero min-height:620px; Project domain source | Domain-owned responsive guidance; no file pixel requirement | Hero + Project presentation |
| Article image | multiple detail/listing variants | image | GENERIC 1600×900; extra handwritten label; compact field did not render its declared hint | Reused across multiple card and detail frames | Multiple presentations; no single required pixel size or ratio | media-center/detail-page-config |
| Media video | video/detail/listings | videoPoster | GENERIC content hint | Multiple listing/card/video surfaces | Explicit multiple-use guidance | Same media presentation owner |
| Media gallery | gallery detail | galleryImage | GENERIC 1600×900; generic Gallery default also implied Hero | MediaDetailArticle gallery frame 4:3 cover | Container ratio 4:3, not upload requirement | Same media presentation owner |
| Project form | project detail/cards | hero_image, small_box_image, image, overview_main_image | HARDCODED Hero/content hints | Multiple domain-owned templates/slots; widths responsive | Multiple-use guidance without invented master size | project-hero-adapter |
| Project media/plan/video repeaters | galleries/plans/video | images/posters | NO GUIDANCE; preview ratios only | Galleries use 360px/min-height frames; plan cards cover and enlarged images contain | Multiple-use/crop warning; no single required size | Project presentation owner |
| Tracking | tracking viewer | imageOrPoster | GENERIC content hint / NO GUIDANCE | Main viewer 16:9 cover; thumbnails 4:3; possible tracking cover reuse | 16:9 main-view ratio with explicit other-use caveat | projects/tracking/contract |
| Vision Goals | vision-goals | image | GENERIC 1600×900 | 16:12 cover; center 36%; hover scale | 16:12 container ratio, not file requirement | page-blocks/configs; shared geometry used by renderer |
| About single image | about-intro-single-image | image | GENERIC 1600×900 | Same 16:12 frame | Same ratio/crop guidance | Same module config owner |
| About CTA | about-cta | image | GENERIC 1600×900 | min-height250px / wide220px; responsive grid | Responsive container description | page-blocks/configs |
| Projects map | projects-hub-map | map image | GENERIC 1600×900 | min-height500px; responsive width; cover | Responsive container description | page-blocks/configs |
| About/Home intro | about-intro / home-story | main/secondary/accent | GENERIC 1600×900 | Overlapping variable-size frames; no unified ratio | Variable-frame guidance, no pixel recommendation | page-blocks/configs selected by existing editorMode |
| Home Trust | home-trust | card image | GENERIC 1600×900 | Responsive flip card; CSS cover center | Responsive card/crop guidance | page-blocks/configs |
| Company identity | Admin branding | main/compact logo | NO GUIDANCE | Reused brand assets; no authored slot requirement | No fabricated guidance; original metadata only | Existing Image field + Catalog |
| SEO panel | external social consumers | OG image | GENERIC content hint | External consumers determine rendering; local preview is not a required size | Removed generic hint; original metadata only | Existing Image field + Catalog; SEO values untouched |
| Media Library/Picker | asset catalog | original asset | REAL metadata, ambiguously titled dimensions | Upload binary metadata -> Catalog width/height | Explicit Original Dimensions; unknown remains unknown | Catalog binary-metadata + MediaLibraryCore |
| Hero measurement card | linked live public page | measured current source | Original initially populated from optimized image naturalWidth | DOM/rendition/original are independent | Container measured immediately; original only after original source loads; visible source area is viewport-specific | Existing HeroRenderedAreaCard |
| Download/file/link picker | PDF | file | NO image guidance | Document selection | Unchanged; image dimensions not applicable | Existing File/Link picker |

Before this change, the compact Image field suppressed its dimensionHint entirely; matrix GENERIC/HARDCODED entries for compact consumers classify the declared source, not a claim that the hint was visible. The Article editor also had an independently visible 1600×900 label. Gallery hints and card badges were visible, including the implicit Hero default.

No existing minimum/exact image upload validation was found. No Required or Recommended pixel size is added. Pixel values in responsive descriptions describe containers explicitly. Admin preview frame ratios remain UI-only and are not presented as asset requirements. Unknown Catalog metadata is not filled from preview naturalWidth or CDN renditions.

## Exhaustive source inventory (before changes)

### src/app/admin/settings/general/CompanyIdentityPanel.tsx

- Line 84: `<AdminMediaImageField`
- Line 93: `<AdminMediaImageField`

### src/app/admin/projects/ProjectEditForm.tsx

- Line 167: `dimensionHint = "content",`
- Line 175: `dimensionHint?: "hero" | "content";`
- Line 183: `<AdminMediaImageField`
- Line 188: `dimensionHint={dimensionHint}`
- Line 353: `dimensionHint="hero"`
- Line 458: `dimensionHint="hero"`

### src/components/admin/ui/AdminLinkPicker.tsx

- Line 607: `<AdminMediaPickerModal`

### src/app/admin/pages-blocks/blocks/hero/[id]/HeroEditClient.tsx

- Line 816: `<AdminImagePathListField`
- Line 820: `dimensionHint="hero"`
- Line 830: `<AdminImagePathListField`
- Line 834: `dimensionHint="hero-mobile"`

### src/components/admin/page-blocks/editors/VisionGoalsModuleEditor.tsx

- Line 70: `<AdminMediaImageField`
- Line 76: `dimensionHint="content"`

### src/components/admin/page-blocks/editors/ProjectsHubMapModuleEditor.tsx

- Line 78: `<AdminMediaImageField`
- Line 83: `dimensionHint="content"`

### src/components/admin/media/AdminMediaImageField.tsx

- Line 14: `content: "الأبعاد الموصى بها: 1600 × 900 px (16:9)",`
- Line 21: `dimensionHint?: ImageDimensionHint;`
- Line 45: `dimensionHint,`
- Line 188: `<AdminMediaPickerModal`
- Line 213: `{dimensionHint ? (`
- Line 214: `<p className={text-xs leading-6 ${light ? "text-[#9a6815]" : "text-[#D8B87A]/65"}}>{DIMENSION_HINTS[dimensionHint]}</p>`
- Line 287: `<AdminMediaPickerModal`

### src/components/admin/media/AdminMediaGalleryField.tsx

- Line 17: `content: "الأبعاد الموصى بها للصور المميزة/المحتوى: 1600 × 900 px (16:9)",`
- Line 23: `content: "1600 × 900 • 16:9",`
- Line 42: `dimensionHint?: ImageDimensionHint;`
- Line 121: `dimensionHint = "hero",`
- Line 271: `{DIMENSION_HINTS[dimensionHint]}`
- Line 400: `{DIMENSION_CARD_LABELS[dimensionHint]}`
- Line 488: `<AdminMediaPickerModal`

### src/components/admin/media/AdminMediaFileField.tsx

- Line 109: `<AdminMediaPickerModal`

### src/components/admin/page-blocks/editors/AboutPrinciplesModuleEditor.tsx

- Line 202: `<AdminMediaImageField`
- Line 209: `dimensionHint="content"`

### src/components/admin/page-blocks/editors/AboutIntroSingleImageModuleEditor.tsx

- Line 84: `<AdminMediaImageField`
- Line 90: `dimensionHint="content"`

### src/components/admin/page-blocks/editors/AboutIntroModuleEditor.tsx

- Line 284: `<AdminMediaImageField`
- Line 294: `dimensionHint="content"`
- Line 311: `<AdminMediaImageField`
- Line 325: `dimensionHint="content"`
- Line 333: `<AdminMediaImageField`
- Line 340: `dimensionHint="content"`
- Line 343: `<AdminMediaImageField`
- Line 350: `dimensionHint="content"`
- Line 353: `<AdminMediaImageField`
- Line 360: `dimensionHint="content"`

### src/components/admin/page-blocks/editors/AboutCtaModuleEditor.tsx

- Line 172: `<AdminMediaImageField`
- Line 179: `dimensionHint="content"`

### src/components/admin/seo/AdminEntitySeoPanel.tsx

- Line 729: `<AdminMediaImageField`
- Line 733: `dimensionHint="content"`

### src/components/admin/content/editors/media/MediaVideoFields.tsx

- Line 69: `<AdminMediaImageField`
- Line 74: `dimensionHint="content"`

### src/components/admin/content/editors/media/MediaContentForm.tsx

- Line 197: `<AdminMediaGalleryField`
- Line 204: `dimensionHint="content"`

### src/components/admin/projects/entry/ProjectMediaEditors.tsx

- Line 124: `<AdminMediaImageField`
- Line 247: `<AdminMediaImageField name="video_poster_image" label="صورة الغلاف" defaultValue={item.poster_image} browseFolder="images/projects/videos" appearance="dark" variant="compact" compactAspectClassName="aspect-video" onValueChange={(poster_image) => update(item.client_key, { poster_image })} />`

### src/components/admin/content/editors/article/TopicImageField.tsx

- Line 21: `<AdminMediaImageField`
- Line 26: `dimensionHint="content"`
- Line 35: `<span>1600 × 900 · حجم الرفع حسب إعدادات مكتبة الوسائط</span>`

### src/components/admin/projects/entry/ProjectRepeaters.tsx

- Line 510: `<AdminMediaImageField name="floor_plan_architectural_image" label="المخطط المعماري" defaultValue={plan.architectural_image} browseFolder="images/projects/plans" appearance="dark" onValueChange={(value) => updatePlan(plan.client_key, { architectural_image: value })} />`
- Line 514: `<AdminMediaImageField name="floor_plan_furnishing_image" label="مخطط الفرش" defaultValue={plan.furnishing_image} browseFolder="images/projects/plans" appearance="dark" onValueChange={(value) => updatePlan(plan.client_key, { furnishing_image: value })} />`

### src/components/admin/projects/tracking/TrackingForms.tsx

- Line 434: `<AdminMediaGalleryField`
- Line 442: `dimensionHint="content"`

### src/components/admin/projects/tracking/TrackingVideoFields.tsx

- Line 34: `<div className="mt-4 max-w-xs"><AdminMediaImageField name={poster_${video.client_key}} label="غلاف الفيديو" defaultValue={video.poster_url} dimensionHint="content" variant="compact" onValueChange={(value) => update(video.client_key, { poster_url: value })} /></div>`

## Verification and delivery

The existing verify:media-library-system owner now executes a second 2:3 template fixture through the same Admin guidance component, plus original 400×600 PNG and distinct 40×60 rendition tests. Existing upload, folder, move, rename and delete tests remain in that owner. Form/Collection adoption source proof uses the existing manifests and Current Shared Capability Set. Browser/CI/Production evidence is reported separately; this document alone does not claim release closure.

## Local evidence status

- Lint, TypeScript and production build passed.
- Media owner: 107 existing checks plus the new dimensions fixture passed. Public Content Delivery: 197 assertions; Project Entry: 128 checks; Public Media Truth passed.
- Consumer source proof: all 78 consumers passed; nine affected Form/Collection identities were also checked explicitly.
- Admin Runtime components passed up to the two presentation guards that needed owner-aware expectations. The current route-slot and Page Block editor guards were updated and passed, and the remaining canonical components were completed separately. A full Linux CI pass is still a release gate.
- Real local Admin displayed separate Desktop/Mobile responsive guidance. Public measurements: 375×812 viewport → 360×812 container; 390×844 → 375.2×844; 430×932 → 415.2×932; 1440×900 → 1424.8×900. Desktop Chromium reserved scrollbar width; measured aspect-ratio was auto, object-fit cover, position 50% 50%. These are observations, not design pixel requirements.
- The initial Admin screenshot was taken before original-metadata completion and is not proof of missing Catalog dimensions. Production aggregate read found 21/21 active image records with known width/height. The actual React metadata UI was separately browser-tested with controlled API data: 400×600 remained independent while the template changed from 2:3 to 4:1. Actual live Production field values remain to be verified after release.
- Full local ci:check stopped at an unchanged CRLF-sensitive fixture assertion in verify-admin-core-query-fixture-contract.mjs:105. Normalized fixture bytes equal Git; the LF replacement needle misses the Windows working copy and matches normalized content. No unrelated fixture or governance repair was made.
- Older non-CI Hero/About verifiers also contain pre-existing presentation expectations; they were inspected but left unchanged. Current route-slot, Page Block presentation and Media owners carry this phase's verification.
- The owner explicitly authorized release in chat on 2026-10-11: affected verification, PR, CI, standard merge, automatic Production deployment, read-only proof and cleanup. No manual deployment, database mutation, uploaded file mutation or content save is part of the release. Production proof remains a closure gate.
