import { mega } from "@megaeth-labs/wallet-sdk-react";

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const erc20MetadataAbi = [
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

type MossReceiptLog = {
  address: string;
  topics?: string[];
  data?: string;
};

type MossReceipt = {
  logs?: MossReceiptLog[];
};

type MossTransactionResult = {
  receipt?: MossReceipt;
  receipts?: MossReceipt[];
};

function topicAddress(address: string) {
  return `0x${address.toLowerCase().replace(/^0x/, "").padStart(64, "0")}`;
}

function formatTokenAmount(raw: bigint, decimals: number) {
  if (decimals <= 0) return raw.toString();
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = raw / divisor;
  const fraction = raw % divisor;
  if (fraction === BigInt(0)) return whole.toString();

  const fractionText = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole.toString()}.${fractionText}`;
}

export async function resolveMossTipPayment(
  result: MossTransactionResult,
  fromWallet: string,
  toWallet: string,
) {
  const logs = [
    ...(result.receipt?.logs ?? []),
    ...(result.receipts?.flatMap((receipt) => receipt.logs ?? []) ?? []),
  ];
  const fromTopic = topicAddress(fromWallet);
  const toTopic = topicAddress(toWallet);

  const transfer = logs.find((log) => {
    const topics = log.topics?.map((topic) => topic.toLowerCase()) ?? [];
    return (
      topics[0] === TRANSFER_TOPIC &&
      topics[1] === fromTopic &&
      topics[2] === toTopic &&
      typeof log.data === "string"
    );
  });

  if (!transfer?.data) return null;

  const rawAmount = BigInt(transfer.data);
  const tokenAddress = transfer.address as `0x${string}`;
  const [symbolResult, decimalsResult] = await Promise.allSettled([
    mega.getFromContract<string>({
      address: tokenAddress,
      abi: erc20MetadataAbi,
      functionName: "symbol",
      args: [],
    }),
    mega.getFromContract<number>({
      address: tokenAddress,
      abi: erc20MetadataAbi,
      functionName: "decimals",
      args: [],
    }),
  ]);

  const token = symbolResult.status === "fulfilled" ? symbolResult.value : tokenAddress;
  const decimals = decimalsResult.status === "fulfilled" ? Number(decimalsResult.value) : 18;

  return {
    amount: formatTokenAmount(rawAmount, decimals),
    token,
    tokenAddress,
  };
}
