import NodeCache from "node-cache";

const cache = new NodeCache({
  stdTTL: 900,
  checkperiod: 120,
  useClones: false
});

export const buildTrackCacheKey = (type: string, number: string): string => `track:${type}:${number}`;

export const getCache = <T>(key: string): T | undefined => cache.get<T>(key);

export const setCache = <T>(key: string, value: T, ttlSeconds?: number): void => {
  cache.set<T>(key, value, ttlSeconds ?? 900);
};
