"use client";

import { Bell, Check, CheckCheck, Copy, LogOut, Search, UserRound } from "lucide-react";
import { mega, useStatus } from "@megaeth-labs/wallet-sdk-react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import { notifyGroveSessionChanged, useGroveSession } from "../lib/use-grove-session";
import { timeAgo } from "../lib/time";
import { avatarSrc } from "./profile-avatar";
import { XConnectBanner } from "./x-connect-banner";

type AuthChallenge = {
  token?: string;
  message?: string;
  error?: string;
};

function Avatar({
  user,
  avatarUrl,
  size = "sm",
}: {
  user: string;
  avatarUrl?: string | null;
  size?: "sm" | "md";
}) {
  const sizes = { sm: "size-8", md: "size-9" };
  const isBundledAvatar = !avatarUrl;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarSrc(user, avatarUrl)}
      alt=""
      className={`${sizes[size]} shrink-0 rounded-md border border-text/15 bg-primary-muted object-cover ${
        isBundledAvatar ? "[image-rendering:pixelated]" : ""
      }`}
    />
  );
}

export function GroveNav() {
  const { initialised, status, address } = useStatus();
  const groveSession = useGroveSession();
  const convexAuth = useConvexAuth();
  const upsertProfile = useMutation(api.dashboard.upsertDevProfile);
  const [authPending, setAuthPending] = useState(false);
  const [authError, setAuthError] = useState<string>();
  const [accountOpen, setAccountOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const sessionWallet = groveSession.walletAddress;
  const dashboard = useQuery(api.dashboard.getDashboard, {
    viewerWallet: sessionWallet ?? undefined,
  });
  const searchResults = useQuery(
    api.dashboard.searchProfiles,
    searchQuery.trim().length >= 2 ? { query: searchQuery } : "skip",
  );
  const unreadCount = useQuery(api.notifications.getUnreadCount);
  const notifications = useQuery(api.notifications.getNotifications);
  const clearAll = useMutation(api.notifications.clearAll);

  useEffect(() => {
    if (!sessionWallet || !groveSession.token || !convexAuth.isAuthenticated) return;
    void upsertProfile({}).catch((error) => {
      console.error("Could not create Grove shell profile.", error);
    });
  }, [convexAuth.isAuthenticated, groveSession.token, sessionWallet, upsertProfile]);

  useEffect(() => {
    function closeAccountMenu(event: MouseEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    }

    document.addEventListener("mousedown", closeAccountMenu);
    return () => document.removeEventListener("mousedown", closeAccountMenu);
  }, []);

  useEffect(() => {
    function closeNotifMenu(event: MouseEvent) {
      if (!notifMenuRef.current?.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    }

    document.addEventListener("mousedown", closeNotifMenu);
    return () => document.removeEventListener("mousedown", closeNotifMenu);
  }, []);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (event.key === "/" && !isTyping) {
        event.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      }

      if (event.key === "Escape") {
        setSearchOpen(false);
      }
    }

    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, []);

  async function copyAddress() {
    if (!sessionWallet) return;

    await navigator.clipboard.writeText(sessionWallet);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function logOut() {
    await mega.disconnect();
    await groveSession.clear();
    setAccountOpen(false);
  }

  async function signIn() {
    setAuthPending(true);
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
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "MOSS authentication failed.");
    } finally {
      setAuthPending(false);
    }
  }

  return (
    <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm">
      <header className="border-b border-text/15">
        <div className="mx-auto flex h-14 max-w-[1180px] items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2" aria-label="Grove home">
            <span className="grid size-8 shrink-0 place-items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/grove-logo.png"
                alt=""
                className="size-full scale-[1.55] object-contain"
              />
            </span>
            <span className="relative inline-bloc ml-0.5">
              <span className="absolute left-[8%] top-[58%] h-2 w-14 -translate-y-1/2 rotate-[-6deg] rounded-full bg-primary-muted" />
              <span className="relative text-[1.55rem] font-bold uppercase leading-none text-black">
                Grove
              </span>
            </span>
          </Link>

          <div className="relative hidden w-full max-w-xs md:block">
            <label className="flex h-9 items-center gap-2 rounded-md border border-text/15 bg-panel px-3 text-muted">
              <Search size={15} />
              <input
                aria-label="Search Grove"
                ref={searchInputRef}
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Search people, wallets, activity"
                className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-muted"
              />
              <kbd className="font-mono text-[10px]">/</kbd>
            </label>
            {searchOpen && searchQuery.trim().length >= 2 ? (
              <div className="absolute right-0 top-11 z-50 w-full overflow-hidden rounded-lg border border-text/15 bg-panel shadow-[0_12px_30px_rgb(5_32_13/0.12)]">
                {searchResults === undefined ? (
                  <div className="p-3 text-sm text-muted">Searching...</div>
                ) : searchResults.length ? (
                  searchResults.map((result) => (
                    <Link
                      key={result.walletAddress}
                      href={`/profile/${result.username}`}
                      onClick={() => setSearchOpen(false)}
                      className="flex items-center gap-3 border-b border-border p-3 last:border-b-0 hover:bg-background"
                    >
                      <Avatar user={result.avatar} avatarUrl={result.avatarUrl} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{result.displayName}</span>
                        <span className="block truncate text-xs text-muted">
                          {result.xHandle ? `@${result.xHandle}` : result.username}
                        </span>
                      </span>
                      <span className="font-mono text-xs text-primary">{result.karma}</span>
                    </Link>
                  ))
                ) : (
                  <div className="p-3 text-sm text-muted">No public profiles found.</div>
                )}
              </div>
            ) : null}
          </div>

          <div className="ml-auto" />

          <div ref={notifMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setNotifOpen((open) => !open)}
              aria-label="Notifications"
              title="Notifications"
              className="relative grid size-9 place-items-center rounded-md border border-primary bg-primary text-white transition-colors hover:border-dark hover:bg-dark"
            >
              <Bell size={17} className="translate-y-px" strokeWidth={2} />
              {unreadCount && unreadCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </button>

            {notifOpen && sessionWallet ? (
              <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-lg border border-text/15 bg-panel shadow-[0_12px_30px_rgb(5_32_13/0.12)]">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <p className="text-sm font-semibold">Notifications</p>
                  {notifications && notifications.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => { void clearAll(); }}
                      className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-text"
                    >
                      <CheckCheck size={14} />
                      Clear all
                    </button>
                  ) : null}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications === undefined ? (
                    <div className="p-4 text-sm text-muted">Loading...</div>
                  ) : notifications.length ? (
                    notifications.map((notif) => (
                      <div
                        key={notif._id}
                        className={`border-b border-border px-4 py-3 text-sm last:border-b-0 ${
                          notif.read ? "opacity-60" : ""
                        }`}
                      >
                        <p className={`leading-5 ${notif.read ? "" : "font-medium"}`}>{notif.body}</p>
                        <p className="mt-1 font-mono text-[11px] text-muted">
                          {timeAgo(notif.createdAt)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-sm text-muted">No notifications.</div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {sessionWallet ? (
            <div ref={accountMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setAccountOpen((open) => !open)}
	                aria-label="Open account menu"
	                aria-expanded={accountOpen}
	                className="size-9 translate-y-0.5 overflow-hidden rounded-full ring-4 ring-panel-dark transition-opacity hover:opacity-85"
	              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
	                  src={avatarSrc(dashboard?.viewer?.avatar ?? "niko", dashboard?.viewer?.avatarUrl)}
	                  alt="Your profile"
	                  className={`size-full rounded-full bg-primary-muted object-cover ${
	                    dashboard?.viewer?.avatarUrl ? "" : "scale-[1.08] [image-rendering:pixelated]"
	                  }`}
                />
              </button>

              {accountOpen ? (
                <div className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-lg border border-text/15 bg-panel shadow-[0_12px_30px_rgb(5_32_13/0.12)]">
                  <button
                    type="button"
                    onClick={copyAddress}
                    className="flex h-11 w-full items-center px-3 text-left transition-colors hover:bg-background"
                  >
                    <span className="mono-optical-align min-w-0 flex-1 truncate font-mono text-xs">
                      {sessionWallet.slice(0, 8)}...{sessionWallet.slice(-6)}
                    </span>
                    <span className="relative ml-3 size-3.5 shrink-0 text-muted">
                      <Copy
                        size={14}
                        className={`absolute inset-0 transition-all duration-200 ${copied ? "scale-75 opacity-0" : "scale-100 opacity-100"}`}
                      />
                      <Check
                        size={14}
                        className={`absolute inset-0 text-primary transition-all duration-200 ${copied ? "scale-100 opacity-100" : "scale-75 opacity-0"}`}
                      />
                    </span>
                  </button>
                  {dashboard?.viewer ? (
                    <Link
                      href={`/profile/${dashboard.viewer.username}`}
                      onClick={() => setAccountOpen(false)}
                      className="flex h-11 w-full items-center gap-3 border-t border-border px-3 text-left text-sm text-text transition-colors hover:bg-background"
                    >
                      <UserRound size={15} />
                      View profile
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={logOut}
                    className="flex h-11 w-full items-center gap-3 border-t border-border px-3 text-left text-sm text-danger transition-colors hover:bg-danger-muted"
                  >
                    <LogOut size={15} />
                    Log out
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              disabled={!initialised || authPending}
              onClick={signIn}
              className="h-9 whitespace-nowrap rounded-md bg-dark px-3 text-sm font-medium text-white transition-colors hover:bg-primary disabled:opacity-50 min-[360px]:px-4"
            >
              {!initialised ? (
                "Checking"
              ) : authPending ? (
                "Signing in"
              ) : (
                <>
                  <span className="min-[360px]:hidden">Sign in</span>
                  <span className="hidden min-[360px]:inline">Sign in with MOSS</span>
                </>
              )}
            </button>
          )}
        </div>
      </header>
      <XConnectBanner />

      {authError ? (
        <div className="border-b border-danger bg-danger-muted px-4 py-2 text-center text-sm text-danger">
          {authError}
        </div>
      ) : null}
    </div>
  );
}
