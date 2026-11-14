const adminClientCache = new Map<string, unknown>();

export function getAdminCachedData<T>(key: string): T | undefined {
  if (typeof window === "undefined") return undefined;
  return adminClientCache.get(key) as T | undefined;
}

export function setAdminCachedData<T>(key: string, value: T): void {
  adminClientCache.set(key, value);
}

export function clearAdminClientCache(): void {
  adminClientCache.clear();
}

export async function fetchAdminJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status})`);
  }
  setAdminCachedData(url, data);
  return data as T;
}
