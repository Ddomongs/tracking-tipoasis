import NodeCache from "node-cache";

const WINDOW_SECONDS = 60;
const MAX_REQUESTS_PER_WINDOW = 60;
const MAX_GLOBAL_REQUESTS_PER_WINDOW = 600;
const MAX_CONCURRENT_REQUESTS = 20;
const MAX_CLIENT_KEYS = 5000;

const requestCounts = new NodeCache({
  stdTTL: WINDOW_SECONDS,
  checkperiod: WINDOW_SECONDS,
  useClones: false
});

let activeRequests = 0;
let globalWindowStartedAt = Date.now();
let globalRequestCount = 0;

const clientKey = (request: Request): string => {
  const vercelForwarded = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const direct = request.headers.get("x-real-ip")?.trim();
  return (vercelForwarded || direct || forwarded || "local").slice(0, 100);
};

export const consumeRequestQuota = (request: Request): boolean => {
  try {
    const now = Date.now();
    if (now - globalWindowStartedAt >= WINDOW_SECONDS * 1000) {
      globalWindowStartedAt = now;
      globalRequestCount = 0;
    }
    if (globalRequestCount >= MAX_GLOBAL_REQUESTS_PER_WINDOW) return false;

    const key = clientKey(request);
    const current = requestCounts.get<number>(key) ?? 0;
    if (current >= MAX_REQUESTS_PER_WINDOW) return false;

    const keys = requestCounts.keys();
    if (!requestCounts.has(key) && keys.length >= MAX_CLIENT_KEYS) {
      const oldestKey = keys[0];
      if (oldestKey) requestCounts.del(oldestKey);
    }
    requestCounts.set(key, current + 1, WINDOW_SECONDS);
    globalRequestCount += 1;
    return true;
  } catch {
    return false;
  }
};

export const acquireRequestSlot = (): boolean => {
  if (activeRequests >= MAX_CONCURRENT_REQUESTS) return false;
  activeRequests += 1;
  return true;
};

export const releaseRequestSlot = (): void => {
  activeRequests = Math.max(0, activeRequests - 1);
};
