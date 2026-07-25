import type { PublicMediaFolderListing } from "./media-library-paths";

export type MediaStorageProvider = "filesystem" | "supabase";

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
  Pick<NodeJS.ProcessEnv, "CMS_STORAGE_UPLOADS" | "NODE_ENV" | "VERCEL" | "VERCEL_ENV">
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
  // Vercel/production must never fall back to the deployment filesystem.
  if (isProductionMediaRuntime(environment)) return "supabase";
  return environment.CMS_STORAGE_UPLOADS === "supabase" ? "supabase" : "filesystem";
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
