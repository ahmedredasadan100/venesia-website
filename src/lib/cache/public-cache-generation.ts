import "server-only";

import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { getSupabaseAdmin } from "../supabase-admin";

type CacheOptions = Parameters<typeof unstable_cache>[2];
type AsyncRead = Parameters<typeof unstable_cache>[0];

export class PublicCachePrimaryOriginError extends Error {
  constructor() {
    super("Public cache reads require the direct primary Supabase origin.");
    this.name = "PublicCachePrimaryOriginError";
  }
}

/** Reject replica/load-balancer/proxy routing before any availability fallback. */
export function publicCachePrimaryOrigin(raw = process.env.NEXT_PUBLIC_SUPABASE_URL): string {
  let url: URL;
  try { url = new URL(raw?.trim() ?? ""); } catch { throw new PublicCachePrimaryOriginError(); }
  const plainOrigin = !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash;
  const hostedPrimary = url.protocol === "https:" && !url.port && /^[a-z]{20}\.supabase\.co$/u.test(url.hostname);
  // Production-mode local builds still use the existing owned isolated gateway.
  const localPrimary = !process.env.VERCEL && url.protocol === "http:"
    && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) && Boolean(url.port);
  if (!plainOrigin || (!hostedPrimary && !localPrimary)) throw new PublicCachePrimaryOriginError();
  return url.origin;
}

function generationText(value: unknown): string | null {
  return typeof value === "string" && /^(0|[1-9][0-9]{0,18})$/u.test(value)
    && BigInt(value) <= BigInt("9223372036854775807") ? value : null;
}

/** A missing rollout migration or unavailable fence means a direct, uncached read. */
export async function readPublicCacheGeneration(): Promise<string | null> {
  const origin = publicCachePrimaryOrigin();
  try {
    const { data } = await getSupabaseAdmin().rpc("read_public_cache_generation").throwOnError();
    const generation = generationText(data);
    return generation === null ? null : createHash("sha256").update(origin).digest("hex") + ":" + generation;
  } catch (error) {
    unstable_rethrow(error);
    if (error && typeof error === "object" && "code" in error && error.code === "25006") {
      throw new PublicCachePrimaryOriginError();
    }
    if (error instanceof PublicCachePrimaryOriginError) throw error;
    return null;
  }
}

/** Must only run after the domain transaction commits. Retrying advances safely. */
export async function advancePublicCacheGeneration(): Promise<void> {
  publicCachePrimaryOrigin();
  const { data, error } = await getSupabaseAdmin().rpc("advance_public_cache_generation");
  if (error?.code === "25006") throw new PublicCachePrimaryOriginError();
  if (error || generationText(data) === null) {
    throw new Error("Public cache invalidation generation was not acknowledged.");
  }
}

export function publicCacheGenerationKeyParts(keyParts: string[] | undefined, generation: string): string[] {
  return [...(keyParts ?? []), "public-invalidation-generation-v1", generation];
}

/**
 * One shared fence for production and the real-adapter verification fixture.
 * A failed lookup never reads or fills a persistent key. Nested readers fence
 * themselves, so a direct outer fallback needs no process/request-local bypass.
 */
export function createGenerationFencedCache(
  readGeneration: () => Promise<string | null>,
  persistentCache: typeof unstable_cache = unstable_cache,
) {
  return function fencedCache<T extends AsyncRead>(callback: T, keyParts?: string[], options?: CacheOptions): T {
    return (async (...args: Parameters<T>) => {
      const generation = await readGeneration();
      if (generation === null) return callback(...args);
      return persistentCache(callback, publicCacheGenerationKeyParts(keyParts, generation), options)(...args);
    }) as T;
  };
}

// React-cached child values and every outer persistent key must share one render
// generation. A later request reads again; outside a React render cache() is a no-op.
const readRequestPublicCacheGeneration = cache(readPublicCacheGeneration);
export const cachePublicRead = createGenerationFencedCache(readRequestPublicCacheGeneration);
