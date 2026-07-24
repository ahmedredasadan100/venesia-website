import { isProtectedRedirectPath } from "./protected-paths";
import {
  normalizeInternalRedirectPath,
  normalizeRedirectDestination,
} from "./normalize-redirect-path";
import type { RedirectType, UrlRedirectRecord } from "./redirect-types";

export type RedirectValidationInput = {
  sourcePath: string;
  destinationPath: string;
  redirectType: string;
  status: string;
  excludeId?: number;
};

export type RedirectValidationResult =
  | {
      ok: true;
      sourcePath: string;
      destinationPath: string;
      redirectType: RedirectType;
      status: "active" | "inactive";
    }
  | {
      ok: false;
      error: string;
      field:
        | "sourcePath"
        | "destinationPath"
        | "redirectType"
        | "status";
    };

function pathsEqual(left: string, right: string) {
  return left === right;
}

function destinationComparable(destination: string) {
  if (destination.startsWith("http://") || destination.startsWith("https://")) {
    try {
      const url = new URL(destination);
      return url.pathname + (url.search || "");
    } catch {
      return destination;
    }
  }
  return destination;
}

export function detectRedirectLoop(
  sourcePath: string,
  destinationPath: string,
  activeRedirects: Array<Pick<UrlRedirectRecord, "source_path" | "destination_path">>,
) {
  if (pathsEqual(sourcePath, destinationComparable(destinationPath))) {
    return "لا يمكن أن تكون الوجهة مطابقة للمصدر.";
  }

  const reverse = activeRedirects.find(
    (rule) =>
      rule.source_path === destinationComparable(destinationPath) &&
      destinationComparable(rule.destination_path) === sourcePath,
  );
  if (reverse) {
    return "هذا التحويل يُنشئ حلقة مباشرة مع تحويل موجود.";
  }

  const redirectMap = new Map<string, string>();
  for (const rule of activeRedirects) {
    redirectMap.set(rule.source_path, rule.destination_path);
  }
  redirectMap.set(sourcePath, destinationPath);

  let current = destinationPath;
  const visited = new Set<string>([sourcePath]);

  for (let hop = 0; hop < 12; hop += 1) {
    const comparable = destinationComparable(current);
    if (comparable === sourcePath) {
      return "هذا التحويل يُنشئ حلقة مع تحويلات أخرى.";
    }
    if (visited.has(comparable)) {
      break;
    }
    visited.add(comparable);

    const next = redirectMap.get(comparable);
    if (!next) break;
    current = next;
  }

  return null;
}

export function validateRedirectInput(
  input: RedirectValidationInput,
  activeRedirects: Array<Pick<UrlRedirectRecord, "id" | "source_path" | "destination_path" | "status">>,
): RedirectValidationResult {
  const source = normalizeInternalRedirectPath(input.sourcePath);
  if (!source.ok) {
    return { ...source, field: "sourcePath" };
  }

  if (isProtectedRedirectPath(source.value)) {
    return {
      ok: false,
      error: "لا يمكن تحويل مسارات الإدارة أو النظام.",
      field: "sourcePath",
    };
  }

  const destination = normalizeRedirectDestination(input.destinationPath);
  if (!destination.ok) {
    return { ...destination, field: "destinationPath" };
  }

  if (destination.kind === "internal" && isProtectedRedirectPath(destination.value)) {
    return {
      ok: false,
      error: "لا يمكن التحويل إلى مسارات الإدارة أو النظام.",
      field: "destinationPath",
    };
  }

  if (input.redirectType !== "301" && input.redirectType !== "302") {
    return {
      ok: false,
      error: "نوع التحويل غير صالح.",
      field: "redirectType",
    };
  }

  if (input.status !== "active" && input.status !== "inactive") {
    return {
      ok: false,
      error: "حالة التحويل غير صالحة.",
      field: "status",
    };
  }

  const comparableDestination =
    destination.kind === "internal" ? destination.value : destination.value;

  if (pathsEqual(source.value, destinationComparable(comparableDestination))) {
    return {
      ok: false,
      error: "لا يمكن أن تكون الوجهة مطابقة للمصدر.",
      field: "destinationPath",
    };
  }

  const duplicateSource = activeRedirects.find(
    (rule) => rule.source_path === source.value && rule.id !== input.excludeId,
  );
  if (duplicateSource) {
    return {
      ok: false,
      error: "مسار المصدر مستخدم بالفعل.",
      field: "sourcePath",
    };
  }

  if (input.status === "active") {
    const rulesForLoop = activeRedirects
      .filter((rule) => rule.status === "active" && rule.id !== input.excludeId)
      .map((rule) => ({
        source_path: rule.source_path,
        destination_path: rule.destination_path,
      }));

    const loopError = detectRedirectLoop(source.value, comparableDestination, rulesForLoop);
    if (loopError) {
      return {
        ok: false,
        error: loopError,
        field: "destinationPath",
      };
    }
  }

  return {
    ok: true,
    sourcePath: source.value,
    destinationPath: comparableDestination,
    redirectType: input.redirectType,
    status: input.status,
  };
}
