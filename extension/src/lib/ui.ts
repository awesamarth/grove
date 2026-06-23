import { GROVE_ORIGIN, type GroveProfile } from "./grove-api";

const BADGE_ICON = chrome.runtime.getURL("grove-logo.png");

export function groveIcon(size = 12) {
  return `<img src="${BADGE_ICON}" class="gr-badge-icon" style="width:${size}px!important;height:${size}px!important" />`;
}

export function makeBadgeHTML(karma: number) {
  return `${groveIcon(17)}<span>${karma}</span>`;
}

export function makeProfileBadgeHTML(karma: number) {
  return `${groveIcon(19)}<span>${karma}</span>`;
}

export function esc(s: string) {
  return s.replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c] ?? c));
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
    <button class="gr-popup-tip" data-tip-username="${p.username}">${groveIcon(23)} Tip with MOSS</button>
  `;
  return d;
}

let activePopup: HTMLDivElement | null = null;

export function showPopup(anchor: HTMLElement, p: GroveProfile) {
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

  const tipBtn = activePopup.querySelector<HTMLButtonElement>(".gr-popup-tip");
  if (tipBtn) {
    tipBtn.addEventListener("click", () => {
      const username = tipBtn.dataset.tipUsername;
      if (username) {
        const w = 480, h = 700;
        const left = Math.round(window.screenLeft + (window.outerWidth - w) / 2);
        const top = Math.round(window.screenTop + (window.outerHeight - h) / 2);
        window.open(
          `${GROVE_ORIGIN}/tip/${encodeURIComponent(username)}`,
          "grove-tip",
          `width=${w},height=${h},popup,left=${left},top=${top}`
        );
      }
      close();
    });
  }

  setTimeout(() => {
    document.addEventListener("click", onOutsideClick);
    document.addEventListener("keydown", onEscape);
  }, 0);
}
