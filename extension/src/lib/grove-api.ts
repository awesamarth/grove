export const GROVE_ORIGIN = "https://localhost:3000";

export interface GroveProfile {
  username: string;
  displayName: string;
  walletAddress: string;
  karma: number;
  avatarUrl?: string | null;
}

const cache = new Map<string, { p: GroveProfile | null; at: number }>();
const CACHE_TTL = 120_000;

function cacheGet(h: string) {
  const e = cache.get(h.toLowerCase());
  return e && Date.now() - e.at < CACHE_TTL ? e.p : undefined;
}

function cacheSet(h: string, p: GroveProfile | null) {
  cache.set(h.toLowerCase(), { p, at: Date.now() });
}

export async function fetchProfile(handle: string): Promise<GroveProfile | null> {
  const cached = cacheGet(handle);
  if (cached !== undefined) return cached;

  return new Promise(resolve => {
    chrome.runtime.sendMessage(
      { type: "fetch-profile", handle },
      (res: { ok: boolean; profile?: GroveProfile }) => {
        if (res?.ok && res.profile) {
          cacheSet(handle, res.profile);
          resolve(res.profile);
        } else {
          cacheSet(handle, null);
          resolve(null);
        }
      }
    );
  });
}
