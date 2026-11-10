// API Client Wrapper with unified error handling and environment derivation

export class ApiError extends Error {
  constructor(message, status, details = null, timeNs = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.timeNs = timeNs;
  }
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const API_KEY = import.meta.env.VITE_API_KEY || '';

/**
 * Universal fetch request wrapper.
 * @param {string} path - Target path or full URL.
 * @param {object} options - Request options { method, body, params, headers }.
 */
export async function request(path, { method = 'GET', body, params, headers = {} } = {}) {
  const base = API_BASE_URL.replace(/\/$/, '');
  const cleanPath = path.startsWith('http') ? path : `${base}/${path.replace(/^\//, '')}`;
  const url = new URL(cleanPath);

  // Build query parameters, skipping empty, null, or undefined values
  if (params && typeof params === 'object') {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.append(key, String(value));
      }
    });
  }

  const reqHeaders = { ...headers };
  if (API_KEY) {
    reqHeaders['X-API-Key'] = API_KEY;
  }

  const fetchOptions = {
    method,
    headers: reqHeaders,
  };

  if (body !== undefined && body !== null) {
    reqHeaders['Content-Type'] = 'application/json';
    fetchOptions.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url.toString(), fetchOptions);
  } catch {
    throw new ApiError('Cannot reach the server. Please check your connection.', 0);
  }

  if (response.status === 204) {
    return null;
  }

  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const message = (data && data.error) ? data.error : `Request failed with status ${response.status}`;
    const details = (data && data.details) ? data.details : null;
    const timeNs = (data && data.time_ns) ? data.time_ns : null;
    throw new ApiError(message, response.status, details, timeNs);
  }

  return data;
}

/**
 * Derives the WebSocket URL from VITE_WS_URL or VITE_API_URL, appending optional api_key.
 */
export function getWebSocketUrl() {
  if (import.meta.env.VITE_WS_URL) {
    let wsUrl = import.meta.env.VITE_WS_URL;
    if (API_KEY && !wsUrl.includes('api_key=')) {
      wsUrl += (wsUrl.includes('?') ? '&' : '?') + `api_key=${encodeURIComponent(API_KEY)}`;
    }
    return wsUrl;
  }

  const wsBase = API_BASE_URL.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:').replace(/\/$/, '');
  let wsUrl = `${wsBase}/ws/alerts`;
  if (API_KEY) {
    wsUrl += `?api_key=${encodeURIComponent(API_KEY)}`;
  }
  return wsUrl;
}
