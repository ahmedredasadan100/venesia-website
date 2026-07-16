/**
 * Behavioral checks for composite pairing contracts (mirrors slot-module-nodes rules).
 * Pure JS — no React / TSX import.
 */

function sortBlocks(blocks) {
  return [...blocks].sort((a, b) => a.sortOrder - b.sortOrder || a.assignmentId - b.assignmentId);
}

function indexBySlug(blocks) {
  const map = new Map();
  for (const block of blocks) map.set(block.template.slug, block);
  return map;
}

/**
 * Pure plan of which assignment IDs produce a render key, mirroring composite rules.
 */
function planCompositeKeys(blocks) {
  const sorted = sortBlocks(blocks);
  const bySlug = indexBySlug(sorted);
  const consumed = new Set();
  const keys = [];

  const mark = (b) => {
    if (b) consumed.add(b.assignmentId);
  };

  for (const block of sorted) {
    if (consumed.has(block.assignmentId)) continue;
    const slug = block.template.slug;

    if (slug === "about-intro" || block.template.variant === "about-intro") {
      const beats = bySlug.get("about-documentary-beats");
      const embedded = Boolean(block.template.config?.beats?.length);
      mark(block);
      if (!embedded && beats) mark(beats);
      keys.push({ key: `about-intro-${block.assignmentId}`, sortOrder: block.sortOrder, consumes: [block.assignmentId, !embedded && beats ? beats.assignmentId : null].filter(Boolean) });
      continue;
    }

    if (slug === "about-intro-single-image" || block.template.variant === "about-intro-single-image") {
      mark(block);
      keys.push({ key: `about-intro-single-image-${block.assignmentId}`, sortOrder: block.sortOrder, consumes: [block.assignmentId] });
      continue;
    }

    if (slug === "about-documentary-beats") {
      const intro = sorted.find((b) => b.template.slug === "about-intro" || b.template.variant === "about-intro");
      if (intro) {
        mark(block);
        continue;
      }
      mark(block);
      keys.push({ key: `about-beats-${block.assignmentId}`, sortOrder: block.sortOrder, consumes: [block.assignmentId] });
      continue;
    }

    if (slug === "contact-form-office" || slug === "contact-form") {
      const office = bySlug.get("contact-form-office");
      const form = bySlug.get("contact-form");
      mark(office);
      mark(form);
      keys.push({
        key: `contact-form-${block.assignmentId}`,
        sortOrder: Math.min(office?.sortOrder ?? block.sortOrder, form?.sortOrder ?? block.sortOrder),
        consumes: [office?.assignmentId, form?.assignmentId].filter(Boolean),
      });
      continue;
    }

    mark(block);
    keys.push({ key: `block-${block.assignmentId}`, sortOrder: block.sortOrder, consumes: [block.assignmentId] });
  }

  return keys;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Contact office + form → one composite
{
  const keys = planCompositeKeys([
    { assignmentId: 1, sortOrder: 20, template: { slug: "contact-form-office", variant: null, config: {} } },
    { assignmentId: 2, sortOrder: 30, template: { slug: "contact-form", variant: null, config: {} } },
  ]);
  assert(keys.length === 1, "contact pair must yield one node");
  assert(keys[0].consumes.includes(1) && keys[0].consumes.includes(2), "contact must consume both");
}

// Contact office only
{
  const keys = planCompositeKeys([
    { assignmentId: 1, sortOrder: 10, template: { slug: "contact-form-office", variant: null, config: {} } },
  ]);
  assert(keys.length === 1, "office-only still one section");
}

// About intro + beats (beats first sort) → one intro composite, beats consumed
{
  const keys = planCompositeKeys([
    { assignmentId: 5, sortOrder: 5, template: { slug: "about-documentary-beats", variant: null, config: {} } },
    { assignmentId: 4, sortOrder: 10, template: { slug: "about-intro", variant: "about-intro", config: {} } },
  ]);
  assert(keys.length === 1, "beats-before-intro must not double-render");
  assert(keys[0].key.startsWith("about-intro-"), "parent key must be intro");
  assert(keys[0].consumes.includes(4) && keys[0].consumes.includes(5), "must consume intro+beats");
}

// Single-image independent of intro+beats
{
  const keys = planCompositeKeys([
    { assignmentId: 4, sortOrder: 10, template: { slug: "about-intro", variant: "about-intro", config: {} } },
    { assignmentId: 5, sortOrder: 15, template: { slug: "about-documentary-beats", variant: null, config: {} } },
    { assignmentId: 6, sortOrder: 20, template: { slug: "about-intro-single-image", variant: "about-intro-single-image", config: {} } },
  ]);
  assert(keys.length === 2, "single-image stays independent alongside intro composite");
  assert(keys.some((k) => k.key.startsWith("about-intro-single-image-")), "single-image node present");
}

// Generic block between composites keeps order
{
  const keys = planCompositeKeys([
    { assignmentId: 1, sortOrder: 10, template: { slug: "generic-a", variant: null, config: {} } },
    { assignmentId: 2, sortOrder: 20, template: { slug: "contact-form-office", variant: null, config: {} } },
    { assignmentId: 3, sortOrder: 30, template: { slug: "contact-form", variant: null, config: {} } },
    { assignmentId: 4, sortOrder: 40, template: { slug: "generic-b", variant: null, config: {} } },
  ]);
  assert(keys.length === 3, "generic + composite + generic");
  assert(keys[0].key === "block-1" && keys[2].key === "block-4", "generics keep ends");
}

console.log("verify-composite-slot-behavior OK");
