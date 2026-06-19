"use client";

import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Gamepad2,
  Heart,
  Sparkles,
  Sprout,
  Trophy,
  Upload,
  UserPlus,
  WalletCards,
  X,
} from "lucide-react";
import { mega, useStatus } from "@megaeth-labs/wallet-sdk-react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { type FormEvent, type KeyboardEvent as ReactKeyboardEvent, useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { GroveNav } from "../components/grove-nav";
import { ProfileAvatar } from "../components/profile-avatar";
import { useXConnect } from "../components/x-connect-modal";
import { notifyGroveSessionChanged, useGroveSession } from "../lib/use-grove-session";

const avatarChoices = ["niko", "mira", "raihan", "juno", "kai", "alba"];

const apps = [
  { logo: "/eco-apps/euphoria.jpg", name: "Euphoria", desc: "Tap-to-trade crypto, mobile-first.", players: "614", url: "https://euphoria.finance/" },
  { logo: "/eco-apps/hit_one.jpg", name: "Hit.One", desc: "Arcade finance: high leverage money games.", players: "1.2k", url: "https://hit.one/" },
  { logo: "/eco-apps/cap.jpg", name: "Cap", desc: "Credit platform with principal protection.", players: "387", url: "https://cap.app/" },
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

function Avatar({
  user,
  avatarUrl,
  label,
  size = "md",
  viewable = true,
}: {
  user: string;
  avatarUrl?: string | null;
  label?: string;
  size?: "sm" | "md" | "lg";
  viewable?: boolean;
}) {
  const profileAvatarSize = size === "lg" ? "xl" : size;
  return (
    <ProfileAvatar
      avatar={user}
      avatarUrl={avatarUrl}
      label={label}
      size={profileAvatarSize}
      viewable={viewable}
    />
  );
}

export default function Home() {
  const { initialised, status, address } = useStatus();
  const groveSession = useGroveSession();
  const convexAuth = useConvexAuth();
  const { connectX, pending: xConnectPending, error: xConnectError } = useXConnect();
  const seed = useMutation(api.seed.initialise);
  const upsertProfile = useMutation(api.dashboard.upsertDevProfile);
  const updatePrivacy = useMutation(api.dashboard.updatePrivacy);
  const completeOnboarding = useMutation(api.dashboard.completeOnboarding);
  const generateProfileAvatarUploadUrl = useMutation(api.dashboard.generateProfileAvatarUploadUrl);
  const setFollow = useMutation(api.social.setFollow);
  const vote = useMutation(api.social.vote);
  const [authPending, setAuthPending] = useState(false);
  const [authState, setAuthState] = useState<"idle" | "success" | "error">("idle");
  const [authError, setAuthError] = useState<string>();
  const [tab, setTab] = useState<"activity" | "people" | "apps">("activity");
  const [optimisticPrivacy, setOptimisticPrivacy] = useState<Privacy>();
  const [onboardingName, setOnboardingName] = useState("");
  const [onboardingBio, setOnboardingBio] = useState("");
  const [onboardingAvatar, setOnboardingAvatar] = useState("niko");
  const [onboardingAvatarStorageId, setOnboardingAvatarStorageId] = useState<Id<"_storage"> | undefined>();
  const [onboardingAvatarPreviewUrl, setOnboardingAvatarPreviewUrl] = useState<string | null>();
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<"profile" | "x">("profile");
  const [onboardingPromptedWallet, setOnboardingPromptedWallet] = useState<string>();
  const [onboardingPending, setOnboardingPending] = useState(false);
  const [onboardingUploadPending, setOnboardingUploadPending] = useState(false);
  const viewerWallet = groveSession.walletAddress ?? undefined;
  const dashboard = useQuery(api.dashboard.getDashboard, {
    viewerWallet,
  });
  const activePrivacy = optimisticPrivacy ?? dashboard?.viewer?.privacy;
  const needsOnboarding = Boolean(
    viewerWallet && dashboard?.viewer && !dashboard.viewer.onboardingComplete,
  );
  const profileStateReady = !viewerWallet || dashboard !== undefined;
  const showSetupCta = !viewerWallet || (profileStateReady && needsOnboarding);

  useEffect(() => {
    void seed({});
  }, [seed]);

  useEffect(() => {
    if (!viewerWallet || !groveSession.token || !convexAuth.isAuthenticated) return;
    void upsertProfile({}).catch((error) => {
      console.error("Could not create Grove shell profile.", error);
    });
  }, [convexAuth.isAuthenticated, groveSession.token, viewerWallet, upsertProfile]);

  useEffect(() => {
    if (!needsOnboarding || !viewerWallet || onboardingPromptedWallet === viewerWallet) return;
    setOnboardingStep("profile");
    setOnboardingOpen(true);
    setOnboardingPromptedWallet(viewerWallet);
  }, [needsOnboarding, onboardingPromptedWallet, viewerWallet]);

  useEffect(() => {
    if (!onboardingOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOnboardingOpen(false);
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onboardingOpen]);

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

      await groveSession.refresh();
      notifyGroveSessionChanged();
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
      targetWallet,
      value,
    });
  }

  async function finishOnboarding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!viewerWallet || onboardingPending || onboardingUploadPending || onboardingName.trim().length < 2) return;
    setOnboardingPending(true);
    setAuthError(undefined);

    try {
      await completeOnboarding({
        displayName: onboardingName,
        bio: onboardingBio,
        avatar: onboardingAvatar,
        avatarStorageId: onboardingAvatarStorageId,
      });
      setOnboardingStep("x");
      setAuthState("success");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not finish onboarding.");
      setAuthState("error");
    } finally {
      setOnboardingPending(false);
    }
  }

  async function uploadOnboardingAvatar(file: File) {
    if (!file.type.startsWith("image/")) {
      setAuthError("Choose an image file.");
      setAuthState("error");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAuthError("Avatar image must be under 5 MB.");
      setAuthState("error");
      return;
    }

    setOnboardingUploadPending(true);
    setAuthError(undefined);

    try {
      const uploadUrl = await generateProfileAvatarUploadUrl();
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "content-type": file.type },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error("Avatar upload failed.");
      }

      const { storageId } = (await uploadResponse.json()) as { storageId: Id<"_storage"> };
      setOnboardingAvatarStorageId(storageId);
      setOnboardingAvatarPreviewUrl(URL.createObjectURL(file));
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Avatar upload failed.");
      setAuthState("error");
    } finally {
      setOnboardingUploadPending(false);
    }
  }

  function finishOnboardingFromShortcut(event: ReactKeyboardEvent<HTMLFormElement>) {
    if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") return;
    if (onboardingPending || onboardingUploadPending || onboardingName.trim().length < 2) return;

    event.preventDefault();
    event.currentTarget.requestSubmit();
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
                homies <span className="text-primary">hang out.</span>
              </span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">
              Follow the people, games, apps, and real activity growing across the network.
            </p>
            {showSetupCta ? (
              <button
                type="button"
                disabled={!viewerWallet && (!initialised || authPending)}
                onClick={() => {
                  if (viewerWallet) {
                    setOnboardingOpen(true);
                    return;
                  }
                  void signIn();
                }}
                className="mt-5 h-10 rounded-md border border-primary bg-primary-muted px-4 text-sm font-medium text-primary transition-colors hover:border-dark hover:bg-dark hover:text-white disabled:opacity-50"
              >
                {!viewerWallet && authPending ? "Opening MOSS" : "Set up your profile"}
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
                <article key={activity._id} className="grid grid-cols-[auto_1fr] items-start gap-3 border-b border-border p-4 last:border-b-0 sm:p-5">
                  {actor ? (
                    <Avatar user={actor.avatar} avatarUrl={actor.avatarUrl} label={actor.displayName} />
                  ) : (
                    <Avatar user="niko" label="Unknown" />
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
                    <Avatar user={person.avatar} avatarUrl={person.avatarUrl} label={person.displayName} size="sm" />
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
                      <div className="mt-1 flex items-center gap-1.5 text-xs">
                        <button
                          type="button"
                          onClick={() => tipWithMoss(person.walletAddress)}
                          className="text-primary hover:text-dark"
                        >
                          tip
                        </button>
                        <span className="text-muted/40">|</span>
                        <button
                          type="button"
                          onClick={() => toggleFollow(person.walletAddress, !person.isFollowed)}
                          className="text-muted hover:text-text"
                        >
                          {person.isFollowed ? "following" : "follow"}
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
              <p className="font-mono text-[11px] uppercase text-muted">Your Profile</p>
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
                <button
                  type="button"
                  onClick={() => setOnboardingOpen(true)}
                  className="h-10 w-full rounded-md bg-dark px-4 text-sm font-medium text-white transition-colors hover:bg-primary"
                >
                  Set up your profile
                </button>
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
                      <div className="rounded-md border border-text/15 bg-background px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="grid size-5 shrink-0 place-items-center rounded-full border border-primary text-primary">
                            <Check size={13} strokeWidth={2.4} />
                          </span>
                          <p className="min-w-0 flex-1 truncate font-mono text-sm text-text">
                            @{dashboard.viewer.xHandle ?? dashboard.viewer.username}
                          </p>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-muted">
                          Verified through X. This handle is your Grove username.
                        </p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setOnboardingStep("x");
                          setOnboardingOpen(true);
                        }}
                        className="h-9 w-full rounded-md bg-dark px-3 text-sm font-medium text-white hover:bg-primary"
                      >
                        Connect X
                      </button>
                    )}
                    {!dashboard?.viewer?.xVerified ? (
                      <p className="mt-2 text-xs leading-5 text-muted">
                        Verified users use their X handle as their Grove username.
                      </p>
                    ) : null}
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
                <a key={app.name} href={app.url} target="_blank" rel="noopener noreferrer" className="group flex w-full items-center gap-3 border-b border-border p-3 text-left last:border-b-0 hover:bg-background">
                  <img src={app.logo} alt={app.name} className="size-10 rounded-md border border-text/15 object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{app.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted">{app.desc}</span>
                  </span>
                  <ArrowUpRight size={14} className="shrink-0 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </a>
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

      {onboardingOpen ? (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-dark/35 px-4 backdrop-blur-sm"
          onMouseDown={() => setOnboardingOpen(false)}
        >
          <form
            onSubmit={onboardingStep === "profile" ? finishOnboarding : (event) => event.preventDefault()}
            onKeyDown={onboardingStep === "profile" ? finishOnboardingFromShortcut : undefined}
            className="w-full max-w-[460px] overflow-hidden rounded-lg border border-text/20 bg-panel shadow-[0_24px_80px_rgb(5_32_13/0.25)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border p-5">
              <div>
                <p className="font-mono text-[11px] uppercase text-muted">
                  {onboardingStep === "profile" ? "Set up Grove" : "Connect X"}
                </p>
                <h2 className="mt-1 text-2xl font-medium">
                  {onboardingStep === "profile" ? "Set up your profile" : "Claim your X handle"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {onboardingStep === "profile"
                    ? "Add a display name, optional bio, and avatar. Connect X later to use your verified X handle."
                    : "Verify X once to use your X handle as your Grove username."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOnboardingOpen(false)}
                className="grid size-8 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-background hover:text-text"
                aria-label="Close onboarding"
              >
                <X size={18} />
              </button>
            </div>

            {onboardingStep === "profile" ? (
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

              <label className="block">
                <span className="mb-2 block text-sm font-medium">Bio <span className="text-muted">(optional)</span></span>
                <textarea
                  value={onboardingBio}
                  onChange={(event) => setOnboardingBio(event.target.value)}
                  rows={3}
                  maxLength={180}
                  placeholder="Tell people what you are building, playing, or collecting."
                  className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm leading-6 outline-none placeholder:text-muted focus:border-primary"
                />
              </label>

              <div>
                <p className="mb-2 text-sm font-medium">Avatar</p>
                <div className="mb-3 flex items-center gap-3">
                  <ProfileAvatar
                    avatar={onboardingAvatar}
                    avatarUrl={onboardingAvatarPreviewUrl}
                    label={onboardingName || "Grove profile"}
                    size="lg"
                    viewable={false}
                  />
                  <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-text/15 bg-background px-3 text-sm font-medium text-muted transition-colors hover:border-primary hover:text-text">
                    <Upload size={15} />
                    {onboardingUploadPending ? "Uploading" : "Upload image"}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={onboardingUploadPending}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadOnboardingAvatar(file);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {avatarChoices.map((avatar) => (
                    <button
                      key={avatar}
                      type="button"
                      onClick={() => {
                        setOnboardingAvatar(avatar);
                        setOnboardingAvatarStorageId(undefined);
                        setOnboardingAvatarPreviewUrl(null);
                      }}
                      className={`grid aspect-square place-items-center rounded-md border bg-background transition-colors ${
                        onboardingAvatar === avatar && !onboardingAvatarPreviewUrl
                          ? "border-primary bg-primary-muted"
                          : "border-border hover:border-primary"
                      }`}
                      aria-label={`Choose ${avatar} avatar`}
                    >
                      <Avatar user={avatar} size="sm" viewable={false} />
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
                disabled={onboardingPending || onboardingUploadPending || onboardingName.trim().length < 2}
                className="h-11 w-full rounded-md bg-dark px-4 text-sm font-medium text-white transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {onboardingPending ? "Saving" : "Enter Grove"}
              </button>
            </div>
            ) : (
              <div className="space-y-4 p-5">
                {xConnectError ? (
                  <p className="rounded-md border border-danger bg-danger-muted px-3 py-2 text-sm text-danger">
                    {xConnectError}
                  </p>
                ) : null}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOnboardingOpen(false)}
                    className="h-10 rounded-md border border-border bg-background px-4 text-sm font-medium text-muted transition-colors hover:border-text hover:text-text"
                  >
                    Skip for now
                  </button>
                  <button
                    type="button"
                    disabled={xConnectPending}
                    onClick={() => void connectX()}
                    className="h-10 rounded-md bg-dark px-4 text-sm font-medium text-white transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {xConnectPending ? "Opening X" : "Connect X"}
                  </button>
                </div>
              </div>
            )}
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
