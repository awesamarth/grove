"use client";

import {
  ChevronRight,
  Gamepad2,
  Heart,
  Sparkles,
  Sprout,
  Trophy,
  UserPlus,
  WalletCards,
} from "lucide-react";
import { mega, useStatus } from "@megaeth-labs/wallet-sdk-react";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import { GroveNav } from "../components/grove-nav";
import { useXConnect } from "../components/x-connect-modal";

const apps = [
  { glyph: "N", name: "Noise Arena", players: "1.8k", tint: "#cdefde" },
  { glyph: "W", name: "Words3", players: "942", tint: "#dfe8ff" },
  { glyph: "E", name: "Euphoria", players: "614", tint: "#f6dfd6" },
];

const activityIcons = {
  game: Gamepad2,
  tip: WalletCards,
  mint: Sparkles,
  app: Gamepad2,
  reputation: Trophy,
};

type Privacy = "public" | "limited" | "private";

type AuthChallenge = {
  token?: string;
  message?: string;
  error?: string;
};

function Avatar({ user, size = "md" }: { user: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "size-8", md: "size-11", lg: "size-16" };
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/avatars/${user}.png`}
      alt=""
      className={`${sizes[size]} shrink-0 rounded-md border border-text/15 bg-primary-muted object-cover [image-rendering:pixelated]`}
    />
  );
}

export default function Home() {
  const { initialised, status, address } = useStatus();
  const { openXConnect } = useXConnect();
  const seed = useMutation(api.seed.initialise);
  const upsertProfile = useMutation(api.dashboard.upsertDevProfile);
  const updatePrivacy = useMutation(api.dashboard.updatePrivacy);
  const completeOnboarding = useMutation(api.dashboard.completeOnboarding);
  const setFollow = useMutation(api.social.setFollow);
  const vote = useMutation(api.social.vote);
  const [authPending, setAuthPending] = useState(false);
  const [authState, setAuthState] = useState<"idle" | "success" | "error">("idle");
  const [authError, setAuthError] = useState<string>();
  const [tab, setTab] = useState<"activity" | "people" | "apps">("activity");
  const [optimisticPrivacy, setOptimisticPrivacy] = useState<Privacy>();
  const [onboardingName, setOnboardingName] = useState("");
  const [onboardingAvatar, setOnboardingAvatar] = useState("niko");
  const [onboardingPending, setOnboardingPending] = useState(false);
  const [devWallet] = useState<string | undefined>(() =>
    typeof window === "undefined"
      ? undefined
      : (window.localStorage.getItem("grove:devWallet") ?? undefined),
  );
  const viewerWallet = address ?? devWallet;
  const hasProfile = Boolean(viewerWallet);
  const dashboard = useQuery(api.dashboard.getDashboard, {
    viewerWallet,
  });
  const activePrivacy = optimisticPrivacy ?? dashboard?.viewer?.privacy;
  const needsOnboarding = Boolean(
    viewerWallet && dashboard?.viewer && !dashboard.viewer.onboardingComplete,
  );

  useEffect(() => {
    void seed({});
  }, [seed]);

  useEffect(() => {
    if (!address) return;
    void upsertProfile({ walletAddress: address });
  }, [address, upsertProfile]);

  async function signIn() {
    setAuthPending(true);
    setAuthState("idle");
    setAuthError(undefined);

    try {
      let walletAddress = address;

      if (status !== "connected") {
        const connection = await mega.connect();

        if (connection.status === "cancelled") return;
        if (connection.status !== "connected") {
          throw new Error("MOSS wallet could not connect.");
        }

        walletAddress = connection.address;
      }

      if (!walletAddress) {
        throw new Error("MOSS wallet did not return an address.");
      }

      const challengeResponse = await fetch("/api/auth/challenge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: walletAddress }),
      });
      const challenge = (await challengeResponse.json()) as AuthChallenge;

      if (!challengeResponse.ok || !challenge.token || !challenge.message) {
        throw new Error(challenge.error ?? "Could not create Grove sign-in challenge.");
      }

      const auth = await mega.signMessage(challenge.message);

      if (auth.status === "cancelled") return;
      if (auth.status === "error" || !auth.signature) {
        throw new Error(auth.error ?? "MOSS authentication failed.");
      }

      const verification = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: challenge.token, signature: auth.signature }),
      });

      const verificationBody = (await verification.json()) as {
        walletAddress?: string;
        error?: string;
      };

      if (!verification.ok || !verificationBody.walletAddress) {
        throw new Error(verificationBody.error ?? "MOSS authentication could not be verified.");
      }

      await upsertProfile({ walletAddress: verificationBody.walletAddress });
      setAuthState("success");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "MOSS authentication failed.");
      setAuthState("error");
    } finally {
      setAuthPending(false);
    }
  }

  async function toggleFollow(targetWallet: string, following: boolean) {
    if (!viewerWallet) {
      await signIn();
      return;
    }

    if (needsOnboarding) {
      setAuthError("Finish your Grove profile before following people.");
      setAuthState("error");
      return;
    }

    await setFollow({
      devWalletAddress: viewerWallet,
      targetWallet,
      following,
    });
  }

  async function tipWithMoss(targetWallet: string) {
    setAuthError(undefined);

    if (needsOnboarding) {
      setAuthError("Finish your Grove profile before tipping people.");
      setAuthState("error");
      return;
    }

    try {
      if (status !== "connected") {
        const connection = await mega.connect();

        if (connection.status === "cancelled") return;
        if (connection.status !== "connected") {
          throw new Error("Connect MOSS before tipping.");
        }
      }

      const result = await mega.send({
        token: "native",
        destination: targetWallet as `0x${string}`,
      });

      if (result.status === "cancelled") return;
      if (result.status === "error") {
        throw new Error(result.error ?? "MOSS tip flow failed.");
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "MOSS tip flow failed.");
    }
  }

  async function setPrivacy(privacy: Privacy) {
    setOptimisticPrivacy(privacy);

    if (!viewerWallet) {
      await signIn();
      return;
    }

    try {
      await updatePrivacy({
        devWalletAddress: viewerWallet,
        privacy,
        activitySharing: privacy,
      });
    } catch (error) {
      setOptimisticPrivacy(undefined);
      throw error;
    }
  }

  async function voteOn(targetWallet: string, value: 1 | -1) {
    if (!viewerWallet) {
      await signIn();
      return;
    }

    if (needsOnboarding) {
      setAuthError("Finish your Grove profile before voting.");
      setAuthState("error");
      return;
    }

    await vote({
      devWalletAddress: viewerWallet,
      targetWallet,
      value,
    });
  }

  async function finishOnboarding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!viewerWallet) return;
    setOnboardingPending(true);
    setAuthError(undefined);

    try {
      await completeOnboarding({
        walletAddress: viewerWallet,
        displayName: onboardingName,
        avatar: onboardingAvatar,
      });
      setAuthState("success");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not finish onboarding.");
      setAuthState("error");
    } finally {
      setOnboardingPending(false);
    }
  }

  return (
    <main className="grove-shell min-h-screen bg-background text-text">
      <GroveNav />

      <section className="border-b border-text/15">
        <div className="mx-auto grid max-w-[1180px] gap-7 px-4 py-8 sm:px-6 md:grid-cols-[1fr_auto] md:items-end md:py-10">
          <div>
            <div className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase text-muted">
              <span className="size-2 animate-pulse rounded-full bg-success" />
              Live on MegaETH testnet
            </div>
            <h1 className="max-w-5xl text-[clamp(2.4rem,5.2vw,4rem)] font-medium leading-[0.96]">
              Where all the MegaETH
              <span className="block md:whitespace-nowrap">
                homies <span className="text-primary">pull up.</span>
              </span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">
              Follow the people, games, apps, and real activity growing across the network.
            </p>
            {!hasProfile ? (
              <button
                type="button"
                disabled={!initialised || authPending}
                onClick={signIn}
                className="mt-5 h-10 rounded-md border border-primary bg-primary-muted px-4 text-sm font-medium text-primary transition-colors hover:border-dark hover:bg-dark hover:text-white disabled:opacity-50"
              >
                {authPending ? "Opening MOSS" : "Claim your Grove"}
              </button>
            ) : null}
          </div>

          <div className="grid grid-cols-3 border-y border-text/20 md:w-[340px]">
            {[
              [dashboard ? dashboard.stats.people.toLocaleString() : "—", "people"],
              [dashboard ? dashboard.stats.activities.toLocaleString() : "—", "activities"],
              [dashboard ? dashboard.stats.apps.toLocaleString() : "—", "apps"],
            ].map(([value, label]) => (
              <div key={label} className="border-r border-text/20 py-3 text-center last:border-r-0">
                <p className="font-mono text-lg font-bold">{value}</p>
                <p className="mt-0.5 text-xs text-muted">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <nav className="border-b border-text/15 md:hidden">
        <div className="mx-auto flex max-w-[1180px] px-4">
          {(["activity", "people", "apps"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`h-11 flex-1 border-b-2 text-sm capitalize ${tab === item ? "border-primary text-text" : "border-transparent text-muted"}`}
            >
              {item}
            </button>
          ))}
        </div>
      </nav>

      <div className="mx-auto grid max-w-[1180px] gap-8 px-4 py-7 sm:px-6 md:grid-cols-[minmax(0,1fr)_340px] md:py-9">
        <section className={tab !== "activity" ? "hidden md:block" : "block"}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase text-muted">Public activity</p>
              <h2 className="mt-1 text-2xl font-medium">Live on Grove</h2>
            </div>
            <button type="button" className="flex items-center gap-1 text-sm text-primary hover:text-dark">
              View all <ChevronRight size={15} />
            </button>
          </div>

          <div className="overflow-hidden rounded-lg border border-text/15 bg-panel">
            {(dashboard?.feed ?? []).map((activity) => {
              const Icon = activityIcons[activity.kind];
              const actor = activity.actor;
              return (
                <article key={activity._id} className="grid grid-cols-[auto_1fr] gap-3 border-b border-border p-4 last:border-b-0 sm:p-5">
                  {actor ? (
                    <Link href={`/profile/${actor.username}`} aria-label={`${actor.displayName} profile`}>
                      <Avatar user={actor.avatar} />
                    </Link>
                  ) : (
                    <Avatar user="niko" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm">
                          {actor ? (
                            <Link href={`/profile/${actor.username}`} className="font-semibold hover:text-primary">
                              {actor.displayName}
                            </Link>
                          ) : (
                            <strong className="font-semibold">Unknown</strong>
                          )}{" "}
                          <span className="text-muted">
                            {actor?.xHandle ? `@${actor.xHandle}` : actor?.username}
                          </span>
                        </p>
                        <p className="mt-2 text-[15px] leading-6 text-text">{activity.body}</p>
                      </div>
                      <span className="shrink-0 font-mono text-[11px] text-muted">{activity.time}</span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className={`activity-chip activity-${activity.tone}`}>
                        <Icon size={13} />
                        <span className="mono-optical-align">{activity.detail}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => actor && voteOn(actor.walletAddress, 1)}
                        className="ml-auto flex items-center gap-1.5 text-xs text-muted hover:text-danger"
                      >
                        <Heart size={14} /> {activity.reactions}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
            {dashboard && dashboard.feed.length === 0 ? (
              <div className="p-5 text-sm text-muted">No public activity yet.</div>
            ) : null}
            {!dashboard ? (
              <div className="p-5 text-sm text-muted">Loading the grove...</div>
            ) : null}
          </div>

          <div className="mt-5 border-y border-text/20 py-4">
            <p className="text-sm text-muted">Your people are already here.</p>
          </div>

        </section>

        <aside className="space-y-8">
          <section className={tab !== "people" ? "hidden md:block" : "block"}>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <p className="font-mono text-[11px] uppercase text-muted">Across the grove</p>
                <h2 className="mt-1 text-xl font-medium">People to know</h2>
              </div>
              <UserPlus size={18} className="text-muted" />
            </div>
            <div className="border-y border-text/20">
              {(dashboard?.people ?? []).map((person) => {
                return (
                  <div key={person.walletAddress} className="flex items-center gap-3 border-b border-text/10 py-3 last:border-b-0">
                    <Link href={`/profile/${person.username}`} aria-label={`${person.displayName} profile`}>
                      <Avatar user={person.avatar} size="sm" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link href={`/profile/${person.username}`} className="block truncate text-sm font-semibold hover:text-primary">
                        {person.displayName}
                      </Link>
                      <p className="truncate text-xs text-muted">
                        {person.xHandle ? `@${person.xHandle}` : person.username} · {person.mutuals} mutuals
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-xs font-bold text-primary">{person.reputation}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => tipWithMoss(person.walletAddress)}
                          className="text-primary hover:text-dark"
                        >
                          tip
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleFollow(person.walletAddress, !person.isFollowed)}
                          className="text-muted hover:text-text"
                        >
                          {person.isFollowed ? "following" : "+ follow"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {dashboard && dashboard.people.length === 0 ? (
                <div className="py-4 text-sm text-muted">No public profiles yet.</div>
              ) : null}
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-text/15 bg-panel">
            <div className="border-b border-border p-4">
              <p className="font-mono text-[11px] uppercase text-muted">Your Grove</p>
              <h2 className="mt-1 text-xl font-medium">
                {dashboard?.viewer?.onboardingComplete ? dashboard.viewer.displayName : "Profile controls"}
              </h2>
              <p className="mt-2 text-sm leading-5 text-muted">
                {viewerWallet
                  ? "Manage your Grove identity, privacy, and linked accounts."
                  : "Browse freely. Sign in with MOSS to follow, tip, vote, and choose what you share."}
              </p>
            </div>

            <div className="space-y-4 p-4">
              {!viewerWallet ? (
                <button
                  type="button"
                  disabled={!initialised || authPending}
                  onClick={signIn}
                  className="h-10 w-full rounded-md bg-dark px-4 text-sm font-medium text-white transition-colors hover:bg-primary disabled:opacity-50"
                >
                  {authPending ? "Opening MOSS" : "Sign in with MOSS"}
                </button>
              ) : needsOnboarding ? (
                <div className="rounded-md border border-primary bg-primary-muted p-3 text-sm text-primary">
                  Finish setup to activate your Grove profile.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-1 rounded-md border border-border bg-background p-1">
                    {(["public", "limited", "private"] as const).map((privacy) => (
                      <button
                        key={privacy}
                        type="button"
                        onClick={() => setPrivacy(privacy)}
                        className={`h-8 rounded-[4px] text-xs capitalize transition-colors ${
                          activePrivacy === privacy
                            ? "bg-primary text-white"
                            : "text-muted hover:bg-panel hover:text-text"
                        }`}
                      >
                        {privacy}
                      </button>
                    ))}
                  </div>

                  {!dashboard?.viewer?.xVerified ? (
                    <div id="connect-x" className="scroll-mt-24 rounded-md border border-text/15 bg-background p-3">
                      <p className="text-sm font-medium text-text">Connect X to claim your handle</p>
                      <p className="mt-1 text-xs leading-5 text-muted">
                        Once verified, your X handle becomes your Grove username.
                      </p>
                    </div>
                  ) : null}

                  <div>
                    <p className="mb-2 font-mono text-[11px] uppercase text-muted">
                      {dashboard?.viewer?.xVerified ? "X verified" : "X identity"}
                    </p>
                    {dashboard?.viewer?.xVerified ? (
                      <div className="rounded-md border border-primary bg-primary-muted px-3 py-2">
                        <p className="font-mono text-sm text-primary">
                          @{dashboard.viewer.xHandle ?? dashboard.viewer.username}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-primary/80">
                          This X handle is your Grove username.
                        </p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={openXConnect}
                        className="h-9 w-full rounded-md bg-dark px-3 text-sm font-medium text-white hover:bg-primary"
                      >
                        Connect X
                      </button>
                    )}
                    <p className="mt-2 text-xs leading-5 text-muted">
                      Verified users use their X handle as their Grove username.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 border-y border-text/15 py-3 text-center">
                    <div>
                      <p className="font-mono text-base font-bold text-primary">
                        {dashboard?.viewer?.reputation ?? "—"}
                      </p>
                      <p className="text-[11px] text-muted">rep</p>
                    </div>
                    <div>
                      <p className="font-mono text-base font-bold text-primary">
                        {dashboard?.viewer?.upvotes ?? "—"}
                      </p>
                      <p className="text-[11px] text-muted">up</p>
                    </div>
                    <div>
                      <p className="font-mono text-base font-bold text-primary">
                        {dashboard?.viewer?.downvotes ?? "—"}
                      </p>
                      <p className="text-[11px] text-muted">down</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          <section className={tab !== "apps" ? "hidden md:block" : "block"}>
            <div className="mb-3">
              <p className="font-mono text-[11px] uppercase text-muted">Right now</p>
              <h2 className="mt-1 text-xl font-medium">Trending apps</h2>
            </div>
            <div className="overflow-hidden rounded-lg border border-text/15 bg-panel">
              {apps.map((app, index) => (
                <button key={app.name} type="button" className="flex w-full items-center gap-3 border-b border-border p-3 text-left last:border-b-0 hover:bg-background">
                  <span className="grid size-10 place-items-center rounded-md border border-text/15 font-mono text-sm font-bold" style={{ backgroundColor: app.tint }}>
                    {app.glyph}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{app.name}</span>
                    <span className="mt-0.5 block text-xs text-muted">{app.players} active this week</span>
                  </span>
                  <span className="font-mono text-[10px] text-muted">0{index + 1}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="hidden border border-dark bg-dark p-5 text-white md:block">
            <div className="flex items-start justify-between">
              <Sprout className="text-primary-muted" size={22} />
              <span className="font-mono text-[10px] uppercase text-primary-muted">Invite only · soon</span>
            </div>
            <p className="mt-7 text-xl font-medium leading-6">Make your wallet feel like a place.</p>
            <p className="mt-2 text-sm leading-5 text-white/65">A profile, a reputation, and a history you choose to share.</p>
          </section>
        </aside>
      </div>

      {needsOnboarding ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-dark/35 px-4 backdrop-blur-sm">
          <form
            onSubmit={finishOnboarding}
            className="w-full max-w-[460px] overflow-hidden rounded-lg border border-text/20 bg-panel shadow-[0_24px_80px_rgb(5_32_13/0.25)]"
          >
            <div className="border-b border-border p-5">
              <p className="font-mono text-[11px] uppercase text-muted">Set up Grove</p>
              <h2 className="mt-1 text-2xl font-medium">Choose your display name</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Your handle starts as a generated Grove tag. Connect X later to use your verified X handle.
              </p>
            </div>

            <div className="space-y-5 p-5">
              <label className="block">
                <span className="mb-2 block text-sm font-medium">Display name</span>
                <input
                  value={onboardingName}
                  onChange={(event) => setOnboardingName(event.target.value)}
                  autoFocus
                  placeholder="Samarth"
                  className="h-11 w-full rounded-md border border-border bg-background px-3 text-base outline-none placeholder:text-muted focus:border-primary"
                />
              </label>

              <div>
                <p className="mb-2 text-sm font-medium">Avatar</p>
                <div className="grid grid-cols-6 gap-2">
                  {["niko", "mira", "raihan", "juno", "kai", "alba"].map((avatar) => (
                    <button
                      key={avatar}
                      type="button"
                      onClick={() => setOnboardingAvatar(avatar)}
                      className={`grid aspect-square place-items-center rounded-md border bg-background transition-colors ${
                        onboardingAvatar === avatar
                          ? "border-primary bg-primary-muted"
                          : "border-border hover:border-primary"
                      }`}
                      aria-label={`Choose ${avatar} avatar`}
                    >
                      <Avatar user={avatar} size="sm" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-md border border-border bg-background p-3">
                <p className="font-mono text-[11px] uppercase text-muted">Generated handle</p>
                <p className="mt-1 font-mono text-sm text-primary">
                  {dashboard?.viewer?.username ?? "g_..."}
                </p>
              </div>

              <button
                type="submit"
                disabled={onboardingPending || onboardingName.trim().length < 2}
                className="h-11 w-full rounded-md bg-dark px-4 text-sm font-medium text-white transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {onboardingPending ? "Saving" : "Enter Grove"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {authState === "error" ? (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border border-danger bg-danger-muted px-4 py-3 text-sm text-danger shadow-lg">
          {authError}
        </div>
      ) : null}

      <footer className="border-t border-text/15 py-5">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-3 px-4 text-xs text-muted sm:px-6">
          <p>Grove · growing on MegaETH</p>
          <p className="font-mono">ongrove.network · {status}</p>
        </div>
      </footer>
    </main>
  );
}
