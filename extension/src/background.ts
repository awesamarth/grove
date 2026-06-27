import { GROVE_ORIGIN } from "./lib/origin";

chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

const tabViews = new Map<number, string | null>();

async function responseError(response: Response) {
  const text = await response.text();
  try {
    const body = JSON.parse(text) as { error?: string };
    return (body.error ?? `Upload failed (${response.status})`).slice(0, 180);
  } catch {
    const preview = text.replace(/\s+/g, " ").slice(0, 120);
    return `Upload failed (${response.status} ${response.statusText}): ${preview || "Non-JSON response"}`;
  }
}

async function ownActivityUrl(token: string) {
  const response = await fetch(`${GROVE_ORIGIN}/api/extension/me`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) return `${GROVE_ORIGIN}/`;

  const data = await response.json() as { viewer?: { username?: string } | null };
  const username = data.viewer?.username;
  return username
    ? `${GROVE_ORIGIN}/profile/${encodeURIComponent(username)}/activity`
    : `${GROVE_ORIGIN}/`;
}

function activeTabView() {
  return chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
    if (!tab?.id) return null;
    const cached = tabViews.get(tab.id);
    if (cached !== undefined) return cached;

    return new Promise<string | null>((resolve) => {
      chrome.tabs.sendMessage(tab.id!, { type: "get-route-view" }, (res: { handle?: string | null }) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        const handle = res?.handle ?? null;
        tabViews.set(tab.id!, handle);
        resolve(handle);
      });
    });
  });
}

function broadcastActiveTabView() {
  void activeTabView()
    .then((handle) => chrome.runtime.sendMessage({ type: "x-profile-view", handle }))
    .catch(() => {});
}

chrome.tabs.onActivated.addListener(() => {
  broadcastActiveTabView();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabViews.delete(tabId);
});

// Relay profile view from content script to side panel
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "x-profile-view") {
    if (sender.tab?.id) tabViews.set(sender.tab.id, msg.handle ?? null);
    void chrome.storage.local.set({ xProfileView: msg.handle ?? null });
    // Forward to any open side panels
    void chrome.runtime.sendMessage(msg).catch(() => {});
    sendResponse({ ok: true });
    return;
  }
  if (msg.type === "get-current-view") {
    activeTabView()
      .then((handle) => sendResponse({ ok: true, handle }))
      .catch(() => sendResponse({ ok: false, handle: null }));
    return true;
  }
  if (msg.type === "euphoria-share") {
    chrome.storage.local.get(["groveToken"]).then((stored) => {
      const token = stored.groveToken as string | undefined;
      if (!token) {
        sendResponse({ ok: false, error: "Not signed in to Grove" });
        return;
      }
      fetch(`${GROVE_ORIGIN}/api/euphoria/share`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          image: msg.image,
          imageType: msg.imageType,
          profit: msg.profit,
          amount: msg.amount,
          multiplier: msg.multiplier,
          asset: msg.asset,
        }),
      })
        .then(async (r) => {
          if (!r.ok) throw new Error(await responseError(r));
          sendResponse({ ok: true, url: await ownActivityUrl(token) });
        })
        .catch((err) => {
          console.error("[Grove] Euphoria share upload failed:", err);
          sendResponse({ ok: false, error: err.message });
        });
    });
    return true; // keep channel open for async response
  }
  if (msg.type === "fetch-profile") {
    const h = encodeURIComponent(msg.handle as string);
    fetch(`${GROVE_ORIGIN}/api/public/x/${h}`, { signal: AbortSignal.timeout(3000) })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.linked && data?.profile) {
          sendResponse({ ok: true, profile: data.profile });
        } else {
          sendResponse({ ok: false });
        }
      })
      .catch(() => sendResponse({ ok: false }));
    return true; // keep channel open for async response
  }
});
