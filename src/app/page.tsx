"use client";

import {
  ArrowUpRight,
  Bell,
  ChevronRight,
  Check,
  Copy,
  Gamepad2,
  Heart,
  LogOut,
  Search,
  Sparkles,
  Sprout,
  Trophy,
  UserPlus,
  WalletCards,
} from "lucide-react";
import { mega, useStatus } from "@megaeth-labs/wallet-sdk-react";
import { useEffect, useRef, useState } from "react";

const activities = [
  {
    user: "mira",
    name: "Mira",
    handle: "@miramakes",
    time: "2m",
    icon: Trophy,
    tone: "success",
    body: (
      <>
        placed <strong>#3</strong> in the weekly <strong>Noise Arena</strong> run
      </>
    ),
    detail: "1,240 pts · personal best",
    reactions: 18,
  },
  {
    user: "raihan",
    name: "Raihan",
    handle: "@rxhn",
    time: "11m",
    icon: WalletCards,
    tone: "primary",
    body: (
      <>
        tipped <strong>Juno</strong> for shipping a new community tool
      </>
    ),
    detail: "8.00 USDM",
    reactions: 31,
  },
  {
    user: "juno",
    name: "Juno",
    handle: "@juno_builds",
    time: "28m",
    icon: Sparkles,
    tone: "warning",
    body: (
      <>
        minted <strong>Garden Plot #1842</strong> in Euphoria
      </>
    ),
    detail: "first mint · testnet",
    reactions: 9,
  },
  {
    user: "kai",
    name: "Kai",
    handle: "@kaiworld",
    time: "44m",
    icon: Gamepad2,
    tone: "dark",
    body: (
      <>
        started playing <strong>Words3</strong>
      </>
    ),
    detail: "round 6 · 4 friends playing",
    reactions: 6,
  },
];

const people = [
  { user: "alba", name: "Alba", handle: "@alba", score: 92, mutual: 14 },
  { user: "niko", name: "Niko", handle: "@nikos", score: 87, mutual: 8 },
  { user: "mira", name: "Mira", handle: "@miramakes", score: 81, mutual: 5 },
];

const apps = [
  { glyph: "N", name: "Noise Arena", players: "1.8k", tint: "#cdefde" },
  { glyph: "W", name: "Words3", players: "942", tint: "#dfe8ff" },
  { glyph: "E", name: "Euphoria", players: "614", tint: "#f6dfd6" },
];

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
  const [authPending, setAuthPending] = useState(false);
  const [authState, setAuthState] = useState<"idle" | "success" | "error">("idle");
  const [authError, setAuthError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [tab, setTab] = useState<"activity" | "people" | "apps">("activity");
  const [followed, setFollowed] = useState<string[]>([]);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const isSignedIn = status === "connected";

  useEffect(() => {
    function closeAccountMenu(event: MouseEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    }

    document.addEventListener("mousedown", closeAccountMenu);
    return () => document.removeEventListener("mousedown", closeAccountMenu);
  }, []);

  async function copyAddress() {
    if (!address) return;

    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function logOut() {
    await mega.disconnect();
    setAccountOpen(false);
    setAuthState("idle");
  }

  async function signIn() {
    setAuthPending(true);
    setAuthState("idle");
    setAuthError(undefined);

    try {
      if (status !== "connected") {
        const connection = await mega.connect();

        if (connection.status === "cancelled") return;
        if (connection.status !== "connected") {
          throw new Error("MOSS wallet could not connect.");
        }
      }

      const auth = await mega.authenticate();

      if (auth.status === "cancelled") return;
      if (auth.status === "error" || !auth.jwt) {
        throw new Error(auth.error ?? "MOSS authentication failed.");
      }

      setAuthState("success");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "MOSS authentication failed.");
      setAuthState("error");
    } finally {
      setAuthPending(false);
    }
  }

  function toggleFollow(user: string) {
    setFollowed((current) =>
      current.includes(user) ? current.filter((item) => item !== user) : [...current, user],
    );
  }

  return (
    <main className="grove-shell min-h-screen bg-background text-text">
      <header className="sticky top-0 z-30 border-b border-text/15 bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[1180px] items-center gap-4 px-4 sm:px-6">
          <a href="#" className="flex items-center gap-2" aria-label="Grove home">
            <span className="grid size-7 place-items-center rounded-md bg-dark text-primary-muted">
              <Sprout size={17} strokeWidth={2.2} />
            </span>
            <span className="text-xl font-semibold">Grove</span>
          </a>

          <label className="ml-auto hidden h-9 w-full max-w-xs items-center gap-2 rounded-md border border-text/15 bg-panel px-3 text-muted md:flex">
            <Search size={15} />
            <input
              aria-label="Search Grove"
              placeholder="Search people, apps, activity"
              className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-muted"
            />
            <kbd className="font-mono text-[10px]">/</kbd>
          </label>

          <button
            type="button"
            aria-label="Notifications"
            title="Notifications"
            className="grid size-9 place-items-center rounded-md border border-primary bg-primary text-white transition-colors hover:border-dark hover:bg-dark"
          >
            <Bell size={17} className="translate-y-px" strokeWidth={2} />
          </button>

          {isSignedIn && address ? (
            <div ref={accountMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setAccountOpen((open) => !open)}
                aria-label="Open account menu"
                aria-expanded={accountOpen}
                className="size-9 translate-y-0.5 overflow-hidden rounded-full border-2 border-primary bg-dark p-0.5 transition-opacity hover:opacity-85"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/avatars/niko.png"
                  alt="Your profile"
                  className="size-full scale-[1.08] rounded-full bg-dark object-contain [image-rendering:pixelated]"
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
                      {address.slice(0, 8)}...{address.slice(-6)}
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

      <section className="border-b border-text/15">
        <div className="mx-auto grid max-w-[1180px] gap-7 px-4 py-8 sm:px-6 md:grid-cols-[1fr_auto] md:items-end md:py-10">
          <div>
            <div className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase text-muted">
              <span className="size-2 animate-pulse rounded-full bg-success" />
              Live on MegaETH testnet
            </div>
            <h1 className="max-w-3xl text-[clamp(2.2rem,6vw,4.9rem)] font-medium leading-[0.94]">
              MegaETH is more than just a chain.
              <span className="mt-1 block text-primary">It&apos;s who shows up.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">
              Follow the people, games, apps, and real activity growing across the network.
            </p>
          </div>

          <div className="grid grid-cols-3 border-y border-text/20 md:w-[340px]">
            {[
              ["1,284", "people"],
              ["8,420", "activities"],
              ["34", "apps"],
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
              <p className="font-mono text-[11px] uppercase text-muted">Public signal</p>
              <h2 className="mt-1 text-2xl font-medium">Live on Grove</h2>
            </div>
            <button type="button" className="flex items-center gap-1 text-sm text-primary hover:text-dark">
              View all <ChevronRight size={15} />
            </button>
          </div>

          <div className="overflow-hidden rounded-lg border border-text/15 bg-panel">
            {activities.map((activity) => {
              const Icon = activity.icon;
              return (
                <article key={`${activity.user}-${activity.time}`} className="grid grid-cols-[auto_1fr] gap-3 border-b border-border p-4 last:border-b-0 sm:p-5">
                  <Avatar user={activity.user} />
                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm">
                          <strong className="font-semibold">{activity.name}</strong>{" "}
                          <span className="text-muted">{activity.handle}</span>
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
                      <button type="button" className="ml-auto flex items-center gap-1.5 text-xs text-muted hover:text-danger">
                        <Heart size={14} /> {activity.reactions}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-5 flex items-center justify-between border-y border-text/20 py-4">
            <p className="text-sm text-muted">Your people are already here.</p>
            <button type="button" onClick={signIn} className="flex items-center gap-2 text-sm font-medium text-primary hover:text-dark">
              Join the network <ArrowUpRight size={15} />
            </button>
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
              {people.map((person) => {
                const isFollowed = followed.includes(person.user);
                return (
                  <div key={person.user} className="flex items-center gap-3 border-b border-text/10 py-3 last:border-b-0">
                    <Avatar user={person.user} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{person.name}</p>
                      <p className="truncate text-xs text-muted">{person.handle} · {person.mutual} mutuals</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-xs font-bold text-primary">{person.score}</p>
                      <button
                        type="button"
                        onClick={() => toggleFollow(person.user)}
                        className="mt-1 text-xs text-muted hover:text-text"
                      >
                        {isFollowed ? "following" : "+ follow"}
                      </button>
                    </div>
                  </div>
                );
              })}
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
