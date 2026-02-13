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
  // Only include Authorization header when we actually have a token
  const headers = {
    ...(opts?.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  } as Record<string, string>;

  const method = (opts?.method || "GET").toUpperCase();
  const isGetRequest = method === "GET";
  
  console.log(`[API] ${method} ${url}`, { hasToken: !!token });
  
  // Check cache for GET requests
  if (isGetRequest && cache.has(url)) {
    const entry = cache.get(url)!;
    if (Date.now() - entry.timestamp < entry.ttl) {
      console.log(`[API] Cache hit for ${url}`);
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
    console.log(`[API] Deduplicating in-flight request for ${url}`);
    // Wait for the in-flight request to complete and return a fresh Response
    // built from the cached JSON if available (avoids clone/bodyUsed races).
    return inFlightRequests.get(url)!.then(async (r) => {
      if (cache.has(url)) {
        const entry = cache.get(url)!;
        return new Response(JSON.stringify(entry.data), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      try {
        // Best-effort clone; if clone fails, return original response as fallback
        return r.clone();
      } catch (e) {
        return r;
      }
    });
  }

  // Invalidate cache on mutations
  if (!isGetRequest) {
    cache.clear(); // Clear all cache on any write operation
  }

  const fetchPromise = fetch(url, { ...opts, headers })
    .then(async (response) => {
      console.log(`[API] Response for ${method} ${url}:`, response.status, response.statusText);

      // Global handling for unauthorized responses: remove invalid token and redirect
      if (response.status === 401) {
        console.warn(`[API] 401 Unauthorized for ${url} — clearing token and redirecting to /login`);
        try {
          localStorage.removeItem("knockturn_token");
          cache.clear();
        } catch (e) {
          /* ignore */
        }
        if (typeof window !== "undefined") {
          // navigate the SPA to the login screen
          window.location.href = "/login";
        }
        return response;
      }

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
    .catch((err) => {
      console.error(`[API] Network error for ${method} ${url}:`, err);
      throw err;
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
