import nativeAssert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

type SectionOwner = typeof import("../../src/components/admin/ui/AdminForm.tsx").AdminFormSection;
export type AdminFormSectionObservation = { kind: "assertion" | "loader" | "vector" | "mutant"; [key: string]: unknown };

/** Shared Form-owner vectors; callers retain their canonical compilation/binding checks. */
export function verifyAdminFormSectionContract(source: string, {
  loadSection,
  premiumSurfaceClassName,
  observe,
}: {
  loadSection: (candidate: string) => SectionOwner;
  premiumSurfaceClassName: string;
  observe?: (event: AdminFormSectionObservation) => void;
}) {
  const digest = (value: string) => createHash("sha256").update(value).digest("hex");
  const sourceSha256 = digest(source), references = new WeakMap<object, number>(), referenceRoles = new WeakMap<object, string>();
  let referenceCount = 0, eventCount = 0, eventBytes = 0, observationFailure: unknown;
  let context: Record<string, unknown> = { phase: "control", candidateSha256: sourceSha256, candidateKind: "original", mutation: null };
  let failedPredicate: AdminFormSectionObservation | undefined;
  const emit = (event: AdminFormSectionObservation) => {
    if (!observe) return;
    if (observationFailure) throw observationFailure;
    try {
      eventCount += 1; eventBytes += Buffer.byteLength(JSON.stringify(event), "utf8");
      nativeAssert.ok(eventCount <= 4096 && eventBytes <= 2_000_000, "Section assertion observations exceed their finite evidence bound");
      observe(event);
    } catch (error) { observationFailure = error; throw error; }
  };
  const describe = (value: unknown, depth = 0): unknown => {
    if (!observe) return undefined;
    nativeAssert.ok(depth <= 6, "Section assertion argument shape exceeds its finite depth");
    if (value === undefined) return { type: "undefined" };
    if (value === null) return { type: "null" };
    if (typeof value === "string") {
      nativeAssert.ok(value.length <= 131_072, "Section assertion string exceeds its finite evidence bound");
      return { type: "string", value };
    }
    if (typeof value === "boolean" || typeof value === "number") return { type: typeof value, value };
    nativeAssert.ok(typeof value === "object" || typeof value === "function", "Unsupported Section assertion argument");
    const object = value as object;
    let reference = references.get(object); if (reference === undefined) { reference = ++referenceCount; references.set(object, reference); }
    if (typeof value === "function") return { type: "function", reference, name: value.name, code: value.toString(), codeSha256: digest(value.toString()) };
    if (Array.isArray(value)) { nativeAssert.ok(value.length <= 32); return { type: "array", reference, values: value.map(entry => describe(entry, depth + 1)) }; }
    nativeAssert.ok(isValidElement<Record<string, unknown>>(value), "Section assertion object must be an actual React element");
    const properties = Object.entries(value.props); nativeAssert.ok(properties.length <= 32);
    return { type: "react-element", reference, role: referenceRoles.get(object) ?? null, elementType: describe(value.type, depth + 1), key: value.key,
      props: Object.fromEntries(properties.map(([name, entry]) => [name, describe(entry, depth + 1)])) };
  };
  const site = (stack: string | undefined) => {
    const frames = (stack ?? "").split("\n").map(frame => /(?:\(|\s)(file:\/\/\/[^\n]+):(\d+):(\d+)\)?$/u.exec(frame))
      .filter((frame): frame is RegExpExecArray => Boolean(frame && frame[1] === import.meta.url));
    nativeAssert.ok(frames.length >= 2, "Actual Section assertion source coordinates are required");
    return { file: frames[1]![1], line: Number(frames[1]![2]), column: Number(frames[1]![3]) };
  };
  // Every intercepted operation invokes the original native operator. Observations
  // follow its result; they cannot turn a failed assertion into a success.
  const assert: typeof nativeAssert = observe ? new Proxy(nativeAssert, {
    get(target, property, receiver) {
      const method = Reflect.get(target, property, receiver);
      if (typeof property !== "string" || !["ok", "equal", "notEqual", "throws"].includes(property)) return method;
      return (...args: unknown[]) => {
        const stack = new Error().stack, actualContext = { ...context };
        let result: unknown;
        try { result = Reflect.apply(method, target, args); }
        catch (error) {
          try {
            const event: AdminFormSectionObservation = { kind: "assertion", site: site(stack), operator: `assert.${property}`, outcome: "failed", context: actualContext,
              arguments: args.map(argument => describe(argument)), failure: error instanceof Error ? { name: error.name, message: error.message, code: "code" in error ? error.code : null } : { name: typeof error } };
            if (actualContext.phase === "predicate") failedPredicate = event;
            emit(event);
          } catch (evidenceError) { observationFailure ??= evidenceError; }
          // The original native failure takes precedence over secondary evidence failures.
          throw error;
        }
        emit({ kind: "assertion", site: site(stack), operator: `assert.${property}`, outcome: "passed", context: actualContext, arguments: args.map(argument => describe(argument)) });
        return result;
      };
    },
  }) : nativeAssert;
  const verify = (candidate: string, mutation: string | null = null) => {
    const candidateSha256 = digest(candidate);
    context = { phase: "loader", candidateSha256, candidateKind: mutation === null ? "original" : "mutant", mutation };
    const Section = loadSection(candidate);
    emit({ kind: "loader", candidateSha256, candidateKind: mutation === null ? "original" : "mutant", mutation,
      callbackSha256: digest(loadSection.toString()), actualSectionSha256: digest(Section.toString()), actualSectionName: Section.name });
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
    for (const [vector, profile] of profiles.entries()) {
      const native = createElement("input", profile.nativeProps);
      const nativeProperties = native.props as Record<string, unknown>;
      referenceRoles.set(native, "native");
      const metadata = ["Original title", ...(profile.eyebrow === undefined ? [] : [profile.eyebrow]), "Original description", "Original action"];
      for (const header of [undefined, profile.explicitHeader]) {
        const props = { id: profile.id, title: "Original title", ...(profile.eyebrow === undefined ? {} : { eyebrow: profile.eyebrow }), description: "Original description", actions: createElement("button", { type: "button" }, "Original action"), header, ...(profile.className === undefined ? {} : { className: profile.className }), children: native };
        const headerProperties = header?.props as Record<string, unknown> | undefined;
        if (header) referenceRoles.set(header, "header");
        context = { phase: "predicate", candidateSha256, candidateKind: mutation === null ? "original" : "mutant", mutation, vector,
          nativeProps: { ...nativeProperties, onChange: describe(nativeProperties.onChange), hasOnChange: Object.hasOwn(nativeProperties, "onChange") },
          header: { present: header !== undefined, propertyPresent: Object.hasOwn(props, "header"), type: header?.type ?? null,
            markers: headerProperties ? Object.fromEntries(Object.entries(headerProperties).filter(([name]) => name.startsWith("data-"))) : {}, text: headerProperties?.children ?? null },
          id: props.id, eyebrowPresent: Object.hasOwn(props, "eyebrow"), eyebrow: describe(props.eyebrow),
          classNamePresent: Object.hasOwn(props, "className"), className: describe(props.className), metadata: [...metadata],
          presentation: "omitted", surface: "omitted", metadataText: null };
        emit({ kind: "vector", context: { ...context }, props: describe(props.children), native: describe(native), header: describe(header),
          supplied: { id: props.id, title: props.title, description: props.description, eyebrowPresent: Object.hasOwn(props, "eyebrow"), eyebrow: describe(props.eyebrow),
            classNamePresent: Object.hasOwn(props, "className"), className: describe(props.className), action: describe(props.actions), headerPresent: Object.hasOwn(props, "header") } });
        const panel = renderToStaticMarkup(Section(props));
        assert.equal(renderToStaticMarkup(createElement(Section, props)), panel, "Original Page SSR invocation and direct Form invocation preserve the same panel output");
        assert.ok(panel.includes(premiumSurfaceClassName));
        assert.equal((panel.match(profile.nativeNamePattern) ?? []).length, 1);
        if (header) { assert.ok(panel.includes(profile.explicitHeaderText)); assert.equal(panel.includes("Original title"), false); }
        else for (const text of metadata) { context.metadataText = text; assert.ok(panel.includes(text), text); }
        context.metadataText = null;
        for (const presentation of [undefined, "default", "panel"] as const) {
          context.presentation = presentation === undefined ? "undefined" : presentation; context.surface = "omitted";
          assert.equal(renderToStaticMarkup(Section({ ...props, presentation })), panel);
          context.surface = "panel";
          assert.equal(renderToStaticMarkup(Section({ ...props, presentation, surface: "panel" })), panel);
        }
        context.presentation = "omitted"; context.surface = "neutral";
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
          for (const text of metadata) { context.metadataText = text; assert.ok(html.includes(text), text); }
          context.metadataText = null;
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
    const candidateSha256 = digest(mutant);
    context = { phase: "control", candidateSha256, candidateKind: "mutant", mutation: label! };
    assert.notEqual(mutant, source, `${label}: mutation must change the actual owner`);
    failedPredicate = undefined;
    assert.throws(() => verify(mutant, label!), `${label}: shared Section contract rejects the regression`);
    if (observe) {
      const rejection = failedPredicate as AdminFormSectionObservation | undefined;
      nativeAssert.ok(rejection && (rejection.context as Record<string, unknown>).candidateSha256 === candidateSha256,
        `${label}: actual mutant must fail a positive Section predicate rather than a loader or setup error`);
      emit({ kind: "mutant", label, sourceSha256, candidateSha256, replacement: { from, to },
        failedPredicate: { site: rejection.site, operator: rejection.operator, context: rejection.context, arguments: rejection.arguments } });
    }
  }
  if (observationFailure) throw observationFailure;
  return true;
}
