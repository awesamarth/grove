"use client";

import { Check, ExternalLink, Loader2, WalletCards } from "lucide-react";
import { mega, useStatus } from "@megaeth-labs/wallet-sdk-react";
import { useMutation, useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { GroveNav } from "../../../components/grove-nav";

function Avatar({ user }: { user: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/avatars/${user}.png`}
      alt=""
      className="size-16 rounded-md border border-text/15 bg-primary-muted object-cover [image-rendering:pixelated]"
    />
  );
}

export default function TipPage() {
  const params = useParams<{ username: string }>();
  const username = decodeURIComponent(params.username);
  const { status, address, initialised } = useStatus();
  const data = useQuery(api.dashboard.getProfileByUsername, { username });
  const createTipIntent = useMutation(api.social.createTipIntent);
  const [amount, setAmount] = useState("1.00");
  const [state, setState] = useState<"idle" | "pending" | "draft" | "paid" | "error">("idle");
  const [message, setMessage] = useState<string>();

  async function createIntent() {
    if (!data?.profile) return;

    setState("pending");
    setMessage(undefined);

    try {
      let walletAddress = address;

      if (status !== "connected") {
        const connection = await mega.connect();

        if (connection.status === "cancelled") {
          setState("idle");
          return;
        }

        if (connection.status !== "connected" || !connection.address) {
          throw new Error("Connect MOSS before tipping.");
        }

        walletAddress = connection.address;
      }

      if (!walletAddress) {
        throw new Error("Connect MOSS before tipping.");
      }

      await createTipIntent({
        devWalletAddress: walletAddress,
        targetWallet: data.profile.walletAddress,
        amount,
        token: "USDM",
        source: "web",
      });

      const result = await mega.send({
        token: "native",
        destination: data.profile.walletAddress as `0x${string}`,
      });

      if (result.status === "approved") {
        setState("paid");
        setMessage("MOSS approved the payment flow.");
      } else if (result.status === "cancelled") {
        setState("draft");
        setMessage("Payment cancelled. The draft intent is still here.");
      } else {
        setState("error");
        setMessage(result.error ?? "MOSS payment failed.");
      }
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not create tip intent.");
    }
  }

  return (
    <main className="grove-shell min-h-screen bg-background text-text">
      <GroveNav />

      <section className="mx-auto grid max-w-[920px] gap-6 px-4 py-8 sm:px-6 md:grid-cols-[1fr_320px] md:py-14">
        <div>
          <p className="font-mono text-[11px] uppercase text-muted">Grove pay</p>
          <h1 className="mt-3 max-w-xl text-[clamp(2.4rem,7vw,5rem)] font-medium leading-[0.94]">
            Tip people where they already are.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-muted">
            This route is the reliable fallback for the Chrome extension: a small Grove HTTPS surface that can invoke MOSS from a normal web origin.
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border border-text/15 bg-panel">
          {!data ? (
            <div className="flex min-h-80 items-center justify-center text-sm text-muted">
              <Loader2 className="mr-2 animate-spin" size={16} />
              Loading profile
            </div>
          ) : data.profile ? (
            <>
              <div className="border-b border-border p-5">
                <div className="flex items-center gap-4">
                  <Avatar user={data.profile.avatar} />
                  <div className="min-w-0">
                    <h2 className="truncate text-2xl font-medium">{data.profile.displayName}</h2>
                    <p className="truncate text-sm text-muted">
                      {data.profile.xHandle ? `@${data.profile.xHandle}` : data.profile.username}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-muted">{data.profile.bio}</p>
              </div>

              <div className="space-y-4 p-5">
                <label className="block">
                  <span className="font-mono text-[11px] uppercase text-muted">Amount</span>
                  <div className="mt-2 flex rounded-md border border-border bg-background focus-within:border-primary">
                    <input
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      className="min-w-0 flex-1 bg-transparent px-3 py-3 font-mono text-2xl outline-none"
                      inputMode="decimal"
                    />
                    <span className="grid w-20 place-items-center border-l border-border font-mono text-sm text-primary">
                      USDM
                    </span>
                  </div>
                </label>

                <button
                  type="button"
                  disabled={!initialised || state === "pending"}
                  onClick={createIntent}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-dark px-4 text-sm font-medium text-white transition-colors hover:bg-primary disabled:opacity-50"
                >
                  {state === "pending" ? <Loader2 className="animate-spin" size={16} /> : <WalletCards size={16} />}
                  {status === "connected" ? "Tip with MOSS" : "Connect and tip"}
                </button>

                {message ? (
                  <p
                    className={`rounded-md border px-3 py-2 text-sm ${
                      state === "error"
                        ? "border-danger bg-danger-muted text-danger"
                        : "border-primary bg-primary-muted text-primary"
                    }`}
                  >
                    {state === "paid" ? <Check className="mr-2 inline" size={14} /> : null}
                    {message}
                  </p>
                ) : null}

                <div className="border-t border-border pt-4">
                  <p className="font-mono text-[11px] uppercase text-muted">Recent public activity</p>
                  <div className="mt-3 space-y-2">
                    {data.recentActivities.length ? (
                      data.recentActivities.map((activity) => (
                        <div key={activity._id} className="rounded-md border border-border bg-background p-3">
                          <p className="text-sm">{activity.body}</p>
                          <p className="mt-1 font-mono text-[11px] text-primary">{activity.detail}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted">No public activity shared yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-5">
              <p className="text-lg font-medium">Profile unavailable</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                This profile is private, missing, or not linked on Grove yet.
              </p>
            </div>
          )}
        </div>
      </section>

      <footer className="mx-auto flex max-w-[920px] items-center justify-between px-4 pb-6 text-xs text-muted sm:px-6">
        <span>ongrove.network</span>
        <a className="flex items-center gap-1 hover:text-text" href="https://account.megaeth.com">
          MOSS <ExternalLink size={12} />
        </a>
      </footer>
    </main>
  );
}
