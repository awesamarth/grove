const GROVE_ORIGIN = "https://localhost:3000";

type StoredSession = {
  token: string;
  walletAddress: string;
};

type ExtensionMe = {
  walletAddress: string;
  viewer: null | {
    walletAddress: string;
    username: string;
    displayName: string;
    xHandle?: string;
    xVerified: boolean;
    bio: string;
    avatar: string;
    avatarUrl?: string | null;
    karma: number;
    upvotes: number;
    downvotes: number;
  };
  stats: {
    people: number;
    activities: number;
    apps: number;
  };
  feed: Array<{
    _id: string;
    body: string;
    detail: string;
    time: string;
  }>;
  people: Array<{
    walletAddress: string;
    username: string;
    displayName: string;
    xHandle?: string;
    karma: number;
  }>;
  notifications?: Array<{
    _id: string;
    body: string;
    read: boolean;
    createdAt: number;
  }>;
};

const els = {
  sessionState: byId("sessionState"),
  walletState: byId("walletState"),
  handleState: byId("handleState"),
  repState: byId("repState"),
  themeBtn: byId("themeBtn") as HTMLButtonElement,
  themeIcon: byId("themeIcon"),
  connectBtn: byId("connectBtn") as HTMLButtonElement,
  refreshBtn: byId("refreshBtn") as HTMLButtonElement,
  openProfileBtn: byId("openProfileBtn") as HTMLButtonElement,
  logoutBtn: byId("logoutBtn") as HTMLButtonElement,
  profileCard: byId("profileCard"),
  avatar: byId("avatar"),
  displayName: byId("displayName"),
  profileMeta: byId("profileMeta"),
  heroRep: byId("heroRep"),
  profileHeroBtn: byId("profileHeroBtn") as HTMLButtonElement,
  viewingCard: byId("viewingCard"),
  viewingName: byId("viewingName"),
  viewingMeta: byId("viewingMeta"),
  viewingAvatar: byId("viewingAvatar"),
  viewingBio: byId("viewingBio"),
  viewingStats: byId("viewingStats"),
  viewingUp: byId("viewingUp"),
  viewingDown: byId("viewingDown"),
  viewingTipBtn: byId("viewingTipBtn") as HTMLButtonElement,
  viewingProfileBtn: byId("viewingProfileBtn") as HTMLButtonElement,
  viewingUpBtn: byId("viewingUpBtn") as HTMLButtonElement,
  viewingDownBtn: byId("viewingDownBtn") as HTMLButtonElement,
  viewingActivity: byId("viewingActivity"),
  viewingActivityList: byId("viewingActivityList"),
  notificationList: byId("notificationList"),
};

let currentSession: StoredSession | null = null;
let currentOwnProfilePath: string | null = null;
let currentViewingProfilePath: string | null = null;
let currentViewingHandle: string | null = null;

type Theme = "light" | "dark";

function byId(id: string) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

function shortAddress(address?: string) {
  if (!address) return "not connected";
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function setBusy(busy: boolean) {
  document.querySelectorAll("button").forEach((button) => {
    button.disabled = busy;
  });
}

function getStoredSession() {
  return chrome.storage.local.get(["groveToken", "groveWalletAddress"]).then((value) => {
    if (typeof value.groveToken !== "string" || typeof value.groveWalletAddress !== "string") {
      return null;
    }
    return {
      token: value.groveToken,
      walletAddress: value.groveWalletAddress,
    };
  });
}

async function setStoredSession(session: StoredSession | null) {
  currentSession = session;
  if (!session) {
    await chrome.storage.local.remove(["groveToken", "groveWalletAddress"]);
    return;
  }
  await chrome.storage.local.set({
    groveToken: session.token,
    groveWalletAddress: session.walletAddress,
  });
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  els.themeIcon.innerHTML =
    theme === "dark"
      ? `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`
      : `<circle cx="12" cy="12" r="5"/><g stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></g>`;
}

async function loadTheme() {
  const value = await chrome.storage.local.get("groveTheme");
  const theme = value.groveTheme === "light" ? "light" : "dark";
  applyTheme(theme);
}

async function toggleTheme() {
  const current = document.documentElement.dataset.theme === "light" ? "light" : "dark";
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
  await chrome.storage.local.set({ groveTheme: next });
}

function authUrl() {
  const redirectUri = chrome.identity.getRedirectURL("grove");
  const url = new URL("/extension/connect", GROVE_ORIGIN);
  url.searchParams.set("redirect_uri", redirectUri);
  return url.toString();
}

function parseAuthRedirect(url: string) {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.hash.replace(/^#/, ""));
  const token = params.get("token");
  const walletAddress = params.get("walletAddress");
  if (!token || !walletAddress) {
    throw new Error("Grove did not return an extension session.");
  }
  return { token, walletAddress };
}

async function connect() {
  setBusy(true);
  try {
    els.sessionState.textContent = "connecting";
    const redirectUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl(),
      interactive: true,
    });
    if (!redirectUrl) throw new Error("Grove auth did not complete.");
    const session = parseAuthRedirect(redirectUrl);
    await setStoredSession(session);
    await loadMe();
  } catch (error) {
    els.sessionState.textContent = "error";
    renderEmpty(error instanceof Error ? error.message : "Could not connect Grove.");
  } finally {
    setBusy(false);
  }
}

async function fetchMe(session: StoredSession) {
  const response = await fetch(`${GROVE_ORIGIN}/api/extension/me`, {
    headers: {
      authorization: `Bearer ${session.token}`,
    },
    cache: "no-store",
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error ?? "Could not load Grove profile.");
  }
  return body as ExtensionMe;
}

function renderEmpty(message: string) {
  els.profileCard.classList.add("hidden");
  els.viewingCard.classList.add("hidden");
  els.walletState.textContent = currentSession ? shortAddress(currentSession.walletAddress) : "not connected";
  els.handleState.textContent = "none";
  els.repState.textContent = "—";
  els.notificationList.innerHTML = `<div class="empty">${escapeHtml(message)}</div>`;
  currentOwnProfilePath = null;
  currentViewingProfilePath = null;
  currentViewingHandle = null;
}

function renderMe(data: ExtensionMe) {
  const viewer = data.viewer;
  els.sessionState.textContent = viewer ? "connected" : "profile needed";
  els.walletState.textContent = shortAddress(data.walletAddress);

  if (!viewer) {
    renderEmpty("Grove session found. Set up your profile on Grove.");
    return;
  }

  currentOwnProfilePath = `/profile/${viewer.username}`;
  els.profileCard.classList.remove("hidden");
  els.displayName.textContent = viewer.displayName;
  els.profileMeta.textContent = `@${viewer.xHandle ?? viewer.username}`;
  els.handleState.textContent = `@${viewer.xHandle ?? viewer.username}`;
  els.repState.textContent = String(viewer.karma);
  els.heroRep.textContent = String(viewer.karma);

  if (viewer.avatarUrl) {
    els.avatar.innerHTML = `<img alt="" src="${escapeHtml(viewer.avatarUrl)}" />`;
  } else {
    els.avatar.innerHTML = `<img alt="" src="${GROVE_ORIGIN}/avatars/${encodeURIComponent(viewer.avatar)}.png" class="pixel" />`;
  }

  const notifications = data.notifications ?? [];
  els.notificationList.innerHTML = notifications.length
    ? notifications.map((notification) => `
      <div class="notification ${notification.read ? "is-read" : ""}">
        <span>${escapeHtml(notification.body)}</span>
        <small>${formatAge(notification.createdAt)}</small>
      </div>
    `).join("")
    : `<div class="empty">No notifications yet.</div>`;

  document.querySelectorAll<HTMLElement>("[data-url]").forEach((item) => {
    item.addEventListener("click", () => {
      const url = item.dataset.url;
      if (url) void chrome.tabs.create({ url });
    });
  });
}

function formatAge(createdAt: number) {
  const minutes = Math.max(1, Math.round((Date.now() - createdAt) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

async function loadMe() {
  setBusy(true);
  try {
    currentSession = await getStoredSession();
    if (!currentSession) {
      els.sessionState.textContent = "signed out";
      renderEmpty("Connect Grove to load your profile.");
      return;
    }
    els.sessionState.textContent = "loading";
    const me = await fetchMe(currentSession);
    renderMe(me);
  } catch (error) {
    els.sessionState.textContent = "expired";
    await setStoredSession(null);
    renderEmpty(error instanceof Error ? error.message : "Could not load Grove profile.");
  } finally {
    setBusy(false);
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const replacements: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return replacements[char] ?? char;
  });
}

els.connectBtn.addEventListener("click", () => void connect());
els.themeBtn.addEventListener("click", () => void toggleTheme());
els.refreshBtn.addEventListener("click", () => void loadMe());
els.openProfileBtn.addEventListener("click", () => {
  const path = currentOwnProfilePath ?? "/";
  void chrome.tabs.create({ url: `${GROVE_ORIGIN}${path}` });
});
els.profileHeroBtn.addEventListener("click", () => {
  const path = currentOwnProfilePath ?? "/";
  void chrome.tabs.create({ url: `${GROVE_ORIGIN}${path}` });
});
els.viewingTipBtn.addEventListener("click", () => {
  void chrome.tabs.create({ url: `${GROVE_ORIGIN}/` });
});
els.viewingUpBtn.addEventListener("click", () => undefined);
els.viewingDownBtn.addEventListener("click", () => undefined);
els.viewingProfileBtn.addEventListener("click", () => {
  const path = currentViewingProfilePath ?? "/";
  void chrome.tabs.create({ url: `${GROVE_ORIGIN}${path}` });
});
els.logoutBtn.addEventListener("click", () => {
  void setStoredSession(null).then(() => {
    els.sessionState.textContent = "signed out";
    renderEmpty("Signed out of the Grove extension.");
  });
});

void loadMe();
void loadTheme();

async function renderViewingHandle(handle: string | null) {
  if (!handle) {
    currentViewingHandle = null;
    currentViewingProfilePath = null;
    els.viewingCard.classList.add("hidden");
    return;
  }

  if (handle === currentViewingHandle && !els.viewingCard.classList.contains("hidden")) return;
  currentViewingHandle = handle;

  try {
    const res = await fetch(`${GROVE_ORIGIN}/api/public/x/${encodeURIComponent(handle)}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error("not found");
    const data = await res.json();
    const p = data.profile;
    if (!p) throw new Error("no profile");

    const activity = data.activity;

    els.viewingCard.classList.remove("hidden");

    // Avatar
    if (p.avatarUrl) {
      els.viewingAvatar.innerHTML = `<img src="${escapeHtml(p.avatarUrl)}" alt="" />`;
    } else {
      els.viewingAvatar.innerHTML = "";
      els.viewingAvatar.textContent = p.displayName.charAt(0).toUpperCase();
    }

    els.viewingName.textContent = p.displayName;
    els.viewingMeta.textContent = `@${p.username} · ${p.karma} karma`;

    // Bio
    if (p.bio) {
      els.viewingBio.textContent = p.bio;
      els.viewingBio.classList.remove("hidden");
    } else {
      els.viewingBio.classList.add("hidden");
    }

    // Stats
    els.viewingUp.textContent = String(p.upvotes ?? 0);
    els.viewingDown.textContent = String(p.downvotes ?? 0);
    els.viewingStats.classList.remove("hidden");

    // Tip button
    els.viewingTipBtn.onclick = () => {
      void chrome.tabs.create({ url: `${GROVE_ORIGIN}/tip/${encodeURIComponent(p.username)}` });
    };

    currentViewingProfilePath = `/profile/${p.username}`;

    // Recent activity
    const recent = activity?.recent ?? [];
    if (recent.length > 0) {
      els.viewingActivityList.innerHTML = recent.map((a: { body: string; happenedAt: number }) =>
        `<div class="activity-item">
          <div class="activity-body">${escapeHtml(a.body)}</div>
          <div class="activity-time">${formatAge(a.happenedAt)}</div>
        </div>`
      ).join("");
      els.viewingActivity.classList.remove("hidden");
    } else {
      els.viewingActivity.classList.add("hidden");
    }
  } catch {
    currentViewingHandle = null;
    currentViewingProfilePath = null;
    els.viewingCard.classList.add("hidden");
  }
}

// Listen for X profile view updates from content script/background.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== "x-profile-view") return;
  void renderViewingHandle(msg.handle ?? null);
});

chrome.runtime.sendMessage({ type: "get-current-view" }, (res: { ok?: boolean; handle?: string | null }) => {
  void renderViewingHandle(res?.handle ?? null);
});
