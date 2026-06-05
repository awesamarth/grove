import { MossWalletControls } from "@/components/moss-wallet-controls";

export default function TestPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="flex w-full max-w-xl flex-col items-center text-center">
        <p className="font-mono text-xs uppercase text-muted">MOSS testnet</p>
        <h1 className="mt-3 text-4xl font-medium text-text">Grove</h1>
        <p className="mt-2 text-sm text-muted">
          Social roots for the MegaETH community.
        </p>
        <MossWalletControls />
      </div>
    </main>
  );
}
