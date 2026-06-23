import { MossWalletControls } from "@/components/moss-wallet-controls";
import Image from "next/image";

export default function TestPage() {
  return (
    <main className="min-h-screen bg-[#160710] px-6 py-10 text-text">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl flex-col items-center justify-center">
        <section className="relative flex aspect-[16/9] w-full flex-col items-center justify-center overflow-hidden border border-white/10 bg-[#f3f0e8] px-6 text-center shadow-[0_28px_90px_rgb(0_0_0/0.35)]">
          <div className="absolute inset-0 opacity-80 [background-image:linear-gradient(rgb(9_26_16/0.035)_1px,transparent_1px),linear-gradient(90deg,rgb(9_26_16/0.035)_1px,transparent_1px)] [background-size:30px_30px]" />
          <div className="absolute -left-16 top-16 h-48 w-48 rounded-full bg-[#93c7a0]/45 blur-3xl" />
          <div className="absolute -right-20 bottom-12 h-56 w-56 rounded-full bg-[#c9df9c]/60 blur-3xl" />

          <div className="relative flex flex-col items-center">
            <Image
              src="/grove-logo-new.png"
              alt="Grove logo"
              width={210}
              height={220}
              priority
              className="mb-4 h-[clamp(6.2rem,13vw,11.5rem)] w-auto drop-shadow-[0_16px_34px_rgb(20_65_26/0.28)]"
            />

            <p className="mb-5 font-mono text-xl font-semibold uppercase tracking-[0.2em] text-[#1f3a24]">
              Coming soon to MegaETH
            </p>
            <h1 className="select-none text-[clamp(5.8rem,18vw,14rem)] font-bold uppercase leading-[0.72] tracking-normal text-[#06150b]">
              GROVE
            </h1>
            <p className="mt-10 max-w-3xl text-[clamp(1.4rem,2.55vw,2.5rem)] font-medium leading-tight text-[#38543b]">
              The social layer for MOSS wallets
            </p>
          </div>
        </section>

        <div className="mt-8 w-full max-w-xl">
          <MossWalletControls />
        </div>
      </div>
    </main>
  );
}
