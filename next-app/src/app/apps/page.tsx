"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { GroveNav } from "../../components/grove-nav";

const apps = [
  {
    logo: "/eco-apps/euphoria.jpg",
    name: "Euphoria",
    desc: "Euphoria reimagines crypto trading as a simple, engaging experience. With a tap-to-trade design, it removes friction and complexity, letting users interact with markets in a way that feels natural and intuitive. Mobile-first and powered by MegaETH, Euphoria is built for speed, ease of use, and fun.",
    url: "https://euphoria.finance/",
  },
  {
    logo: "/eco-apps/kumbaya.png",
    name: "Kumbaya",
    desc: "Kumbaya is the flagship launchpad and DEX on MegaETH. The launchpad is designed as a culture-value flywheel with a bulletin-board-style UX, token prompting, gifting, fee sharing with token deployers plus derivative content creators.",
    url: "https://www.kumbaya.xyz/",
  },
  {
    logo: "/eco-apps/hit_one.jpg",
    name: "Hit.One",
    desc: "Hit is pioneering a new category called Arcade Finance: Fast paced, high leverage money games built on top of real markets. The first game is a slot machine for up to 1000x leverage futures trades. One hit can change your life.",
    url: "https://hit.one/",
  },
  {
    logo: "/eco-apps/cap.jpg",
    name: "Cap",
    desc: "Cap is a credit platform that provides principal protection on deposits through financial guarantees. The platform relies on a market of underwriters to independently originate and insure USD loans out of its portfolio. Dollar depositors earn a secured yield insured by underwriters.",
    url: "https://cap.app/",
  },
  {
    logo: "/eco-apps/offshore.jpg",
    name: "Offshore",
    desc: "Offshore Empire is an idle money laundering simulator where you build a global criminal network. Invest USDm in offshore shell companies, acquire assets with unique stats, and automate laundering cycles. Balance aggressive returns against suspicion — push too hard and authorities shut you down.",
    url: "https://app.offshoreprotocol.fun/",
  },
  {
    logo: "/eco-apps/showdown.jpg",
    name: "Showdown",
    desc: "Showdown is poker supercharged with action cards. Five minutes to learn, ten minutes to play, a lifetime to master. Created by top professional players of poker, Hearthstone and Magic the Gathering.",
    url: "https://www.showdown.game/",
  },
  {
    logo: "/eco-apps/monster.jpg",
    name: "Monster",
    desc: "Real graded Pokémon cards. Fair odds. 85% buyback guarantee.",
    url: "https://mnstr.xyz/",
  },
  {
    logo: "/eco-apps/xeet.jpg",
    name: "Xeet",
    desc: "Compete in brand-sponsored tournaments for xeets and crypto rewards. Complete tasks, earn multipliers, and climb the leaderboards to claim prizes.",
    url: "https://www.xeet.ai/",
  },
  {
    logo: "/eco-apps/top-strike.png",
    name: "TopStrike",
    desc: "TopStrike turns every football match into a live market you can feel and trade in real time. With one tap, instantly buy and sell player cards as momentum shifts. Compete on skill-based leaderboards, out-trade your rivals, and earn ETH rewards.",
    url: "https://www.topstrike.io/",
  },
];

export default function AppsPage() {
  return (
    <main className="grove-shell min-h-screen bg-background text-text">
      <GroveNav />

      <section className="mx-auto max-w-[1080px] px-4 py-8 sm:px-6 md:py-14">
        <div className="mb-10 max-w-2xl">
          <p className="font-mono text-[11px] uppercase text-muted">Ecosystem</p>
          <h1 className="mt-3 text-[clamp(2.4rem,7vw,4.4rem)] font-medium leading-[0.94]">
            Apps on MegaETH
          </h1>
          <p className="mt-5 text-base leading-7 text-muted">
            Discover the apps, games, and protocols building on MegaETH. Click through to explore.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <a
              key={app.name}
              href={app.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col overflow-hidden rounded-lg border border-text/15 bg-panel transition-colors hover:bg-background"
            >
              <div className="flex items-center gap-4 border-b border-border p-5">
                <img
                  src={app.logo}
                  alt={app.name}
                  className="size-12 shrink-0 rounded-md border border-text/15 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-xl font-medium">{app.name}</h2>
                    <ArrowUpRight
                      size={14}
                      className="shrink-0 text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    />
                  </div>
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col p-5 pt-4">
                <p className="text-sm leading-6 text-muted">{app.desc}</p>
              </div>
            </a>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/"
            className="inline-flex h-10 items-center gap-1 text-sm text-muted transition-colors hover:text-text"
          >
            Back home
          </Link>
        </div>
      </section>
    </main>
  );
}
