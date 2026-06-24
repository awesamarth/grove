import { GROVE_ORIGIN, INDEXER_SECRET, MEGAETH_WS, matchContract } from "./config";

const headers: Record<string, string> = { "content-type": "application/json" };
if (INDEXER_SECRET) headers.authorization = `Bearer ${INDEXER_SECRET}`;

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
  return new Set(wallets.map((w) => w.walletAddress.toLowerCase()));
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

async function start() {
  console.log("[indexer] connecting to MegaETH WS...");

  let knownWallets = await fetchKnownWallets();
  const seen = new Set<string>();
  console.log(`[indexer] loaded ${knownWallets.size} known wallets`);

  setInterval(async () => {
    try {
      knownWallets = await fetchKnownWallets();
      console.log(`[indexer] refreshed wallets: ${knownWallets.size} known`);
    } catch (err) {
      console.error("[indexer] wallet refresh failed:", err);
    }
  }, 300_000);

  const ws = new WebSocket(MEGAETH_WS);

  ws.onopen = () => {
    console.log("[indexer] WS connected, subscribing to miniBlocks...");
    ws.send(JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_subscribe",
      params: ["miniBlocks"],
    }));
  };

  let miniBlockCount = 0;

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
      if (!knownWallets.has(from)) continue;

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
    console.log("[indexer] WS closed, reconnecting in 5s...");
    setTimeout(start, 5000);
  };

  // keepalive: eth_chainId every 25s
  setInterval(() => {
    ws.send(JSON.stringify({ jsonrpc: "2.0", id: 0, method: "eth_chainId" }));
  }, 25_000);

  console.log("[indexer] watching for onchain activity...");
}

start().catch((err) => {
  console.error("[indexer] fatal:", err);
  process.exit(1);
});
