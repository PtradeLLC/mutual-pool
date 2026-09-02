import { auth } from './firebase';

// Helper to get active user ID from local state / storage
export function getActiveUserId(): string | null {
  if (auth.currentUser?.uid) {
    return auth.currentUser.uid;
  }
  try {
    const saved = localStorage.getItem('mutualpool_active_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed?.id || null;
    }
  } catch {
    // Ignore error
  }
  return null;
}

// Generate auth headers including Firebase ID token if authenticated
export async function getAuthHeaders(customHeaders?: HeadersInit): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};

  // Copy custom headers if any
  if (customHeaders) {
    if (customHeaders instanceof Headers) {
      customHeaders.forEach((val, key) => {
        headers[key] = val;
      });
    } else if (Array.isArray(customHeaders)) {
      for (const [k, v] of customHeaders) {
        headers[k] = v;
      }
    } else {
      Object.assign(headers, customHeaders);
    }
  }

  // Inject Firebase ID Token if user is logged in
  if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (err) {
      console.warn('[apiClient] Failed to obtain Firebase ID token:', err);
    }
  }

  // Inject x-user-id for backward compatibility
  if (!headers['x-user-id']) {
    const uId = getActiveUserId();
    if (uId) {
      headers['x-user-id'] = uId;
    }
  }

  return headers;
}

// Authenticated fetch wrapper
export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const headers = await getAuthHeaders(init?.headers);

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    if (!headers['Content-Type'] && !(init?.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    if (!headers['Idempotency-Key']) {
      headers['Idempotency-Key'] = `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
  }

  return fetch(input, {
    ...init,
    headers,
  });
}

// Global fetch interceptor to guarantee token injection for all /api calls
let interceptorInstalled = false;

export function installFetchInterceptor(): void {
  if (typeof window === 'undefined' || interceptorInstalled) return;
  interceptorInstalled = true;

  try {
    const nativeFetch = window.fetch ? window.fetch.bind(window) : null;
    if (!nativeFetch) return;

    const wrappedFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      let url = '';
      if (typeof input === 'string') {
        url = input;
      } else if (input instanceof URL) {
        url = input.toString();
      } else if (input && typeof (input as any).url === 'string') {
        url = (input as any).url;
      }

      // Only intercept requests directed to our /api endpoints
      if (url.startsWith('/api/') || url.includes('/api/')) {
        const currentHeaders = new Headers(init?.headers || (input instanceof Request ? input.headers : {}));

        // Inject Firebase ID token
        if (!currentHeaders.has('Authorization') && auth.currentUser) {
          try {
            const token = await auth.currentUser.getIdToken();
            if (token) {
              currentHeaders.set('Authorization', `Bearer ${token}`);
            }
          } catch {}
        }

        // Inject x-user-id
        if (!currentHeaders.has('x-user-id')) {
          const uId = getActiveUserId();
          if (uId) {
            currentHeaders.set('x-user-id', uId);
          }
        }

        // Inject Idempotency-Key for mutations
        const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !currentHeaders.has('Idempotency-Key')) {
          currentHeaders.set('Idempotency-Key', `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
        }

        return nativeFetch(input, {
          ...init,
          headers: currentHeaders,
        });
      }

      return nativeFetch(input, init);
    };

    // Safely assign wrapped fetch, falling back to Object.defineProperty or ignoring if read-only
    try {
      (window as any).fetch = wrappedFetch;
    } catch {
      try {
        Object.defineProperty(window, 'fetch', {
          value: wrappedFetch,
          writable: true,
          configurable: true,
        });
      } catch (defineErr) {
        console.warn('[apiClient] window.fetch is read-only in this environment:', defineErr);
      }
    }
  } catch (err) {
    console.warn('[apiClient] Failed to install fetch interceptor:', err);
  }
}
