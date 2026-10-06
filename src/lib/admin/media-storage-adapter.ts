import type { PublicMediaFolderListing, PublicMediaInventory } from "./media-library-paths";

export type MediaStorageProvider = "filesystem" | "supabase";

export type MediaRuntimeEnvironment = "local" | "preview" | "production";

export type MediaStorageRuntimeContext = {
  provider: "supabase";
  environment: MediaRuntimeEnvironment;
  projectReference: string | null;
  identity: string | null;
};

export type MediaUploadOptions = {
  replacePath?: string | null;
};

export type MediaUploadResult = {
  path: string;
  filename: string;
  storagePath?: string;
  provider?: MediaStorageProvider;
  bucket?: string;
  objectKey?: string;
  kind?: "image" | "document";
  contentType?: string | null;
  sizeBytes?: number | null;
};

export type MediaDeleteResult = {
  path: string;
  storagePath: string;
};

export interface MediaStorageAdapter {
  readonly provider: MediaStorageProvider;
  listFolder(folder?: string): Promise<PublicMediaFolderListing>;
  listInventory(): Promise<PublicMediaInventory>;
  listImagePaths(folder?: string, limit?: number): Promise<string[]>;
  uploadImage(folder: string, file: File, options?: MediaUploadOptions): Promise<MediaUploadResult>;
  uploadDocument(folder: string, file: File, options?: MediaUploadOptions): Promise<MediaUploadResult>;
  isManagedAsset(value: string): boolean;
  deleteAsset(value: string): Promise<MediaDeleteResult>;
}

export class MediaStorageError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 500) {
    super(message);
    this.name = "MediaStorageError";
    this.code = code;
    this.status = status;
  }
}

type MediaStorageEnvironment = Partial<
  Pick<
    NodeJS.ProcessEnv,
    | "NODE_ENV"
    | "VERCEL"
    | "VERCEL_ENV"
    | "NEXT_PUBLIC_SUPABASE_URL"
    | "SUPABASE_URL"
    | "SUPABASE_PROJECT_REF"
  >
>;

export function isProductionMediaRuntime(environment: MediaStorageEnvironment = process.env) {
  return (
    environment.NODE_ENV === "production" ||
    environment.VERCEL === "1" ||
    environment.VERCEL_ENV === "production" ||
    environment.VERCEL_ENV === "preview"
  );
}

export function resolveMediaStorageProvider(
  environment: MediaStorageEnvironment = process.env,
): MediaStorageProvider {
  // Supabase is the only managed provider. The local filesystem is exposed
  // separately as a read-only compatibility inventory in local development.
  void environment;
  return "supabase";
}

export function resolveMediaRuntimeEnvironment(
  environment: MediaStorageEnvironment = process.env,
): MediaRuntimeEnvironment {
  if (environment.VERCEL_ENV === "preview") return "preview";
  if (isProductionMediaRuntime(environment)) return "production";
  return "local";
}

export function resolveMediaStorageRuntimeContext(
  environment: MediaStorageEnvironment = process.env,
): MediaStorageRuntimeContext {
  // Catalog and Storage share this exact client endpoint. Execution labels
  // (NODE_ENV / VERCEL_ENV) cannot partition a singleton in the same database.
  // Keep the hosted namespace compatible with existing production baselines.
  const provider = "supabase" as const;
  const rawUrl = environment.NEXT_PUBLIC_SUPABASE_URL?.trim();
  let target: URL | null = null;
  try {
    if (rawUrl) target = new URL(rawUrl);
  } catch { /* An unproven target must remain unusable by Catalog guards. */ }
  const loopback = target?.hostname === "localhost" || target?.hostname === "127.0.0.1";
  const hosted = target?.protocol === "https:" && target.pathname === "/"
    && !target.port && !target.username && !target.password && !target.search && !target.hash
    ? /^([a-z0-9-]+)\.supabase\.co$/.exec(target.hostname)?.[1] ?? null
    : null;
  const local = loopback && target?.protocol === "http:" && target.pathname === "/"
    && !target.username && !target.password && !target.search && !target.hash
    ? target.host : null;
  const targetEnvironment = local ? "local" : "production";
  const projectReference = hosted ?? local;
  return {
    provider,
    environment: targetEnvironment,
    projectReference,
    identity: projectReference ? `${targetEnvironment}:${provider}:${projectReference}` : null,
  };
}

export function shouldIncludeLocalFilesystemReadThrough(
  environment: MediaStorageEnvironment = process.env,
) {
  return resolveMediaRuntimeEnvironment(environment) === "local";
}

export function getPublicMediaStorageError(
  error: unknown,
  fallbackMessage: string,
  fallbackStatus = 500,
) {
  if (error instanceof MediaStorageError) {
    return { message: error.message, status: error.status, code: error.code };
  }

  return {
    message: fallbackMessage,
    status: fallbackStatus,
    code: "media_storage_error",
  };
}
