const CONTRACTS = {
  euphoria: {
    address: "0xdf8248fee58e791149e69f6c61129D471EaFC11E",
    name: "Euphoria",
    body: "Traded on Euphoria",
    color: "success",
  },
  topstrike: {
    address: "0xf3393dC9E747225FcA0d61BfE588ba2838AFb077",
    name: "TopStrike",
    body: "Played on TopStrike",
    color: "primary",
  },
} as const;

export type AppKey = keyof typeof CONTRACTS;

export const GROVE_ORIGIN = process.env.GROVE_ORIGIN ?? "https://localhost:3000";
export const INDEXER_SECRET = process.env.INDEXER_SECRET;
export const MEGAETH_WS = "wss://mainnet.megaeth.com/ws";

export const megaethChain = {
  id: 4326,
  name: "MegaETH",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    public: { http: ["https://mainnet.megaeth.com/rpc"] },
    default: { http: ["https://mainnet.megaeth.com/rpc"] },
  },
} as const;

export function matchContract(to?: string | null) {
  if (!to) return null;
  const addr = to.toLowerCase();
  for (const [key, app] of Object.entries(CONTRACTS)) {
    if (app.address.toLowerCase() === addr) return { key: key as AppKey, ...app };
  }
  return null;
}
