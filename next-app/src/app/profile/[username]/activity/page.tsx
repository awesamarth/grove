"use client";

import { ArrowUpRight, ChevronLeft, Loader2, MoreHorizontal, Trash2 } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../../../../../convex/_generated/api";
import { GroveNav } from "../../../../components/grove-nav";
import { ProfileAvatar } from "../../../../components/profile-avatar";
import { ActivityDetail, activityBodyText } from "../../../../components/activity-detail";
import { useGroveSession } from "../../../../lib/use-grove-session";
import { timeAgo } from "../../../../lib/time";

export default function ProfileActivityPage() {
  const params = useParams<{ username: string }>();
  const username = decodeURIComponent(params.username);
  const groveSession = useGroveSession();
  const viewerWallet = groveSession.walletAddress ?? undefined;
  const data = useQuery(api.dashboard.getProfileActivities, { username });
  const deleteActivity = useMutation(api.dashboard.deleteActivity);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

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
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[15px] leading-6">{activityBodyText(activity.body, activity.detail)}</p>
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
                    <div className="mt-3 flex items-center gap-2">
                      <ActivityDetail detail={activity.detail} />
                      <span className="ml-auto font-mono text-[11px] text-muted/60">
                        {timeAgo(activity.happenedAt)}
                      </span>
                    </div>
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
