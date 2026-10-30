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
    const profiles = [
      { nativeProps: { name: "native", defaultValue: "same", required: true, disabled: true, onChange: () => undefined },
        nativeNamePattern: /name="native"/gu, nativeValueMarker: 'value="same"',
        explicitHeader: createElement("header", { "data-explicit-header": "" }, "Explicit header"), explicitHeaderText: "Explicit header",
        id: "original-section", eyebrow: "Original eyebrow", className: "original-composition", neutralClassName: "min-w-0 original-composition" },
      { nativeProps: { name: "native", defaultValue: "same", required: true, disabled: true },
        nativeNamePattern: /name="native"/gu, nativeValueMarker: 'value="same"',
        explicitHeader: createElement("div", { "data-explicit-header": "" }, "Explicit header"), explicitHeaderText: "Explicit header",
        id: "original-section", eyebrow: "Original eyebrow", className: undefined, neutralClassName: "min-w-0" },
      { nativeProps: { name: "preserved", defaultValue: "original", required: true, disabled: true, onChange: () => undefined },
        nativeNamePattern: /name="preserved"/gu, nativeValueMarker: 'value="original"',
        explicitHeader: createElement("header", { "data-original-header": "" }, "Original header"), explicitHeaderText: "Original header",
        id: "original-id", eyebrow: undefined, className: "original-composition", neutralClassName: "min-w-0 original-composition" },
    ];
    for (const profile of profiles) {
      const native = createElement("input", profile.nativeProps);
      const metadata = ["Original title", ...(profile.eyebrow === undefined ? [] : [profile.eyebrow]), "Original description", "Original action"];
      for (const header of [undefined, profile.explicitHeader]) {
        const props = { id: profile.id, title: "Original title", ...(profile.eyebrow === undefined ? {} : { eyebrow: profile.eyebrow }), description: "Original description", actions: createElement("button", { type: "button" }, "Original action"), header, ...(profile.className === undefined ? {} : { className: profile.className }), children: native };
        const panel = renderToStaticMarkup(Section(props));
        assert.equal(renderToStaticMarkup(createElement(Section, props)), panel, "Original Page SSR invocation and direct Form invocation preserve the same panel output");
        assert.ok(panel.includes(premiumSurfaceClassName));
        assert.equal((panel.match(profile.nativeNamePattern) ?? []).length, 1);
        if (header) { assert.ok(panel.includes(profile.explicitHeaderText)); assert.equal(panel.includes("Original title"), false); }
        else for (const text of metadata) assert.ok(panel.includes(text), text);
        for (const presentation of [undefined, "default", "panel"] as const) {
          assert.equal(renderToStaticMarkup(Section({ ...props, presentation })), panel);
          assert.equal(renderToStaticMarkup(Section({ ...props, presentation, surface: "panel" })), panel);
        }
        const neutral = Section({ ...props, surface: "neutral" });
        assert.ok(isValidElement<{ id: string; className: string; children: ReactNode[] }>(neutral));
        assert.equal(neutral.type, "section");
        assert.equal(neutral.props.id, props.id);
        assert.equal(neutral.props.className, profile.neutralClassName);
        assert.equal(neutral.props.children[1], native, "Neutral composition preserves exact callback-bearing native content");
        const html = renderToStaticMarkup(neutral);
        assert.ok(html.includes('data-admin-form-section-surface="neutral"'));
        assert.equal(html.includes(premiumSurfaceClassName), false);
        assert.equal((html.match(profile.nativeNamePattern) ?? []).length, 1);
        assert.ok(html.includes(profile.nativeValueMarker) && html.includes('required=""') && html.includes('disabled=""'));
        if (header) { assert.equal(neutral.props.children[0], header); assert.ok(html.includes(profile.explicitHeaderText)); }
        else {
          for (const text of metadata) assert.ok(html.includes(text), text);
          assert.equal(html.includes("-mx-3"), false, "Neutral implicit header uses the canonical standalone geometry");
        }
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
