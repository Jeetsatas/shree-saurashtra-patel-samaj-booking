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
  options?: { forceRefresh?: boolean; ttlMs?: number }
): Promise<T> {
  // If not forcing refresh, check if valid unexpired cache exists for static routes
  const isStatic =
    url.includes("/api/facilities") ||
    url.includes("/api/discounts") ||
    url.includes("/api/services") ||
    url.includes("/api/settings");

  const effectiveTtl = options?.ttlMs ?? (isStatic ? STATIC_TTL_MS : 0);

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
    try {
      const response = await fetch(url, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || `Request failed (${response.status})`);
      }
      setAdminCachedData(url, data);
      return data as T;
    } finally {
      inFlightRequests.delete(url);
    }
  })();

  inFlightRequests.set(url, fetchPromise);
  return fetchPromise;
}
