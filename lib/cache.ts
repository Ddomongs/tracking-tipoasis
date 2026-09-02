import NodeCache from "node-cache";

const cache = new NodeCache({
  stdTTL: 900,
  checkperiod: 120,
  useClones: false,
  maxKeys: 5000
});

export const buildTrackCacheKey = (type: string, number: string, carrierCode = "AUTO"): string =>
  `track:${type}:${carrierCode}:${number}`;

export const getCache = <T>(key: string): T | undefined => cache.get<T>(key);

export const setCache = <T>(key: string, value: T, ttlSeconds?: number): void => {
  const keys = cache.keys();
  if (!cache.has(key) && keys.length >= 5000) {
    const oldestKey = keys[0];
    if (oldestKey) cache.del(oldestKey);
  }
  cache.set<T>(key, value, ttlSeconds ?? 900);
};
