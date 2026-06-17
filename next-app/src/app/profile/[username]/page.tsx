"use client";

import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Heart,
  Loader2,
  Sprout,
  ThumbsDown,
  ThumbsUp,
  UserPlus,
  WalletCards,
} from "lucide-react";
import { mega, useStatus } from "@megaeth-labs/wallet-sdk-react";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { GroveNav } from "../../../components/grove-nav";

function Avatar({ user, size = "lg" }: { user: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "size-8", md: "size-12", lg: "size-20" };
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/avatars/${user}.png`}
      alt=""
      className={`${sizes[size]} rounded-md border border-text/15 bg-primary-muted object-cover [image-rendering:pixelated]`}
    />
  );
}

function shortWallet(walletAddress: string) {
  return `${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}`;
}

export default function ProfilePage() {
  const params = useParams<{ username: string }>();
  const username = decodeURIComponent(params.username);
  const { address, status } = useStatus();
  const [devWallet] = useState<string | undefined>(() =>
    typeof window === "undefined"
      ? undefined
      : (window.localStorage.getItem("grove:devWallet") ?? undefined),
  );
  const viewerWallet = address ?? devWallet;
  const profileData = useQuery(api.dashboard.getProfileByUsername, {
    username,
    viewerWallet,
  });
  const setFollow = useMutation(api.social.setFollow);
  const vote = useMutation(api.social.vote);
  const [message, setMessage] = useState<string>();
  const [renderedAt] = useState(() => Date.now());
  const isSelf =
    Boolean(viewerWallet && profileData?.profile) &&
    viewerWallet?.toLowerCase() === profileData?.profile.walletAddress.toLowerCase();

  function minutesAgo(happenedAt: number) {
    return Math.max(1, Math.round((renderedAt - happenedAt) / 60_000));
  }

  async function toggleFollow() {
    if (!profileData?.profile) return;
    if (!viewerWallet) {
      setMessage("Sign in with MOSS to follow people.");
      window.setTimeout(() => setMessage(undefined), 2200);
      return;
    }

    await setFollow({
      devWalletAddress: viewerWallet,
      targetWallet: profileData.profile.walletAddress,
      following: !profileData.isFollowed,
    });
    setMessage(profileData.isFollowed ? "Unfollowed" : "Following");
    window.setTimeout(() => setMessage(undefined), 1800);
  }

  async function voteOn(value: 1 | -1) {
    if (!profileData?.profile) return;
    if (!viewerWallet) {
      setMessage("Sign in with MOSS to vote.");
      window.setTimeout(() => setMessage(undefined), 2200);
      return;
    }

    await vote({
      devWalletAddress: viewerWallet,
      targetWallet: profileData.profile.walletAddress,
      value,
    });
    setMessage(value === 1 ? "Reputation upvoted" : "Reputation downvoted");
    window.setTimeout(() => setMessage(undefined), 1800);
  }

  async function tipWithMoss() {
    if (!profileData?.profile) return;

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
        destination: profileData.profile.walletAddress as `0x${string}`,
      });

      if (result.status === "cancelled") return;
      if (result.status === "error") {
        throw new Error(result.error ?? "MOSS tip flow failed.");
      }

      setMessage("MOSS tip flow opened");
      window.setTimeout(() => setMessage(undefined), 1800);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "MOSS tip flow failed.");
      window.setTimeout(() => setMessage(undefined), 2200);
    }
  }

  return (
    <main className="grove-shell min-h-screen bg-background text-text">
      <GroveNav />

      {!profileData ? (
        <section className="mx-auto grid min-h-[70vh] max-w-[1080px] place-items-center px-4">
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="animate-spin" size={16} />
            Loading Grove profile
          </p>
        </section>
      ) : profileData.profile ? (
        <section className="mx-auto grid max-w-[1080px] gap-8 px-4 py-8 sm:px-6 md:grid-cols-[minmax(0,1fr)_320px] md:py-12">
          <div>
            <div className="border-b border-text/15 pb-7">
              <div className="flex flex-wrap items-start gap-5">
                <Avatar user={profileData.profile.avatar} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-[clamp(2.5rem,7vw,5rem)] font-medium leading-none">
                      {profileData.profile.displayName}
                      {isSelf ? <span className="ml-3 align-middle text-lg text-muted">(You)</span> : null}
                    </h1>
                    {profileData.profile.xVerified ? (
                      <span className="mt-2 text-primary" title="Verified X account">
                        <Check size={24} strokeWidth={2.4} />
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 font-mono text-sm text-muted">
                    {profileData.profile.xHandle
                      ? `@${profileData.profile.xHandle}`
                      : profileData.profile.username}
                    {" · "}
                    {shortWallet(profileData.profile.walletAddress)}
                  </p>
                </div>
              </div>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">{profileData.profile.bio}</p>

              <div className="mt-7 flex flex-wrap gap-2">
                {!isSelf ? (
                  <>
                    <button
                      type="button"
                      onClick={toggleFollow}
                      className={`group flex h-10 items-center gap-2 rounded-md px-4 text-sm font-medium text-white transition-colors ${
                        profileData.isFollowed ? "bg-primary hover:bg-danger" : "bg-dark hover:bg-primary"
                      }`}
                    >
                      {profileData.isFollowed ? <Check size={16} /> : <UserPlus size={16} />}
                      {profileData.isFollowed ? (
                        <>
                          <span className="group-hover:hidden">Following</span>
                          <span className="hidden group-hover:inline">Unfollow</span>
                        </>
                      ) : (
                        "Follow"
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={tipWithMoss}
                      className="flex h-10 items-center gap-2 rounded-md border border-primary bg-primary-muted px-4 text-sm font-medium text-primary transition-colors hover:border-dark hover:bg-dark hover:text-white"
                    >
                      <WalletCards size={16} />
                      Tip
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            <div className="mt-7 grid grid-cols-3 border-y border-text/20">
              {[
                [profileData.profile.reputation, "rep"],
                [profileData.profile.upvotes, "upvotes"],
                [profileData.profile.downvotes, "downvotes"],
              ].map(([value, label]) => (
                <div key={label} className="border-r border-text/20 py-4 text-center last:border-r-0">
                  <p className="font-mono text-xl font-bold text-primary">{value}</p>
                  <p className="mt-1 text-xs text-muted">{label}</p>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <p className="font-mono text-[11px] uppercase text-muted">Public activity</p>
                  <h2 className="mt-1 text-2xl font-medium">Recent activity</h2>
                </div>
                <button type="button" className="flex items-center gap-1 text-sm text-primary hover:text-dark">
                  All activity <ChevronRight size={15} />
                </button>
              </div>

              <div className="overflow-hidden rounded-lg border border-text/15 bg-panel">
                {profileData.recentActivities.length ? (
                  profileData.recentActivities.map((activity) => (
                    <article key={activity._id} className="border-b border-border p-4 last:border-b-0 sm:p-5">
                      <div className="flex items-start justify-between gap-4">
                        <p className="text-[15px] leading-6">{activity.body}</p>
                        <span className="font-mono text-[11px] text-muted">
                          {minutesAgo(activity.happenedAt)}m
                        </span>
                      </div>
                      <div className="mt-3 inline-flex min-h-7 items-center rounded-md border border-text/15 bg-primary-muted px-2 font-mono text-[11px] text-primary">
                        {activity.detail}
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="p-5 text-sm text-muted">No public activity shared yet.</div>
                )}
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            {!isSelf ? (
              <section className="overflow-hidden rounded-lg border border-text/15 bg-panel">
                <div className="border-b border-border p-4">
                  <p className="font-mono text-[11px] uppercase text-muted">Reputation</p>
                  <h2 className="mt-1 text-xl font-medium">Community vote</h2>
                </div>
                <div className="grid grid-cols-2 gap-2 p-4">
                  <button
                    type="button"
                    onClick={() => voteOn(1)}
                    className="flex h-10 items-center justify-center gap-2 rounded-md bg-primary-muted text-sm font-medium text-primary hover:bg-primary hover:text-white"
                  >
                    <ThumbsUp size={15} />
                    Up
                  </button>
                  <button
                    type="button"
                    onClick={() => voteOn(-1)}
                    className="flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-background text-sm font-medium text-muted hover:border-danger hover:bg-danger-muted hover:text-danger"
                  >
                    <ThumbsDown size={15} />
                    Down
                  </button>
                </div>
              </section>
            ) : null}

            <section className="overflow-hidden rounded-lg border border-text/15 bg-panel">
              <div className="border-b border-border p-4">
                <p className="font-mono text-[11px] uppercase text-muted">Followers</p>
                <h2 className="mt-1 text-xl font-medium">
                  {profileData.followerCount} {profileData.followerCount === 1 ? "follower" : "followers"}
                </h2>
              </div>
              <div className="p-4">
                {profileData.followersPreview.length ? (
                  <div className="flex -space-x-2">
                    {profileData.followersPreview.map((follower) => (
                      <Link key={follower.walletAddress} href={`/profile/${follower.username}`}>
                        <Avatar user={follower.avatar} size="sm" />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted">
                    {isSelf ? "No public followers yet." : "Be the first public follower."}
                  </p>
                )}
              </div>
            </section>

            <section className="border border-dark bg-dark p-5 text-white">
              <div className="flex items-start justify-between">
                <Sprout className="text-primary-muted" size={22} />
                <span className="font-mono text-[10px] uppercase text-primary-muted">Grove card</span>
              </div>
              <p className="mt-7 text-xl font-medium leading-6">A wallet people can recognize.</p>
              <p className="mt-2 text-sm leading-5 text-white/65">
                Reputation, public activity, and identity linkage stay opt-in.
              </p>
            </section>
          </aside>
        </section>
      ) : (
        <section className="mx-auto grid min-h-[70vh] max-w-[760px] place-items-center px-4 text-center">
          <div>
            <p className="font-mono text-[11px] uppercase text-muted">Private or missing</p>
            <h1 className="mt-3 text-5xl font-medium">No public Grove profile.</h1>
            <p className="mt-4 text-muted">This wallet has not opted into a public profile.</p>
            <Link
              href="/"
              className="mt-6 inline-flex h-10 items-center gap-2 rounded-md bg-dark px-4 text-sm font-medium text-white hover:bg-primary"
            >
              Back home <ArrowUpRight size={15} />
            </Link>
          </div>
        </section>
      )}

      {message ? (
        <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-md border border-primary bg-primary-muted px-4 py-3 text-sm text-primary shadow-lg">
          <Heart size={14} />
          {message}
        </div>
      ) : null}
    </main>
  );
}
