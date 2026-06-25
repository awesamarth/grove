import { createPublicClient, http } from "viem";
import { megaeth } from "viem/chains";
import { GROVE_ORIGIN, INDEXER_SECRET, CONTRACTS, matchContract } from "./config";
import type { Log } from "viem";

const headers: Record<string, string> = { "content-type": "application/json" };
if (INDEXER_SECRET) headers.authorization = `Bearer ${INDEXER_SECRET}`;

let knownWallets = new Set<string>();
const seen = new Set<string>();

const client = createPublicClient({
  chain: megaeth,
  transport: http(),
});

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${GROVE_ORIGIN}${path}`, {
    ...init,
    headers: { ...headers, ...init?.headers },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status} on ${path}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function fetchKnownWallets(): Promise<Set<string>> {
  const wallets = await api<{ walletAddress: string }[]>("/api/indexer/wallets");
  const set = new Set(wallets.map((w) => w.walletAddress.toLowerCase()));
  set.add("0x01c46e8bfc7843aca8c065dc76f71c0ec1e51eed");
  return set;
}

function extractAddressesFromLog(log: Log): string[] {
  const addresses: string[] = [];
  if (log.topics) {
    for (const topic of log.topics) {
      if (topic.length === 66) {
        const addr = "0x" + topic.slice(26).toLowerCase();
        addresses.push(addr);
      }
    }
  }
  return addresses;
}

async function start() {
  knownWallets = await fetchKnownWallets();
  console.log(`[indexer] loaded ${knownWallets.size} known wallets`);

  const contractAddresses = Object.values(CONTRACTS).map((c) =>
    c.address.toLowerCase()
  );

  let logCount = 0;

  const unwatch = client.watchEvent({
    address: contractAddresses as `0x${string}`[],
    onLogs: (logs) => {
      for (const log of logs) {
        logCount++;
        if (logCount % 10 === 0) {
          console.log(`[indexer] ${logCount} events processed`);
        }

        const txHash = (log.transactionHash ?? "").toLowerCase();
        if (seen.has(txHash)) continue;
        seen.add(txHash);

        const logAddr = log.address.toLowerCase();
        const contract = matchContract(logAddr);
        if (!contract) continue;

        const foundWallets = extractAddressesFromLog(log);
        const matched = foundWallets.find((w) => knownWallets.has(w));
        if (!matched) continue;

        const blockNumber = Number(log.blockNumber ?? 0);

        recordActivity({
          walletAddress: matched,
          txHash,
          appName: contract.name,
          body: contract.body,
          tone: contract.color,
          blockNumber,
        }).then(() => {
          console.log(
            `[indexer] recorded: ${matched} → ${contract.name} (${txHash})`
          );
        }).catch((err: any) => {
          console.error(`[indexer] record failed for ${txHash}:`, err.message);
        });
      }
    },
    onError: (err) => {
      console.error("[indexer] watchEvent error:", err);
    },
  });

  console.log("[indexer] watching for onchain activity...");

  setInterval(async () => {
    try {
      knownWallets = await fetchKnownWallets();
      console.log(`[indexer] refreshed wallets: ${knownWallets.size} known`);
    } catch (err) {
      console.error("[indexer] wallet refresh failed:", err);
    }
  }, 60_000);

  process.on("SIGINT", () => {
    unwatch();
    process.exit(0);
  });
}

async function recordActivity(body: {
  walletAddress: string;
  txHash: string;
  appName: string;
  body: string;
  tone: string;
  blockNumber: number;
}) {
  return api("/api/indexer/record", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

start().catch((err) => {
  console.error("[indexer] fatal:", err);
  process.exit(1);
});
