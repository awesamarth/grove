"use client";

import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Copy,
  Loader2,
  MoreHorizontal,
  Pencil,
  Share2,
  Sprout,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Upload,
  UserPlus,
  WalletCards,
  X,
} from "lucide-react";
import { mega, useStatus } from "@megaeth-labs/wallet-sdk-react";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type FormEvent, type KeyboardEvent, useEffect, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { GroveNav } from "../../../components/grove-nav";
import { ProfileAvatar } from "../../../components/profile-avatar";
import { ActivityDetail, activityBodyText } from "../../../components/activity-detail";
import { useGroveSession } from "../../../lib/use-grove-session";
import { timeAgo } from "../../../lib/time";

const avatarChoices = ["niko", "mira", "raihan", "juno", "kai", "alba"];

function Avatar({
  user,
  avatarUrl,
  label,
  size = "lg",
}: {
  user: string;
  avatarUrl?: string | null;
  label?: string;
  size?: "sm" | "md" | "lg";
}) {
  return <ProfileAvatar avatar={user} avatarUrl={avatarUrl} label={label} size={size} />;
}

function shortWallet(walletAddress: string) {
  return `${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}`;
}

export default function ProfilePage() {
  const params = useParams<{ username: string }>();
  const username = decodeURIComponent(params.username);
  const { address, status } = useStatus();
  const groveSession = useGroveSession();
  const viewerWallet = groveSession.walletAddress ?? undefined;
  const profileData = useQuery(api.dashboard.getProfileByUsername, {
    username,
    viewerWallet,
  });
  const setFollow = useMutation(api.social.setFollow);
  const vote = useMutation(api.social.vote);
  const generateProfileAvatarUploadUrl = useMutation(api.dashboard.generateProfileAvatarUploadUrl);
  const updateProfile = useMutation(api.dashboard.updateProfile);
  const deleteActivity = useMutation(api.dashboard.deleteActivity);
  const [message, setMessage] = useState<string>();
  const [addressCopied, setAddressCopied] = useState(false);
  const [profileCopied, setProfileCopied] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editAvatar, setEditAvatar] = useState("niko");
  const [editAvatarStorageId, setEditAvatarStorageId] = useState<Id<"_storage"> | null | undefined>();
  const [editAvatarPreviewUrl, setEditAvatarPreviewUrl] = useState<string | null>();
  const [editPending, setEditPending] = useState(false);
  const [uploadPending, setUploadPending] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [followModal, setFollowModal] = useState<"followers" | "following" | null>(null);
  const followList = useQuery(
    api.dashboard.getProfileFollows,
    followModal ? { username, kind: followModal } : "skip",
  );

  useEffect(() => {
    if (!menuOpenId) return;
    function close(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-menu-button]") && !target.closest("[data-menu-dropdown]")) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpenId]);

  const isSelf =
    Boolean(viewerWallet && profileData?.profile) &&
    viewerWallet?.toLowerCase() === profileData?.profile.walletAddress.toLowerCase();

  async function toggleFollow() {
    if (!profileData?.profile) return;
    if (!viewerWallet) {
      setMessage("Sign in with MOSS to follow people.");
      window.setTimeout(() => setMessage(undefined), 2200);
      return;
    }

    await setFollow({
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

  async function copyAddress() {
    if (!profileData?.profile) return;

    await navigator.clipboard.writeText(profileData.profile.walletAddress);
    setAddressCopied(true);
    window.setTimeout(() => setAddressCopied(false), 2000);
  }

  async function copyProfileLink() {
    if (!profileData?.profile) return;

    const profileUrl =
      typeof window === "undefined"
        ? `/profile/${profileData.profile.username}`
        : `${window.location.origin}/profile/${profileData.profile.username}`;

    await navigator.clipboard.writeText(profileUrl);
    setProfileCopied(true);
    setMessage("Profile link copied");
    window.setTimeout(() => setProfileCopied(false), 2000);
    window.setTimeout(() => setMessage(undefined), 1800);
  }

  function openEditProfile() {
    if (!profileData?.profile) return;
    setEditName(profileData.profile.displayName);
    setEditBio(profileData.profile.bio);
    setEditAvatar(profileData.profile.avatar);
    setEditAvatarStorageId(undefined);
    setEditAvatarPreviewUrl(profileData.profile.avatarUrl ?? null);
    setEditOpen(true);
  }

  async function uploadAvatar(file: File) {
    if (!file.type.startsWith("image/")) {
      setMessage("Choose an image file.");
      window.setTimeout(() => setMessage(undefined), 1800);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("Avatar image must be under 5 MB.");
      window.setTimeout(() => setMessage(undefined), 1800);
      return;
    }

    setUploadPending(true);
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
      setEditAvatarStorageId(storageId);
      setEditAvatarPreviewUrl(URL.createObjectURL(file));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Avatar upload failed.");
      window.setTimeout(() => setMessage(undefined), 2200);
    } finally {
      setUploadPending(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!viewerWallet || editPending || uploadPending || editName.trim().length < 2) return;

    setEditPending(true);
    try {
      await updateProfile({
        displayName: editName,
        bio: editBio,
        avatar: editAvatar,
        avatarStorageId: editAvatarStorageId,
      });
      setEditOpen(false);
      setMessage("Profile updated");
      window.setTimeout(() => setMessage(undefined), 1800);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update profile.");
      window.setTimeout(() => setMessage(undefined), 2200);
    } finally {
      setEditPending(false);
    }
  }

  function saveProfileFromShortcut(event: KeyboardEvent<HTMLFormElement>) {
    if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") return;
    if (editPending || uploadPending || editName.trim().length < 2) return;

    event.preventDefault();
    event.currentTarget.requestSubmit();
  }

  const editingProfile = editOpen ? profileData?.profile : null;

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
            <div>
              <div className="flex flex-wrap items-start gap-5">
                <Avatar
                  user={profileData.profile.avatar}
                  avatarUrl={profileData.profile.avatarUrl}
                  label={profileData.profile.displayName}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-[clamp(2.5rem,7vw,5rem)] font-medium leading-none">
                      {profileData.profile.displayName}
                      {isSelf ? (
                        <span className="ml-3 inline-flex items-baseline gap-2 align-middle text-xl text-muted">
                          <span>(You)</span>
                          <button
                            type="button"
                            onClick={openEditProfile}
                            className="inline-grid size-5 place-items-center text-muted transition-colors hover:text-primary"
                            aria-label="Edit profile"
                            title="Edit profile"
                          >
                            <span className="relative">
                              <Pencil size={12} />
                              <span className="absolute -bottom-1 left-0 h-px w-full bg-current" />
                            </span>
                          </button>
                        </span>
                      ) : null}
                    </h1>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-text/10 bg-panel px-2.5 font-mono text-xs text-muted">
                      {profileData.profile.xVerified ? (
                        <Check size={14} className="text-primary" strokeWidth={2.4} />
                      ) : null}
                      {profileData.profile.xHandle
                        ? `@${profileData.profile.xHandle}`
                        : profileData.profile.username}
                    </span>

                    <button
                      type="button"
                      onClick={copyAddress}
                      title="Copy wallet address"
                      className="inline-flex h-8 items-center gap-2 rounded-md border border-text/10 bg-panel px-2.5 font-mono text-xs text-muted transition-colors hover:border-primary hover:text-text"
                    >
                      <span className="mono-optical-align">{shortWallet(profileData.profile.walletAddress)}</span>
                      <span className="relative size-3.5">
                        <Copy
                          size={14}
                          className={`absolute inset-0 transition-all duration-200 ${
                            addressCopied ? "scale-75 opacity-0" : "scale-100 opacity-100"
                          }`}
                        />
                        <Check
                          size={14}
                          className={`absolute inset-0 text-primary transition-all duration-200 ${
                            addressCopied ? "scale-100 opacity-100" : "scale-75 opacity-0"
                          }`}
                        />
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={copyProfileLink}
                      title="Copy profile link"
                      className="grid h-8 w-[84px] grid-cols-[14px_42px] items-center justify-center gap-2 rounded-md border border-text/10 bg-panel px-2.5 text-xs text-muted transition-colors hover:border-primary hover:text-text"
                    >
                      <Share2 size={14} />
                      <span className="hidden text-left sm:inline">{profileCopied ? "Copied" : "Share"}</span>
                    </button>
                  </div>

                  <p className="mt-4 max-w-2xl text-lg leading-8 text-muted">{profileData.profile.bio}</p>

                  <div className="mt-7 flex flex-wrap gap-2">
                    {!isSelf ? (
                      <>
                        <button
                          type="button"
                          onClick={toggleFollow}
                          className={`group flex h-10 w-[118px] items-center justify-center gap-2 rounded-md px-3 text-sm font-medium text-white transition-colors ${
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
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 border-y border-text/20">
              <div className="border-r border-text/20 py-4 text-center">
                <p className="font-mono text-xl font-bold text-primary">{profileData.profile.karma}</p>
                <p className="mt-1 text-xs text-muted">karma</p>
              </div>
              <button
                type="button"
                onClick={() => setFollowModal("followers")}
                className="border-r border-text/20 py-4 text-center transition-colors hover:bg-panel"
              >
                <p className="font-mono text-xl font-bold text-primary">{profileData.followerCount}</p>
                <p className="mt-1 text-xs text-muted">followers</p>
              </button>
              <button
                type="button"
                onClick={() => setFollowModal("following")}
                className="py-4 text-center transition-colors hover:bg-panel"
              >
                <p className="font-mono text-xl font-bold text-primary">{profileData.followingCount}</p>
                <p className="mt-1 text-xs text-muted">following</p>
              </button>
            </div>

            <div className="mt-10">
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <p className="font-mono text-[11px] uppercase text-muted">Public activity</p>
                  <h2 className="mt-1 text-2xl font-medium">Recent activity</h2>
                </div>
                <Link
                  href={`/profile/${username}/activity`}
                  className="flex items-center gap-1 text-sm text-primary hover:text-dark"
                >
                  All activity <ChevronRight size={15} />
                </Link>
              </div>

              <div className="overflow-hidden rounded-lg border border-text/15 bg-panel">
                {profileData.recentActivities.length ? (
                  profileData.recentActivities.map((activity) => (
                    <article key={activity._id} className="border-b border-border p-4 last:border-b-0 sm:p-5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[15px] leading-6">
                          {activityBodyText(activity.body, activity.detail)}
                          {!activity.detail ? (
                            <span className="ml-2 font-mono text-[11px] text-muted/60">
                              {timeAgo(activity.happenedAt)}
                            </span>
                          ) : null}
                        </p>
                        <div className="relative shrink-0">
                          <button
                            type="button"
                            data-menu-button
                            onClick={() => setMenuOpenId(menuOpenId === activity._id ? null : activity._id)}
                            className="grid size-7 place-items-center rounded-md text-muted transition-colors hover:bg-panel-hover hover:text-text"
                            aria-label="More actions"
                          >
                            <MoreHorizontal size={16} />
                          </button>
                          {menuOpenId === activity._id ? (
                            <div
                              data-menu-dropdown
                              className="absolute right-0 top-full z-50 mt-1 min-w-[140px] overflow-hidden rounded-lg border border-text/15 bg-panel py-1 shadow-lg"
                            >
                              {activity.actorWallet?.toLowerCase() === viewerWallet?.toLowerCase() ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMenuOpenId(null);
                                    void deleteActivity({ activityId: activity._id });
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-500 transition-colors hover:bg-red-50"
                                >
                                  <Trash2 size={14} />
                                  Delete
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      {activity.detail ? (
                        <div className="mt-3 flex items-center gap-2">
                          <ActivityDetail detail={activity.detail} />
                          <span className="ml-auto font-mono text-[11px] text-muted/60">
                            {timeAgo(activity.happenedAt)}
                          </span>
                        </div>
                      ) : null}
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
                      <span key={follower.walletAddress}>
                        <Avatar
                          user={follower.avatar}
                          avatarUrl={follower.avatarUrl}
                          label={follower.displayName}
                          size="sm"
                        />
                      </span>
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
                <span className="font-mono text-[10px] uppercase text-primary-muted">Grove</span>
              </div>
              <p className="mt-7 text-xl font-medium leading-6">A wallet people can recognize.</p>
              <p className="mt-2 text-sm leading-5 text-white/65">
                Karma, public activity, and identity linkage stay opt-in.
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
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border border-primary bg-primary-muted px-4 py-3 text-sm text-primary shadow-lg">
          {message}
        </div>
      ) : null}

      {followModal ? (
        <div
          className="fixed inset-0 z-[90] grid place-items-center bg-dark/35 px-4 backdrop-blur-sm"
          onMouseDown={() => setFollowModal(null)}
        >
          <div
            className="w-full max-w-[420px] overflow-hidden rounded-lg border border-text/20 bg-panel shadow-[0_24px_80px_rgb(5_32_13/0.25)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border p-5">
              <div>
                <p className="font-mono text-[11px] uppercase text-muted">{profileData?.profile?.displayName}</p>
                <h2 className="mt-1 text-2xl font-medium capitalize">{followModal}</h2>
              </div>
              <button
                type="button"
                onClick={() => setFollowModal(null)}
                className="grid size-8 shrink-0 place-items-center rounded-md border border-border text-muted transition-colors hover:border-text hover:text-text"
                aria-label="Close follows list"
              >
                <X size={16} />
              </button>
            </div>
            <div className="max-h-[360px] overflow-y-auto p-2">
              {followList === undefined ? (
                <div className="p-3 text-sm text-muted">Loading {followModal}...</div>
              ) : followList.people.length ? (
                followList.people.map((person) => (
                  <Link
                    key={person.walletAddress}
                    href={`/profile/${person.username}`}
                    onClick={() => setFollowModal(null)}
                    className="flex items-center gap-3 rounded-md p-3 transition-colors hover:bg-background"
                  >
                    <Avatar user={person.avatar} avatarUrl={person.avatarUrl} label={person.displayName} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{person.displayName}</span>
                      <span className="block truncate text-xs text-muted">
                        {person.xHandle ? `@${person.xHandle}` : person.username}
                      </span>
                    </span>
                    <span className="font-mono text-xs text-primary">{person.karma}</span>
                  </Link>
                ))
              ) : (
                <div className="p-3 text-sm text-muted">No public {followModal} yet.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {editingProfile ? (
        <div
          className="fixed inset-0 z-[90] grid place-items-center bg-dark/35 px-4 backdrop-blur-sm"
          onMouseDown={() => setEditOpen(false)}
        >
          <form
            onSubmit={saveProfile}
            onKeyDown={saveProfileFromShortcut}
            className="w-full max-w-[460px] overflow-hidden rounded-lg border border-text/20 bg-panel shadow-[0_24px_80px_rgb(5_32_13/0.25)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="border-b border-border p-5">
              <p className="font-mono text-[11px] uppercase text-muted">Edit profile</p>
              <h2 className="mt-1 text-2xl font-medium">Update your Grove profile</h2>
            </div>

            <div className="space-y-5 p-5">
              <label className="block">
                <span className="mb-2 block text-sm font-medium">Display name</span>
                <input
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  autoFocus
                  className="h-11 w-full rounded-md border border-border bg-background px-3 text-base outline-none placeholder:text-muted focus:border-primary"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium">Description</span>
                <textarea
                  value={editBio}
                  onChange={(event) => setEditBio(event.target.value)}
                  rows={3}
                  maxLength={180}
                  className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm leading-6 outline-none placeholder:text-muted focus:border-primary"
                  placeholder="Tell people what you are building, playing, or collecting."
                />
              </label>

              <div>
                <p className="mb-2 text-sm font-medium">Avatar</p>
                <div className="mb-3 flex items-center gap-3">
                  <ProfileAvatar
                    avatar={editAvatar}
                    avatarUrl={editAvatarPreviewUrl}
                    label={editName || editingProfile.displayName}
                    size="lg"
                  />
                  <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-text/15 bg-background px-3 text-sm font-medium text-muted transition-colors hover:border-primary hover:text-text">
                    <Upload size={15} />
                    {uploadPending ? "Uploading" : "Upload image"}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadPending}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadAvatar(file);
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
                        setEditAvatar(avatar);
                        setEditAvatarStorageId(null);
                        setEditAvatarPreviewUrl(null);
                      }}
                      className={`grid aspect-square place-items-center rounded-md border bg-background transition-colors ${
                        editAvatar === avatar && !editAvatarPreviewUrl
                          ? "border-primary bg-primary-muted"
                          : "border-border hover:border-primary"
                      }`}
                      aria-label={`Choose ${avatar} avatar`}
                    >
                      <ProfileAvatar avatar={avatar} label={avatar} size="sm" viewable={false} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="h-10 rounded-md border border-border bg-background px-4 text-sm font-medium text-muted transition-colors hover:border-text hover:text-text"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editPending || uploadPending || editName.trim().length < 2}
                  className="h-10 rounded-md bg-dark px-4 text-sm font-medium text-white transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {editPending ? "Saving" : "Save"}
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
