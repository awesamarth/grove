const ws = new WebSocket("wss://mainnet.megaeth.com/ws");

let seen = 0;

ws.onopen = () => {
  console.log("Connected. Subscribing to miniBlocks...");
  ws.send(JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "eth_subscribe",
    params: ["miniBlocks"],
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.method === "eth_subscription") {
    const block = msg.params.result;
    seen++;
    const txCount = block.transactions?.length ?? 0;
    if (txCount > 0) {
      console.log("\n=== Mini-block with", txCount, "txs ===");
      console.log("block_number:", block.block_number);
      console.log("mini_block_number:", block.mini_block_number);
      console.log("index:", block.index);
      console.log("gas_used:", block.gas_used);
      const tx = block.transactions[0];
      console.log("\nFirst TX keys:", Object.keys(tx));
      console.log("  from:", tx.from);
      console.log("  to:", tx.to);
      console.log("  hash:", tx.hash);
      console.log("  value:", tx.value);
      console.log("  input (first 200):", tx.input?.slice(0, 200));
      if (block.receipts?.[0]) {
        const r = block.receipts[0];
        console.log("\nFirst receipt keys:", Object.keys(r));
        console.log("  status:", r.status);
        console.log("  from:", r.from);
        console.log("  to:", r.to);
        console.log("  contractAddress:", r.contractAddress);
        console.log("  logs:", r.logs?.length ?? 0);
      }
      ws.close();
      process.exit(0);
    } else {
      process.stdout.write(`\rSeen ${seen} mini-blocks, last block ${block.block_number}, index ${block.index} — no txs yet`);
    }
  }
};

ws.onerror = (err) => {
  console.error("\nWS error:", err);
  process.exit(1);
};

setTimeout(() => {
  console.log(`\nTimeout after ${seen} mini-blocks, none had txs`);
  process.exit(1);
}, 30000);
