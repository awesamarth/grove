import { GROVE_ORIGIN, INDEXER_SECRET, MEGAETH_WS, matchContract } from "./config";

const headers: Record<string, string> = { "content-type": "application/json" };
if (INDEXER_SECRET) headers.authorization = `Bearer ${INDEXER_SECRET}`;

let knownWallets = new Set<string>();
let seen = new Set<string>();

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
  // hardcoded test wallet
  set.add("0x01c46e8bfc7843aca8c065dc76f71c0ec1e51eed");
  return set;
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

async function refreshWallets() {
  try {
    knownWallets = await fetchKnownWallets();
    console.log(`[indexer] refreshed wallets: ${knownWallets.size} known`);
  } catch (err) {
    console.error("[indexer] wallet refresh failed:", err);
  }
}

async function connect() {
  console.log("[indexer] connecting to MegaETH WS...");

  await refreshWallets();
  console.log(`[indexer] loaded ${knownWallets.size} known wallets`);

  const ws = new WebSocket(MEGAETH_WS);
  let miniBlockCount = 0;

  const walletRefreshTimer = setInterval(refreshWallets, 60_000);
  const keepaliveTimer = setInterval(() => {
    ws.send(JSON.stringify({ jsonrpc: "2.0", id: 0, method: "eth_chainId" }));
  }, 25_000);

  ws.onopen = () => {
    console.log("[indexer] WS connected, subscribing to miniBlocks...");
    ws.send(JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_subscribe",
      params: ["miniBlocks"],
    }));
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method !== "eth_subscription") return;

    const block = msg.params.result;
    miniBlockCount++;
    if (miniBlockCount % 100 === 0) {
      console.log(`[indexer] ${miniBlockCount} mini-blocks processed`);
    }
    if (!block.transactions?.length) return;

    for (let i = 0; i < block.transactions.length; i++) {
      const tx = block.transactions[i];
      const from = (tx.from ?? "").toLowerCase();
      const isTestWallet = from === "0x01c46e8bfc7843aca8c065dc76f71c0ec1e51eed";
      if (!knownWallets.has(from)) {
        if (isTestWallet) {
          console.log(`[indexer] DEBUG: test wallet tx to=${tx.to} hash=${tx.hash} input=${(tx.input ?? "").slice(0, 60)}`);
        }
        continue;
      }

      const to = (tx.to ?? "").toLowerCase();
      const contract = matchContract(to);
      if (!contract) continue;

      const hash = (tx.hash ?? "").toLowerCase();
      if (seen.has(hash)) continue;
      seen.add(hash);

      const blockNumber = Number(block.block_number);

      recordActivity({
        walletAddress: from,
        txHash: hash,
        appName: contract.name,
        body: contract.body,
        tone: contract.color,
        blockNumber,
      }).then(() => {
        console.log(`[indexer] recorded: ${from} → ${contract.name} (${hash})`);
      }).catch((err: any) => {
        console.error(`[indexer] record failed for ${hash}:`, err.message);
      });
    }
  };

  ws.onerror = (err) => {
    console.error("[indexer] WS error:", err);
  };

  ws.onclose = () => {
    clearInterval(walletRefreshTimer);
    clearInterval(keepaliveTimer);
    console.log("[indexer] WS closed, reconnecting in 5s...");
    setTimeout(connect, 5000);
  };

  console.log("[indexer] watching for onchain activity...");
}

connect().catch((err) => {
  console.error("[indexer] fatal:", err);
  process.exit(1);
});
