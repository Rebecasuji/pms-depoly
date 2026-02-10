/**
 * API client helper with caching, request deduplication, and automatic Bearer token injection
 * Features:
 * - Automatic Bearer token from localStorage
 * - Response caching for GET requests (5 min default)
 * - Request deduplication (prevents duplicate in-flight requests)
 * - Automatic cache invalidation on POST/PUT/DELETE
 */

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

const cache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<Response>>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes default

/**
 * Clear all cached data (useful on logout or data refresh)
 */
export const clearApiCache = () => {
  cache.clear();
};

/**
 * Invalidate specific cache entry
 */
export const invalidateCache = (url: string) => {
  cache.delete(url);
};

/**
 * Main API fetch with caching and deduplication
 */
export const apiFetch = (url: string, opts?: RequestInit) => {
  const token = localStorage.getItem("knockturn_token");
  const headers = {
    ...(opts?.headers || {}),
    Authorization: token ? `Bearer ${token}` : "",
  } as Record<string, string>;

  const method = (opts?.method || "GET").toUpperCase();
  const isGetRequest = method === "GET";
  
  // Check cache for GET requests
  if (isGetRequest && cache.has(url)) {
    const entry = cache.get(url)!;
    if (Date.now() - entry.timestamp < entry.ttl) {
      return Promise.resolve(new Response(JSON.stringify(entry.data), { 
        status: 200,
        headers: { "Content-Type": "application/json" }
      }));
    } else {
      cache.delete(url);
    }
  }

  // Deduplicate in-flight requests
  if (isGetRequest && inFlightRequests.has(url)) {
    // Return a cloned Response for each duplicate consumer so callers can
    // independently call `response.json()` without consuming the same body stream.
    return inFlightRequests.get(url)!.then((r) => r.clone());
  }

  // Invalidate cache on mutations
  if (!isGetRequest) {
    cache.clear(); // Clear all cache on any write operation
  }

  const fetchPromise = fetch(url, { ...opts, headers })
    .then(async (response) => {
      // Cache successful GET responses
      if (isGetRequest && response.ok && response.status === 200) {
        const data = await response.clone().json().catch(() => null);
        if (data) {
          cache.set(url, {
            data,
            timestamp: Date.now(),
            ttl: CACHE_TTL,
          });
        }
      }
      return response;
    })
    .finally(() => {
      // Remove from in-flight tracking
      inFlightRequests.delete(url);
    });

  // Track in-flight request
  if (isGetRequest) {
    inFlightRequests.set(url, fetchPromise);
  }

  return fetchPromise;
};
