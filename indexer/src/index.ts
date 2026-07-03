import { ConvexHttpClient } from "convex/browser";
import { createPublicClient, decodeEventLog, formatEther, http } from "viem";
import type { Abi, Log } from "viem";
import { megaeth } from "viem/chains";
import { api } from "../../next-app/convex/_generated/api";
import { CONVEX_URL, INDEXER_SECRET, CONTRACTS, matchContract } from "./config";

if (!CONVEX_URL) throw new Error("CONVEX_URL or NEXT_PUBLIC_CONVEX_URL is required");
if (!INDEXER_SECRET) throw new Error("INDEXER_SECRET is required");

const convex = new ConvexHttpClient(CONVEX_URL);

const topStrikeEvents = [
  {
    type: "event",
    name: "Trade",
    inputs: [
      { name: "trader", type: "address", indexed: true },
      { name: "playerId", type: "uint256", indexed: true },
      { name: "isBuy", type: "bool", indexed: false },
      { name: "amountInUnits", type: "uint256", indexed: false },
      { name: "priceInWei", type: "uint256", indexed: false },
      { name: "feeInWei", type: "uint256", indexed: false },
      { name: "newSupplyInUnits", type: "uint256", indexed: false },
      { name: "isIPOWindow", type: "bool", indexed: false },
    ],
  },
  {
    type: "event",
    name: "SharesTransferred",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "playerId", type: "uint256", indexed: true },
      { name: "amountInUnits", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "EthPrizeAwarded",
    inputs: [
      { name: "winner", type: "address", indexed: true },
      { name: "playerId", type: "uint256", indexed: true },
      { name: "amountInWei", type: "uint256", indexed: false },
      { name: "description", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "SharePrizeAwarded",
    inputs: [
      { name: "winner", type: "address", indexed: true },
      { name: "playerId", type: "uint256", indexed: true },
      { name: "amountInUnits", type: "uint256", indexed: false },
      { name: "description", type: "string", indexed: false },
    ],
  },
] as const satisfies Abi;

let knownWallets = new Set<string>();
const seen = new Set<string>();

const client = createPublicClient({
  chain: megaeth,
  transport: http(),
});

async function fetchKnownWallets(): Promise<Set<string>> {
  const wallets = await convex.query(api.dashboard.getOptedInWallets, {
    secret: INDEXER_SECRET,
  });
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

function shortEth(value: bigint) {
  const formatted = Number(formatEther(value));
  if (!Number.isFinite(formatted)) return `${formatEther(value)} ETH`;
  if (formatted === 0) return "0 ETH";
  return `${formatted.toLocaleString(undefined, { maximumFractionDigits: 5 })} ETH`;
}

function decodeTopStrikeActivity(log: Log, wallets: Set<string>) {
  try {
    const decoded = decodeEventLog({
      abi: topStrikeEvents,
      data: log.data ?? "0x",
      topics: log.topics,
      strict: true,
    });

    if (decoded.eventName === "Trade") {
      const args = decoded.args;
      const trader = args.trader.toLowerCase();
      if (!wallets.has(trader)) return null;
      const side = args.isBuy ? "bought" : "sold";
      const phase = args.isIPOWindow ? " in the IPO window" : "";
      return {
        walletAddress: trader,
        body: `${side} TopStrike player #${args.playerId.toString()} shares${phase} for ${shortEth(args.priceInWei)}`,
        tone: args.isBuy ? "primary" : "success",
      };
    }

    if (decoded.eventName === "SharesTransferred") {
      const args = decoded.args;
      const from = args.from.toLowerCase();
      const to = args.to.toLowerCase();
      if (wallets.has(to)) {
        return {
          walletAddress: to,
          body: `received TopStrike player #${args.playerId.toString()} shares`,
          tone: "success",
        };
      }
      if (wallets.has(from)) {
        return {
          walletAddress: from,
          body: `sent TopStrike player #${args.playerId.toString()} shares`,
          tone: "primary",
        };
      }
      return null;
    }

    if (decoded.eventName === "EthPrizeAwarded") {
      const args = decoded.args;
      const winner = args.winner.toLowerCase();
      if (!wallets.has(winner)) return null;
      return {
        walletAddress: winner,
        body: `won ${shortEth(args.amountInWei)} on TopStrike${args.description ? ` — ${args.description}` : ""}`,
        tone: "success",
      };
    }

    if (decoded.eventName === "SharePrizeAwarded") {
      const args = decoded.args;
      const winner = args.winner.toLowerCase();
      if (!wallets.has(winner)) return null;
      return {
        walletAddress: winner,
        body: `won TopStrike player #${args.playerId.toString()} share prizes${args.description ? ` — ${args.description}` : ""}`,
        tone: "success",
      };
    }
  } catch {
    return null;
  }

  return null;
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

        const logAddr = log.address.toLowerCase();
        const contract = matchContract(logAddr);
        if (!contract) continue;

        const decodedActivity = contract.key === "topstrike"
          ? decodeTopStrikeActivity(log, knownWallets)
          : null;
        const fallbackWallet = decodedActivity
          ? null
          : extractAddressesFromLog(log).find((w) => knownWallets.has(w));
        const activity = decodedActivity ?? (fallbackWallet
          ? { walletAddress: fallbackWallet, body: contract.body, tone: contract.color }
          : null);
        if (!activity) continue;
        seen.add(txHash);

        const blockNumber = Number(log.blockNumber ?? 0);

        recordActivity({
          walletAddress: activity.walletAddress,
          txHash,
          appName: contract.name,
          body: activity.body,
          tone: activity.tone,
          blockNumber,
        }).then(() => {
          console.log(
            `[indexer] recorded: ${activity.walletAddress} → ${contract.name}: ${activity.body} (${txHash})`
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
  return await convex.mutation(api.dashboard.insertIndexedActivity, {
    secret: INDEXER_SECRET,
    ...body,
  });
}

start().catch((err) => {
  console.error("[indexer] fatal:", err);
  process.exit(1);
});
