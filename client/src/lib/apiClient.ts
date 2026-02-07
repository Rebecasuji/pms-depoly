/**
 * API client helper that automatically includes the Bearer token from localStorage
 */
export const apiFetch = (url: string, opts?: RequestInit) => {
  const token = localStorage.getItem("knockturn_token");
  const headers = {
    ...(opts?.headers || {}),
    Authorization: token ? `Bearer ${token}` : "",
  } as Record<string, string>;
  return fetch(url, { ...opts, headers });
};
