const GROVE_ORIGIN = "https://localhost:3000";

const BADGE_ICON = chrome.runtime.getURL("grove-logo.png");
const AVATAR_CONTAINER_SELECTOR = '[data-testid^="UserAvatar-Container-"]';

const NON_PROFILE = new Set([
  "home","explore","notifications","messages","settings","i","search",
  "compose","tos","privacy","about","jobs","help","login","signup",
  "account","intent","hashtag","lists","bookmarks","communities","grok",
  "newsletters","events","monetization","connections","post","status"
]);

// ─── Cache ───
const cache = new Map<string, { p: GroveProfile | null; at: number }>();
const CACHE_TTL = 120_000;

interface GroveProfile {
  username: string;
  displayName: string;
  walletAddress: string;
  karma: number;
  avatarUrl?: string | null;
}

function cacheGet(h: string) {
  const e = cache.get(h.toLowerCase());
  return e && Date.now() - e.at < CACHE_TTL ? e.p : undefined;
}
function cacheSet(h: string, p: GroveProfile | null) {
  cache.set(h.toLowerCase(), { p, at: Date.now() });
}

// ─── API ───
async function fetchProfile(handle: string): Promise<GroveProfile | null> {
  const cached = cacheGet(handle);
  if (cached !== undefined) return cached;

  try {
    const res = await fetch(
      `${GROVE_ORIGIN}/api/public/x/${encodeURIComponent(handle)}`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) { cacheSet(handle, null); return null; }
    const data = await res.json();
    // API returns { linked: true, profile: { ... } }
    const p: GroveProfile = data.profile;
    if (!p) { cacheSet(handle, null); return null; }
    cacheSet(handle, p);
    return p;
  } catch (err) {
    console.debug("[Grove] fetchProfile error:", err);
    cacheSet(handle, null);
    return null;
  }
}

// ─── Handle extraction ───
function getHandleFromAvatar(el: HTMLElement): string | null {
  const tid = el.getAttribute("data-testid");
  const m = tid?.match(/UserAvatar-Container-(\w+)/);
  return m ? m[1] : null;
}

function getTweetHandle(tweet: HTMLElement): { handle: string; avatar: HTMLElement } | null {
  const tweetAvatar = tweet.querySelector<HTMLElement>('[data-testid="Tweet-User-Avatar"]');
  const userAvatar = tweetAvatar?.querySelector<HTMLElement>(AVATAR_CONTAINER_SELECTOR);
  if (!tweetAvatar || !userAvatar) return null;
  const handle = getHandleFromAvatar(userAvatar);
  return handle ? { handle, avatar: userAvatar } : null;
}

function getHandleFromUrl(): string | null {
  const seg = location.pathname.replace(/\/$/, "").split("/").filter(Boolean)[0];
  return (!seg || NON_PROFILE.has(seg) || seg.includes(".")) ? null : seg.replace(/^@/, "");
}

// ─── Render helpers ───
function groveIcon(size = 12) {
  return `<img src="${BADGE_ICON}" class="gr-badge-icon" style="width:${size}px!important;height:${size}px!important" />`;
}

function makeBadgeHTML(karma: number) {
  return `${groveIcon(17)}<span>${karma}</span>`;
}

function makeProfileBadgeHTML(karma: number) {
  return `${groveIcon(19)}<span>${karma}</span>`;
}

// ─── Ring ───
function avatarColor(karma: number) {
  return karma > 0 ? "#93c7a0" : "#a1ada4";
}

function applyTweetRing(el: HTMLElement, karma: number) {
  if (el.classList.contains("gr-processed-border")) return;
  el.classList.add("gr-processed-border", "gr-feed-avatar-container");
  el.style.setProperty("--grove-ring", avatarColor(karma));
}

function updateTweetRing(el: HTMLElement, karma: number) {
  el.style.setProperty("--grove-ring", avatarColor(karma));
}

function applyProfileRing(el: HTMLElement, karma: number) {
  const color = karma > 0 ? "#93c7a0" : "#a1ada4";
  const isSquare = !!el.querySelector('[style*="clip-path: url(\\"#shape-square\\")"]');
  el.classList.add("gr-profile-avatar-frame", isSquare ? "gr-avatar-square" : "gr-avatar-round");
  el.style.setProperty("--grove-ring", color);
  el.style.border = `5px solid ${color}`;
}

function clearInjectedUi() {
  document.querySelectorAll(".gr-badge").forEach(el => el.remove());
  document.querySelectorAll<HTMLElement>(".gr-avatar-frame").forEach(el => {
    el.classList.remove("gr-avatar-frame");
    el.style.removeProperty("--grove-ring");
  });
  document.querySelectorAll<HTMLElement>(".gr-avatar-inner").forEach(el => el.classList.remove("gr-avatar-inner"));
  document.querySelectorAll<HTMLElement>(".gr-profile-avatar-frame").forEach(el => {
    el.classList.remove("gr-profile-avatar-frame", "gr-avatar-round", "gr-avatar-square");
    el.style.removeProperty("--grove-ring");
    el.style.border = "";
  });
  document.querySelectorAll<HTMLElement>(".gr-processed-border, .gr-feed-avatar-container, .gr-done").forEach(el => {
    el.classList.remove("gr-processed-border", "gr-feed-avatar-container", "gr-done");
    el.style.removeProperty("--grove-ring");
  });
}

function insertAfter(reference: Element, node: Node) {
  reference.parentElement?.insertBefore(node, reference.nextSibling);
}

function findDisplayNameSpan(nameBlock: HTMLElement): HTMLElement | null {
  const candidates = [
    ...Array.from(nameBlock.querySelectorAll<HTMLElement>('a[role="link"] div[dir="ltr"] > span')),
    ...Array.from(nameBlock.querySelectorAll<HTMLElement>('div[dir="ltr"] > span')),
  ];

  for (const candidate of candidates) {
    const text = candidate.textContent?.trim();
    if (text && !text.startsWith("@")) return candidate;
  }

  return null;
}

function findDisplayNameTarget(nameBlock: HTMLElement): HTMLElement | null {
  const displayName = findDisplayNameSpan(nameBlock);
  if (!displayName) return null;

  const verifiedIcon = nameBlock.querySelector<HTMLElement>('[data-testid="icon-verified"]');
  if (!verifiedIcon) return displayName;

  let node: HTMLElement = verifiedIcon;
  while (node.parentElement && node.parentElement !== nameBlock) {
    const parent = node.parentElement;
    if (parent.contains(displayName) && parent.children.length > 1) return node;
    node = parent;
  }

  node = verifiedIcon;
  while (node.parentElement && node.parentElement !== nameBlock) {
    const parent = node.parentElement;
    if (parent.children.length > 1 && !parent.textContent?.trim().startsWith("@")) return node;
    node = parent;
  }

  return displayName;
}

function addBadge(nameBlock: HTMLElement, p: GroveProfile, profile = false) {
  const existing = nameBlock.querySelector<HTMLElement>(profile ? ".gr-badge-p" : ".gr-badge-t");
  if (existing?.dataset.groveHandle === p.username) return;
  existing?.remove();

  const target = findDisplayNameTarget(nameBlock);
  if (!target) return;

  const badge = document.createElement("span");
  badge.className = profile ? "gr-badge gr-badge-p" : "gr-badge gr-badge-t";
  badge.dataset.groveHandle = p.username;
  badge.innerHTML = profile ? makeProfileBadgeHTML(p.karma) : makeBadgeHTML(p.karma);
  badge.title = `Grove karma: ${p.karma}`;
  badge.onclick = (e) => { e.stopPropagation(); e.preventDefault(); showPopup(badge, p); };
  insertAfter(target, badge);
}

// ─── Popup ───
function makePopup(p: GroveProfile) {
  const d = document.createElement("div");
  d.className = "gr-popup";
  d.innerHTML = `
    <div class="gr-popup-hdr">
      <b>${esc(p.displayName)}</b>
    </div>
    <div class="gr-popup-row"><span>Karma</span><span class="gr-popup-val">${p.karma}</span></div>
    <div class="gr-popup-row"><span>Wallet</span><span class="gr-popup-addr">${p.walletAddress.slice(0,6)}...${p.walletAddress.slice(-4)}</span></div>
    <a class="gr-popup-tip" href="${GROVE_ORIGIN}/tip/${encodeURIComponent(p.username)}" target="_blank">${groveIcon(23)} Tip with MOSS ↗</a>
  `;
  return d;
}

let activePopup: HTMLDivElement | null = null;

function showPopup(anchor: HTMLElement, p: GroveProfile) {
  activePopup?.remove();
  activePopup = makePopup(p);
  document.body.appendChild(activePopup);
  const r = anchor.getBoundingClientRect();
  activePopup.style.top = `${r.bottom + 4}px`;
  activePopup.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - 240))}px`;

  const close = () => {
    if (!activePopup) return;
    activePopup.remove();
    activePopup = null;
  };

  const onOutsideClick = (e: MouseEvent) => {
    if (activePopup && !activePopup.contains(e.target as Node) && e.target !== anchor) {
      close();
      document.removeEventListener("click", onOutsideClick);
      document.removeEventListener("keydown", onEscape);
    }
  };

  const onEscape = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      close();
      document.removeEventListener("click", onOutsideClick);
      document.removeEventListener("keydown", onEscape);
    }
  };

  setTimeout(() => {
    document.addEventListener("click", onOutsideClick);
    document.addEventListener("keydown", onEscape);
  }, 0);
}

// ─── Profile page ───
function processProfilePage(handle: string) {
  // Wait for [data-testid="UserName"] to exist
  const waitForName = (cb: () => void) => {
    if (document.querySelector('[data-testid="UserName"]')) { cb(); return; }
    const iv = setInterval(() => {
      if (document.querySelector('[data-testid="UserName"]')) { clearInterval(iv); cb(); }
    }, 200);
    setTimeout(() => clearInterval(iv), 8000);
  };

  waitForName(() => {
    console.debug("[Grove] Profile page detected:", handle);
    fetchProfile(handle).then(p => {
      if (!p) { console.debug("[Grove] No profile for", handle); return; }
      console.debug("[Grove] Profile loaded:", p);

      // Ring only avatars inside the main column. Do not touch the account switcher/sidebar.
      const primaryColumn = document.querySelector<HTMLElement>('[data-testid="primaryColumn"]');
      primaryColumn?.querySelectorAll<HTMLElement>(AVATAR_CONTAINER_SELECTOR).forEach(el => {
        const isTweetAvatar = !!el.closest('[data-testid="tweet"], [data-testid="Tweet-User-Avatar"]');
        if (!isTweetAvatar && getHandleFromAvatar(el)?.toLowerCase() === handle.toLowerCase()) {
          applyProfileRing(el, p.karma);
        }
      });

      // Badge next to display name
      const nameEl = document.querySelector<HTMLElement>('[data-testid="UserName"]');
      if (nameEl) addBadge(nameEl, p, true);
    });
  });
}

// ─── Tweet avatars ───
function processTweets() {
  const tweets = document.querySelectorAll<HTMLElement>('[data-testid="tweet"]:not(.gr-done)');
  if (!tweets.length) return;

  tweets.forEach(tweet => {
    const found = getTweetHandle(tweet);
    if (!found) return;
    const { handle, avatar } = found;
    tweet.classList.add("gr-done");

    fetchProfile(handle).then(p => {
      if (!p) return;
      applyTweetRing(avatar, p.karma);
      updateTweetRing(avatar, p.karma);

      // Badge next to name in tweet
      const nameRow = tweet.querySelector<HTMLElement>('[data-testid="User-Name"]');
      if (nameRow) addBadge(nameRow, p);
    });
  });
}

// ─── Process all ───
function processAll() {
  processTweets();

  // Profile page
  const handle = getHandleFromUrl();
  const key = "profile-page";
  if (handle && !document.querySelector(".gr-badge-p")) {
    processProfilePage(handle);
  }
}

let processScheduled = false;

function scheduleProcess(delay = 50) {
  if (processScheduled) return;
  processScheduled = true;
  window.setTimeout(() => {
    processScheduled = false;
    processAll();
  }, delay);
}

function runBurstProcess() {
  [0, 250, 750, 1500, 3000, 5000].forEach(delay => {
    window.setTimeout(() => processAll(), delay);
  });
}

// ─── Init ───
function init() {
  if (!["x.com","twitter.com"].includes(location.hostname)) return;
  console.debug("[Grove] Content script loaded");

  runBurstProcess();

  // MutationObserver for X's SPA/lazy-loaded replies. Reattach when primaryColumn is replaced.
  let observedPrimary: HTMLElement | null = null;
  const contentObs = new MutationObserver(mutations => {
    if (mutations.some(m => m.addedNodes.length > 0)) scheduleProcess();
  });
  const attachContentObserver = () => {
    const primary = document.querySelector<HTMLElement>('[data-testid="primaryColumn"]');
    if (!primary || primary === observedPrimary) return;
    contentObs.disconnect();
    observedPrimary = primary;
    contentObs.observe(primary, { childList: true, subtree: true });
    scheduleProcess();
  };
  attachContentObserver();

  // SPA nav
  let lastUrl = location.href;
  const navObs = new MutationObserver(() => {
    attachContentObserver();
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      clearInjectedUi();
      attachContentObserver();
      runBurstProcess();
      const h = getHandleFromUrl();
      if (h) chrome.runtime.sendMessage({ type: "x-profile-view", handle: h }).catch(() => {});
    }
  });
  navObs.observe(document.body, { childList: true, subtree: true });

  // Notify background
  const h = getHandleFromUrl();
  if (h) chrome.runtime.sendMessage({ type: "x-profile-view", handle: h }).catch(() => {});
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c] ?? c));
}

init();
