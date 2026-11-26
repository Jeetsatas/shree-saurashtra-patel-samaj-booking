interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const adminClientCache = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<any>>();

// Default cache TTL for static metadata (facilities, discounts, services): 60 seconds
const STATIC_TTL_MS = 60 * 1000;

export function getAdminCachedData<T>(key: string): T | undefined {
  if (typeof window === "undefined") return undefined;
  const entry = adminClientCache.get(key);
  return entry ? (entry.data as T) : undefined;
}

export function setAdminCachedData<T>(key: string, value: T): void {
  adminClientCache.set(key, { data: value, timestamp: Date.now() });
}

export function clearAdminClientCache(): void {
  adminClientCache.clear();
  inFlightRequests.clear();
}

export async function fetchAdminJson<T>(
  url: string,
  options?: { forceRefresh?: boolean; ttlMs?: number; retries?: number }
): Promise<T> {
  const isStatic =
    url.includes("/api/facilities") ||
    url.includes("/api/discounts") ||
    url.includes("/api/services") ||
    url.includes("/api/settings") ||
    url.includes("/api/auth/me");

  const effectiveTtl = options?.ttlMs ?? (isStatic ? STATIC_TTL_MS : 0);

  // Return unexpired cache if available and not forcing refresh
  if (!options?.forceRefresh && effectiveTtl > 0) {
    const cached = adminClientCache.get(url);
    if (cached && Date.now() - cached.timestamp < effectiveTtl) {
      return cached.data as T;
    }
  }

  // Deduplicate in-flight requests to avoid concurrent duplicate network fetches
  if (inFlightRequests.has(url)) {
    return inFlightRequests.get(url) as Promise<T>;
  }

  const fetchPromise = (async () => {
    let lastError: any = null;
    const maxAttempts = options?.retries ?? 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(url, { cache: "no-store" });
        const contentType = response.headers.get("content-type") || "";

        let data: any = null;
        if (contentType.includes("application/json")) {
          data = await response.json();
        } else {
          // If server returned HTML (e.g. 504 / 500 Vercel error page), avoid SyntaxError
          const text = await response.text();
          if (!response.ok) {
            throw new Error(`Server returned status ${response.status}`);
          }
          try {
            data = JSON.parse(text);
          } catch {
            throw new Error(`Invalid response format from server (${response.status})`);
          }
        }

        if (!response.ok) {
          throw new Error(data?.error || `Request failed (${response.status})`);
        }

        setAdminCachedData(url, data);
        return data as T;
      } catch (err: any) {
        lastError = err;
        if (attempt < maxAttempts) {
          // Wait briefly before retry to ride out transient cold-start or connection blip
          await new Promise((r) => setTimeout(r, 400 * attempt));
        }
      }
    }

    // Fallback gracefully to stale cached data if all attempts fail so UI never goes blank
    const fallbackCached = adminClientCache.get(url);
    if (fallbackCached?.data) {
      console.warn(`[admin-client-cache] Falling back to cached data for ${url} after error:`, lastError);
      return fallbackCached.data as T;
    }

    throw lastError;
  })().finally(() => {
    inFlightRequests.delete(url);
  });

  inFlightRequests.set(url, fetchPromise);
  return fetchPromise;
}
