import { MossWalletControls } from "@/components/moss-wallet-controls";

export default function TestPage() {
  return (
    <main className="min-h-screen bg-[#f0eeeb] px-6 py-10 text-text">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl flex-col items-center justify-center">
        <section className="relative flex w-full flex-col items-center overflow-hidden rounded-lg border border-text/10 bg-[#f4f2ef] px-6 py-20 text-center shadow-[0_24px_80px_rgb(5_32_13/0.08)]">
          <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(rgb(9_26_16/0.025)_1px,transparent_1px),linear-gradient(90deg,rgb(9_26_16/0.025)_1px,transparent_1px)] [background-size:24px_24px]" />

          <div className="relative">
            <div className="absolute left-[21%] top-[48%] h-16 w-64 -translate-x-1/2 -translate-y-1/2 rotate-[-8deg] rounded-[48%] bg-primary-muted blur-[2px]" />
            <div className="absolute left-[34%] top-[55%] h-20 w-44 -translate-x-1/2 -translate-y-1/2 rotate-[13deg] rounded-[45%] bg-[#dce9cf] blur-[3px]" />
            <div className="absolute left-[48%] top-[50%] h-12 w-72 -translate-x-1/2 -translate-y-1/2 rotate-[3deg] rounded-[44%] bg-[#b7c994]/70 blur-[2px]" />
            <div className="absolute left-[28%] top-[60%] grid grid-cols-7 gap-1 opacity-80">
              {Array.from({ length: 35 }).map((_, index) => (
                <span
                  key={index}
                  className={[
                    "size-1.5 rounded-full",
                    index % 5 === 0 ? "bg-dark/80" : index % 3 === 0 ? "bg-primary" : "bg-[#9eb379]",
                  ].join(" ")}
                />
              ))}
            </div>

            <p className="relative mb-3 font-mono text-xs uppercase tracking-normal text-muted">
              MOSS testnet
            </p>
            <h1 className="relative select-none text-[clamp(4.8rem,16vw,12rem)] font-bold uppercase leading-[0.78] text-black">
              GROVE
            </h1>
          </div>

          <p className="relative mt-7 max-w-xl text-base text-muted sm:text-lg">
            Social roots for the MegaETH community.
          </p>
        </section>

        <div className="mt-8 w-full max-w-xl">
          <MossWalletControls />
        </div>
      </div>
    </main>
  );
}
