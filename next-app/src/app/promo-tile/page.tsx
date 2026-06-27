"use client";

export default function PromoTilePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#444] p-8">
      <div
        id="tile"
        className="flex flex-col items-center justify-center overflow-hidden"
        style={{ width: 440, height: 280, background: "#0f0f0f" }}
      >
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-4">
            <div className="grid shrink-0 place-items-center">
              <img
                src="/grove-logo.png"
                alt=""
                className="object-contain"
                style={{ width: 64, height: 64, transform: "scale(1.6) translateY(1px)" }}
              />
            </div>

            <span
              className="font-bold uppercase leading-none tracking-tight text-white"
              style={{ fontSize: "4.2rem" }}
            >
              Grove
            </span>
          </div>

          <span className="self-end font-mono text-sm uppercase tracking-[0.25em] text-white/35">
            on MegaETH
          </span>
        </div>
      </div>
    </div>
  );
}
