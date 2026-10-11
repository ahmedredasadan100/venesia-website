# Project External Card Image — Dedicated Presentation Guidance

Date: 2026-10-11. Baseline: `85323c5ae50bd660c64dce86da51a2c47ec45bb9` (main/origin/GitHub equal; clean).

## Value and ownership

`ProjectEditForm.ImageWithAlt(imageName="image")` → `projectEntryPayloadFromFormData` reads `image` and `image_alt` → `save-entry.ts` sends the trusted payload to the existing `save_project_admin_entry` RPC → `projects.image` → `mapProjectAggregateToPublicProject.cardImage` → existing availability projection in `load-published-projects` → consumers below. Homepage loader passes the same cardImage, without a Hero/gallery fallback.

The existing `projectMediaSlot("image")` presentation owner now supplies a dedicated `projects/external-card` contract to the unchanged Generic Admin Image Field. Other slot keys are unchanged. No new field, schema, validation, saved value, asset or Public rendering change.

## Exact-value consumer inventory

| Consumer | Frame / variants | Fit and crop |
|---|---|---|
| HomeProjectsSection | All cards 360px high; one column below 768px slot container, 3 columns from 768; gap20, section inset16/24, max content1280; 1/2-item groups keep the 3-column card width on desktop | cover; center; hover1.035; text/gradient overlays below |
| ProjectsListSection Grid | 208px high below640px, 240px thereafter; 1/2/3 columns at768/1280 viewport | cover center; hover1.05; mobile badges/gradient |
| ProjectsListSection List | 208/224px mobile frame; from768, fixed250px width and content-dependent height, minimum250px | cover center; hover1.05; side/mobile overlays |
| ProjectsFeaturedSection main | 224/256px below1024; from1024, 54% of main card width, min320px height, can grow with content | cover center; hover1.05; gradient overlay |
| ProjectsFeaturedSection side | 175px high; full width below1024; narrow side columns thereafter | cover center; hover1.05; title/gradient at bottom |
| Residential ProjectDistrictSection | Location section only; min360px frame, full width below1024 then 0.9fr within 1fr/0.9fr grid, gap32, max1280 | cover center; bottom label overlay |

Admin project editor and read-only project preview are authoring/preview adopters of these values/presentations. `ProjectDetailsHero` uses hero_image/small_box_image, project galleries use child project_media.image, floor plans use architectural_image/furnishing_image. Project SEO/JSON-LD use ogImage or heroImage, not cardImage. No shared-field inheritance into those image slots.

## Measurements (actual components, actual Tailwind, synthetic asset)

Measured at 320,375,390,430,639,640,767,768,1023,1024,1280,1440,1920. Public Home independently measured read-only at 375,390,430,767,768,1023,1440,1920.

| Viewport width | Home frame px | Home ratio W/H |
|---|---|---|
|375|341 × 360|0.947|
|390|356 × 360|0.989|
|430|396 × 360|1.100|
|767|717 × 360|1.992|
|768|224.66 × 360|0.624|
|1023|309.66 × 360|0.860|
|1440 / 1920|411.33 × 360|1.143|

Important widest measured card: Featured side973 ×175 just below1024. District reaches975 ×360. Home reaches717 ×360 just below its3-column breakpoint. These are CSS frame dimensions, not image/rendition metadata. List/Featured desktop height can also grow with content; measurements do not impose a content-height maximum.

## Final recommended design size

**No single defensible master pixel size or fixed ratio for this shared value.** Narrow Home225 ×360 and wide Featured973 ×175 alone span ratios0.624 and5.56. Even a minimax intermediate source ratio preserves only about33.5% of the image area in the worst of those two cases. More pixels cannot resolve this composition conflict; responsive text can widen the range further.

Admin therefore shows dedicated no-single-size guidance, exact use cases, Home360px frame behavior, and centered crop/composition advice. Do not label a convenient number as a required size or a uniform frame ratio. Choose a central focal point with generous surrounding space, avoid embedded text/logos and important details at edges/bottom overlays. There is no universally safe rectangle guaranteeing the entire building across all variants. If frame ratio is narrower than the source, sides crop; if wider, top/bottom crop. Hover adds a small center crop.

## Verification and release receipts

Existing Media Dimensions/Guidance verification now exercises the dedicated owner, separates all other project slot keys, measures all5 presentation groups across13 widths, checks cover/center, and exercises a future presentation contract through the same Generic Field. Original400 ×600 metadata stays independent when owner guidance changes; selection/upload validation is unchanged.

Source proof for projects-create-edit passes. Release evidence, full Admin Runtime, CI, standard merge, automatic Production READY and read-only Admin/Home proof are delivered in the final receipt/report. Seven intentional project404 references remain OWNER-DELETED / OWNER-TO-REPLACE.
