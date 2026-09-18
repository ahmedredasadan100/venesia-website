// Serialized into the owned browser. Native CSS resolves every criterion in one
// renderer task; no per-control automation round trip is part of the endpoint.
export function browserAtomicReadiness({ operation, criteria, eventType, id, requireFormSaved }) {
  const inspect = () => {
    const started = performance.now(), failures = [];
    const visible = element => {
      const style = getComputedStyle(element);
      if (style.visibility !== "visible") return false;
      if (style.display === "contents") return [...element.childNodes].some(child => {
        if (child.nodeType === Node.ELEMENT_NODE) return visible(child);
        if (child.nodeType !== Node.TEXT_NODE) return false;
        const range = document.createRange(); range.selectNode(child);
        const rect = range.getBoundingClientRect(); return rect.width > 0 && rect.height > 0;
      });
      const rect = element.getBoundingClientRect(); return rect.width > 0 && rect.height > 0;
    };
    const enabled = element => {
      if (element.matches(":disabled")) return false;
      for (let node = element; node; node = node.parentElement) {
        const value = node.getAttribute("aria-disabled");
        if (value === "false") break;
        if (value === "true") return false;
      }
      return true;
    };
    criteria.forEach((item, index) => {
      const fail = condition => failures.push({ index, condition });
      if (item.urlContains !== undefined && !location.href.includes(item.urlContains)) fail("url");
      if (!item.target) return;
      let elements = [...document.querySelectorAll(item.target.css)];
      if (item.target.nth !== undefined) elements = elements.slice(item.target.nth, item.target.nth + 1);
      if (elements.some(element => !element.isConnected)) { fail("detached"); return; }
      if (item.count !== undefined && elements.length !== item.count) fail("count");
      const checks = ["visible", "enabled", "value", "textContains", "attribute", "checked"].some(key => item[key] !== undefined)
        || item.nonEmpty === true || item.imageLoaded === true;
      if (!checks) return;
      if (elements.length === 0 && item.visible === false && item.enabled === undefined && item.value === undefined
        && item.nonEmpty !== true && item.textContains === undefined && !item.attribute && item.checked === undefined) return;
      if (elements.length !== 1) { fail("strict-cardinality"); return; }
      const element = elements[0];
      if (item.visible !== undefined && visible(element) !== item.visible) fail("visible");
      if (item.enabled !== undefined && enabled(element) !== item.enabled) fail("enabled");
      if (item.value !== undefined && element.value !== item.value) fail("value");
      if (item.nonEmpty === true && (typeof element.value !== "string" || !element.value.trim())) fail("nonEmpty");
      if (item.textContains !== undefined && !element.textContent?.includes(item.textContains)) fail("textContains");
      if (item.attribute && element.getAttribute(item.attribute.name) !== item.attribute.value) fail("attribute");
      if (item.checked !== undefined && element.checked !== item.checked) fail("checked");
      if (item.imageLoaded === true && (!(element instanceof HTMLImageElement) || !element.complete || element.naturalWidth <= 0)) fail("imageLoaded");
    });
    return { at: performance.timeOrigin + performance.now(), failures, inspectionMs: performance.now() - started };
  };
  if (operation === "snapshot") return inspect();
  const watchers = window.__qaAtomicReadiness ??= new Map();
  if (operation === "result") {
    const watcher = watchers.get(id);
    if (!watcher) return null; // A full document navigation destroys the old realm.
    return watcher.promise.then(result => { watchers.delete(id); return result; });
  }
  if (operation !== "arm" || watchers.has(id)) throw new Error("Invalid atomic readiness operation");
  // Validate all CSS before the action; invalid selectors must never look ready.
  inspect();
  let finish, timer, frame, candidate = null, consecutive = 0, last = null;
  let probes = 0, inspectionMs = 0, actionAt = null, formSaved = null;
  const promise = new Promise(resolve => { finish = resolve; });
  watchers.set(id, { promise });
  const complete = result => {
    clearTimeout(timer); cancelAnimationFrame(frame);
    removeEventListener(eventType, onAction, true);
    document.removeEventListener("admin-form-saved", onSaved, true);
    finish({ ...result, probes, inspectionMs, actionAt, formSaved });
  };
  const tick = () => {
    try {
      last = inspect(); probes++; inspectionMs += last.inspectionMs;
      if (requireFormSaved && !formSaved) last.failures.push({ condition: "fresh-committed-form-event" });
      if (last.failures.length === 0) {
        candidate ??= last.at; consecutive++;
        if (consecutive === 3) { complete({ firstReadyAt: candidate, confirmedAt: last.at, failures: [] }); return; }
      } else { candidate = null; consecutive = 0; }
      frame = requestAnimationFrame(tick);
    } catch (error) { complete({ error: error.message, failures: [{ condition: "probe-error" }] }); }
  };
  const onAction = event => {
    if (!event.isTrusted || actionAt !== null) return;
    actionAt = performance.timeOrigin + performance.now();
    removeEventListener(eventType, onAction, true);
    frame = requestAnimationFrame(tick);
  };
  const onSaved = event => {
    if (actionAt === null || !requireFormSaved) return;
    if (String(event.detail?.entityId) !== String(requireFormSaved.entityId) || !event.detail?.savedRevision) return;
    formSaved = { at: performance.timeOrigin + performance.now(), entityId: event.detail.entityId, savedRevision: event.detail.savedRevision };
  };
  addEventListener(eventType, onAction, { capture: true, passive: true });
  document.addEventListener("admin-form-saved", onSaved, { capture: true, passive: true });
  timer = setTimeout(() => complete({ error: "Atomic readiness deadline expired", failures: [...(last?.failures ?? []), { condition: actionAt === null ? "no-trusted-action" : "readiness-deadline" }] }), 45_000);
  return { id, armedAt: performance.timeOrigin + performance.now() };
}
