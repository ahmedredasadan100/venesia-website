import assert from "node:assert/strict";
import { createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

type SectionOwner = typeof import("../../src/components/admin/ui/AdminForm.tsx").AdminFormSection;

/** Shared Form-owner vectors; callers retain their canonical compilation/binding checks. */
export function verifyAdminFormSectionContract(source: string, {
  loadSection,
  premiumSurfaceClassName,
}: {
  loadSection: (candidate: string) => SectionOwner;
  premiumSurfaceClassName: string;
}) {
  const verify = (candidate: string) => {
    const Section = loadSection(candidate);
    const native = createElement("input", { name: "native", defaultValue: "same", required: true, disabled: true, onChange: () => undefined });
    const explicitHeader = createElement("header", { "data-explicit-header": "" }, "Explicit header");
    for (const header of [undefined, explicitHeader]) {
      const props = { id: "original-section", title: "Original title", eyebrow: "Original eyebrow", description: "Original description", actions: createElement("button", { type: "button" }, "Original action"), header, className: "original-composition", children: native };
      const panel = renderToStaticMarkup(Section(props));
      assert.ok(panel.includes(premiumSurfaceClassName));
      assert.equal((panel.match(/name="native"/gu) ?? []).length, 1);
      if (header) { assert.ok(panel.includes("Explicit header")); assert.equal(panel.includes("Original title"), false); }
      else for (const text of ["Original title", "Original eyebrow", "Original description", "Original action"]) assert.ok(panel.includes(text), text);
      for (const presentation of [undefined, "default", "panel"] as const) {
        assert.equal(renderToStaticMarkup(Section({ ...props, presentation })), panel);
        assert.equal(renderToStaticMarkup(Section({ ...props, presentation, surface: "panel" })), panel);
      }
      const neutral = Section({ ...props, surface: "neutral" });
      assert.ok(isValidElement<{ id: string; className: string; children: ReactNode[] }>(neutral));
      assert.equal(neutral.type, "section");
      assert.equal(neutral.props.id, props.id);
      assert.equal(neutral.props.className, "min-w-0 original-composition");
      assert.equal(neutral.props.children[1], native, "Neutral composition preserves exact callback-bearing native content");
      const html = renderToStaticMarkup(neutral);
      assert.ok(html.includes('data-admin-form-section-surface="neutral"'));
      assert.equal(html.includes(premiumSurfaceClassName), false);
      assert.equal((html.match(/name="native"/gu) ?? []).length, 1);
      assert.ok(html.includes('value="same"') && html.includes('required=""') && html.includes('disabled=""'));
      if (header) { assert.equal(neutral.props.children[0], header); assert.ok(html.includes("Explicit header")); }
      else {
        for (const text of ["Original title", "Original eyebrow", "Original description", "Original action"]) assert.ok(html.includes(text), text);
        assert.equal(html.includes("-mx-3"), false, "Neutral implicit header uses the canonical standalone geometry");
      }
    }
  };
  verify(source);
  for (const [label, from, to] of [
    ["default panel identity", 'surface = "panel"', 'surface = "neutral"'],
    ["neutral semantic marker", 'data-admin-form-section-surface="neutral"', 'data-lost-neutral=""'],
    ["neutral composition geometry", 'className={`min-w-0 ${className}`.trim()}', 'className={`min-w-0 p-3 border bg-black ${className}`.trim()}'],
    ["original header", "{sectionHeader}", "{null}"],
    ["native children", "{children}", "{null}"],
  ]) {
    const mutant = source.replaceAll(from!, to!);
    assert.notEqual(mutant, source, `${label}: mutation must change the actual owner`);
    assert.throws(() => verify(mutant), `${label}: shared Section contract rejects the regression`);
  }
  return true;
}
