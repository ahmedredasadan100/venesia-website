export type AdminFormControlSnapshot =
  | {
      kind: "input";
      element: HTMLInputElement;
      value: string;
      checked: boolean;
      indeterminate: boolean;
      files: readonly File[] | null;
    }
  | {
      kind: "textarea";
      element: HTMLTextAreaElement;
      value: string;
    }
  | {
      kind: "select";
      element: HTMLSelectElement;
      selected: readonly boolean[];
    };

export function serializeAdminForm(form: HTMLFormElement) {
  const serverOwnedNames = new Set(
    Array.from(form.elements).flatMap((element) => {
      if (!element.hasAttribute("data-admin-form-server-owned")) return [];
      const name = element.getAttribute("name");
      return name ? [name] : [];
    }),
  );

  return JSON.stringify(
    Array.from(new FormData(form).entries())
      .filter(([name]) => !serverOwnedNames.has(name))
      .map(([name, value]) => [
        name,
        typeof value === "string"
          ? value
          : `${value.name}:${value.size}:${value.type}:${value.lastModified}`,
      ]),
  );
}

/**
 * React resets uncontrolled controls after a function-valued form action is
 * dispatched. Capture every resettable control before that reset so an
 * expected action error can keep the submitted DOM intact.
 */
export function captureAdminFormControls(
  form: HTMLFormElement,
): AdminFormControlSnapshot[] {
  const snapshot: AdminFormControlSnapshot[] = [];

  for (const element of Array.from(form.elements)) {
    if (element instanceof HTMLInputElement) {
      snapshot.push({
        kind: "input",
        element,
        value: element.value,
        checked: element.checked,
        indeterminate: element.indeterminate,
        files:
          element.type === "file" ? Array.from(element.files ?? []) : null,
      });
      continue;
    }

    if (element instanceof HTMLTextAreaElement) {
      snapshot.push({ kind: "textarea", element, value: element.value });
      continue;
    }

    if (element instanceof HTMLSelectElement) {
      snapshot.push({
        kind: "select",
        element,
        selected: Array.from(element.options, (option) => option.selected),
      });
    }
  }

  return snapshot;
}

/** Restore a snapshot without emitting synthetic input/change events. */
export function restoreAdminFormControls(
  form: HTMLFormElement,
  snapshot: readonly AdminFormControlSnapshot[],
  options: { preserveServerOwned?: boolean } = {},
) {
  for (const entry of snapshot) {
    if (entry.element.form !== form) continue;
    if (
      options.preserveServerOwned &&
      entry.element.hasAttribute("data-admin-form-server-owned")
    ) {
      continue;
    }

    if (entry.kind === "input") {
      if (entry.element.type === "file") {
        if (typeof DataTransfer === "undefined") continue;
        try {
          const transfer = new DataTransfer();
          for (const file of entry.files ?? []) transfer.items.add(file);
          entry.element.files = transfer.files;
        } catch {
          // Some browsers do not permit assigning FileList. The other form
          // controls still restore safely; the upload can be selected again.
        }
        continue;
      }

      entry.element.value = entry.value;
      entry.element.checked = entry.checked;
      entry.element.indeterminate = entry.indeterminate;
      continue;
    }

    if (entry.kind === "textarea") {
      entry.element.value = entry.value;
      continue;
    }

    Array.from(entry.element.options).forEach((option, index) => {
      option.selected = entry.selected[index] ?? false;
    });
  }
}
