/**
 * Behavioral matrix for presence vs renderable flags (mirrors Phase 1B contracts).
 */
function deriveFlags({ rowCount, renderableCount, queryError }) {
  const hasAnyAssignmentRows = rowCount > 0;
  const hasRenderableModules = renderableCount > 0;
  const hasCompositionError = Boolean(queryError);
  return {
    hasAnyAssignmentRows,
    hasRenderableModules,
    hasCompositionError,
    useCmsLayout: hasAnyAssignmentRows || hasCompositionError,
    useStaticShell: !hasAnyAssignmentRows && !hasCompositionError,
  };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Virgin page
{
  const f = deriveFlags({ rowCount: 0, renderableCount: 0, queryError: false });
  assert(f.useStaticShell === true, "virgin → static shell");
  assert(f.useCmsLayout === false, "virgin → not CMS layout");
}

// All hidden
{
  const f = deriveFlags({ rowCount: 3, renderableCount: 0, queryError: false });
  assert(f.useCmsLayout === true, "hidden rows → CMS layout");
  assert(f.useStaticShell === false, "hidden rows → no static resurrect");
  assert(f.hasRenderableModules === false, "hidden → nothing renderable");
}

// Draft-only
{
  const f = deriveFlags({ rowCount: 2, renderableCount: 0, queryError: false });
  assert(f.useCmsLayout === true, "draft-only → CMS layout");
  assert(f.useStaticShell === false, "draft-only → no static resurrect");
}

// Published visible
{
  const f = deriveFlags({ rowCount: 2, renderableCount: 1, queryError: false });
  assert(f.useCmsLayout === true && f.hasRenderableModules === true, "visible published → CMS + render");
}

// Query error with no rows observed
{
  const f = deriveFlags({ rowCount: 0, renderableCount: 0, queryError: true });
  assert(f.hasCompositionError === true, "error flag set");
  assert(f.useStaticShell === false, "error must not look like virgin static");
}

console.log("verify-assignment-presence-behavior OK");
