"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

const sizes = {
  sm: "size-8",
  md: "size-11",
  lg: "size-20",
  xl: "size-28",
};

export function avatarSrc(avatar: string, avatarUrl?: string | null) {
  return avatarUrl ?? `/avatars/${avatar}.png`;
}

export function ProfileAvatar({
  avatar,
  avatarUrl,
  label,
  size = "md",
  viewable = true,
}: {
  avatar: string;
  avatarUrl?: string | null;
  label?: string;
  size?: keyof typeof sizes;
  viewable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const src = avatarSrc(avatar, avatarUrl);
  const isBundledAvatar = !avatarUrl;

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={label ?? ""}
      className={`${sizes[size]} shrink-0 rounded-md border border-text/15 bg-primary-muted object-cover ${
        isBundledAvatar ? "[image-rendering:pixelated]" : ""
      }`}
    />
  );

  if (!viewable) return image;

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
        className="shrink-0 rounded-md outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={label ? `View ${label}'s avatar` : "View avatar"}
      >
        {image}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[95] grid place-items-center bg-dark/70 px-4 backdrop-blur-sm"
          onMouseDown={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-[360px]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute -right-2 -top-2 grid size-9 place-items-center rounded-full border border-text/15 bg-panel text-text shadow-lg hover:border-primary"
              aria-label="Close avatar"
            >
              <X size={17} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={label ?? "Avatar"}
              className={`aspect-square w-full rounded-lg border border-text/15 bg-panel object-cover shadow-[0_24px_80px_rgb(5_32_13/0.35)] ${
                isBundledAvatar ? "[image-rendering:pixelated]" : ""
              }`}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
