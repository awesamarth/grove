"use client";

import { ArrowUpRight, ChevronLeft, Loader2 } from "lucide-react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { api } from "../../../../../convex/_generated/api";
import { GroveNav } from "../../../../components/grove-nav";
import { ProfileAvatar } from "../../../../components/profile-avatar";
import { ActivityDetail, activityBodyText } from "../../../../components/activity-detail";

export default function ProfileActivityPage() {
  const params = useParams<{ username: string }>();
  const username = decodeURIComponent(params.username);
  const data = useQuery(api.dashboard.getProfileActivities, { username });
  const [renderedAt] = useState(() => Date.now());

  function minutesAgo(happenedAt: number) {
    return Math.max(1, Math.round((renderedAt - happenedAt) / 60_000));
  }

  return (
    <main className="grove-shell min-h-screen bg-background text-text">
      <GroveNav />

      <section className="mx-auto max-w-[760px] px-4 py-8 sm:px-6 md:py-12">
        {!data ? (
          <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted">
            <Loader2 className="mr-2 animate-spin" size={16} />
            Loading activity
          </div>
        ) : data.profile ? (
          <>
            <div className="mb-8">
              <Link
                href={`/profile/${username}`}
                className="mb-4 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-text"
              >
                <ChevronLeft size={15} />
                Back to profile
              </Link>

              <div className="flex items-center gap-4">
                <ProfileAvatar
                  avatar={data.profile.avatar}
                  avatarUrl={data.profile.avatarUrl}
                  label={data.profile.displayName}
                  size="lg"
                />
                <div>
                  <p className="font-mono text-[11px] uppercase text-muted">Public activity</p>
                  <h1 className="mt-1 text-[clamp(1.8rem,5vw,3rem)] font-medium leading-none">
                    {data.profile.displayName}
                  </h1>
                  <p className="mt-2 text-sm text-muted">
                    {data.activities.length} {data.activities.length === 1 ? "activity" : "activities"}
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-text/15 bg-panel">
              {data.activities.length ? (
                data.activities.map((activity) => (
                  <article key={activity._id} className="border-b border-border p-4 last:border-b-0 sm:p-5">
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-[15px] leading-6">{activityBodyText(activity.body, activity.detail)}</p>
                      <span className="shrink-0 font-mono text-[11px] text-muted">
                        {minutesAgo(activity.happenedAt)}m
                      </span>
                    </div>
                    <div className="mt-3"><ActivityDetail detail={activity.detail} /></div>
                  </article>
                ))
              ) : (
                <div className="p-5 text-sm text-muted">No public activity shared yet.</div>
              )}
            </div>
          </>
        ) : (
          <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
            <p className="text-lg font-medium">Activity unavailable</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              This profile is private, missing, or has not opted into public activity sharing.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex h-10 items-center gap-1 rounded-md bg-dark px-4 text-sm font-medium text-white hover:bg-primary"
            >
              Back home <ArrowUpRight size={15} />
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
