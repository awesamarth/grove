import { X } from "lucide-react";
import { useEffect, useState } from "react";

type EuphoriaDetail = {
  profit?: string;
  amount?: string;
  multiplier?: string;
  asset?: string;
  imageUrl?: string;
};

function parseDetail(detail?: string | null): EuphoriaDetail | null {
  if (!detail) return null;
  try {
    const parsed = JSON.parse(detail) as EuphoriaDetail;
    return parsed.imageUrl ? parsed : null;
  } catch {
    return null;
  }
}

function cleanAsset(asset?: string | null) {
  const value = asset?.trim();
  if (!value || /background|logo|mascot|illustration|option/i.test(value)) return "ETH";
  return value;
}



export function activityBodyText(body: string, detail?: string | null) {
  const parsed = parseDetail(detail);
  if (!parsed) return body;
  return body.replace(/Trade background/gi, cleanAsset(parsed.asset));
}

export function ActivityDetail({ detail }: { detail?: string | null }) {
  if (!detail) return null;
  const parsed = parseDetail(detail);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setExpanded(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [expanded]);

  if (parsed) {
    const asset = cleanAsset(parsed.asset);
    const meta = ["Euphoria", parsed.profit, parsed.multiplier, asset].filter(Boolean).join(" · ");

    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setExpanded(true);
          }}
          className="block w-full max-w-[420px] rounded-lg border border-text/15 outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Expand trade image"
        >
          <img
            src={parsed.imageUrl}
            alt={`Euphoria trade ${parsed.profit ?? "share"}`}
            className="max-h-[220px] w-full rounded-lg object-cover"
          />
        </button>
        <div className="inline-flex min-h-7 items-center rounded-md border border-text/15 bg-primary-muted px-2 font-mono text-[11px] text-primary">
          {meta}
        </div>

        {expanded ? (
          <div
            className="fixed inset-0 z-[95] grid place-items-center bg-dark/70 px-4 backdrop-blur-sm"
            onMouseDown={() => setExpanded(false)}
          >
            <div
              className="relative w-full max-w-[560px]"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="absolute -right-2 -top-2 grid size-9 place-items-center rounded-full bg-panel text-text shadow-lg"
                aria-label="Close image"
              >
                <X size={17} />
              </button>
              <img
                src={parsed.imageUrl}
                alt={`Euphoria trade ${parsed.profit ?? "share"}`}
                className="w-full rounded-lg bg-panel object-contain shadow-[0_24px_80px_rgb(5_32_13/0.35)]"
              />
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="inline-flex min-h-7 items-center rounded-md border border-text/15 bg-primary-muted px-2 font-mono text-[11px] text-primary">
      {detail}
    </div>
  );
}
