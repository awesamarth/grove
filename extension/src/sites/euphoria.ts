const SHARE_CAPTURE_ID = "trade-share-capture";
const CAPTURE_REQUEST = "GROVE_EUPHORIA_CAPTURE";
const CAPTURE_RESULT = "GROVE_EUPHORIA_CAPTURE_RESULT";

function assetFrom(root: ParentNode | null) {
  if (!root) return "";

  const imageAlt = Array.from(root.querySelectorAll<HTMLImageElement>("img[alt]"))
    .map((img) => img.alt.trim())
    .find((alt) => /^[A-Z0-9]{2,10}$/.test(alt));
  if (imageAlt) return imageAlt;

  const textMatch = root.textContent?.match(/\b[A-Z0-9]{2,10}\b/);
  return textMatch?.[0] ?? "";
}

function metadataFromModal(): {
  profit: string; amount: string; multiplier: string; asset: string;
} | null {
  const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]');
  const captureEl = document.getElementById(SHARE_CAPTURE_ID);

  const profitDialog = Array.from(dialogs).find((dialog) =>
    dialog.textContent?.toLowerCase().includes("profit"),
  );
  if (!profitDialog && !captureEl) return null;

  const fallbackText = captureEl?.textContent ?? "";
  const fallbackProfit = fallbackText.match(/[+-]\d+(?:\.\d+)?%/)?.[0] ?? "";
  const fallbackMultiplier = fallbackText.match(/\d+(?:\.\d+)?x/)?.[0] ?? "";
  const fallbackAsset = assetFrom(captureEl) || "ETH";

  if (!profitDialog) {
    return { profit: fallbackProfit, amount: "", multiplier: fallbackMultiplier, asset: fallbackAsset };
  }

  const profitEl = profitDialog.querySelector<HTMLElement>(".text-5xl");
  const gridCols = profitDialog.querySelectorAll<HTMLElement>(".grid.grid-cols-3 .flex.flex-col.items-center");

  const profit = profitEl?.textContent?.trim() || fallbackProfit;
  const amount = gridCols[0]?.querySelector("div:first-child")?.textContent?.trim() ?? "";
  const multiplier = gridCols[1]?.querySelector("div:first-child")?.textContent?.trim() || fallbackMultiplier;

  let asset = fallbackAsset;
  asset = assetFrom(profitDialog) || asset;

  return { profit, amount, multiplier, asset };
}

function renderShareButton(btn: HTMLButtonElement) {
  const logoUrl = chrome.runtime.getURL("grove-logo-new.png");
  btn.innerHTML = `
    <span style="display:inline-flex;align-items:center;justify-content:center;gap:7px;line-height:1">
      <img src="${logoUrl}" alt="" style="width:16px;height:16px;display:block;flex:none;object-fit:contain">
      <span style="display:block;line-height:1;transform:translateY(-1px)">Share on Grove</span>
    </span>
  `;
}

function renderStatusButton(btn: HTMLButtonElement, text: string, outlink = false) {
  btn.innerHTML = `
    <span style="display:inline-flex;align-items:center;justify-content:center;gap:${outlink ? "3px" : "0"};line-height:1">
      <span style="display:block;line-height:1;transform:translateY(-2px)">${text}</span>
      ${outlink ? `
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" style="display:block;flex:none;stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;transform:translateY(1px)">
          <path d="M6 12L12 6" />
          <path d="M7.5 6H12V10.5" />
        </svg>
      ` : ""}
    </span>
  `;
}

function setButtonStatus(btn: HTMLButtonElement, text: string, resetMs = 0) {
  renderStatusButton(btn, text);
  if (resetMs) setTimeout(() => renderShareButton(btn), resetMs);
}

function injectButton() {
  if (document.querySelector(".gr-euphoria-share")) return;

  const lastRow = document.querySelector<HTMLElement>('.flex.gap-4.w-full.mb-4:last-child');
  if (!lastRow) return;

  const parent = lastRow.parentElement;
  if (!parent) return;

  const row = document.createElement("div");
  row.className = "gr-euphoria-row";
  row.style.cssText = "display:flex;width:100%;margin-bottom:16px;";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "gr-euphoria-share";
  btn.style.cssText = [
    "appearance:none",
    "display:flex",
    "width:100%",
    "height:42px",
    "align-items:center",
    "justify-content:center",
    "gap:0",
    "margin:0",
    "padding:0 20px",
    "border:0",
    "border-radius:var(--border-radius-button,8px)",
    "background:#93c7a0",
    "color:#07150c",
    "font-family:inherit",
    "font-size:14px",
    "font-weight:700",
    "line-height:1",
    "white-space:nowrap",
    "cursor:pointer",
    "box-sizing:border-box",
    "position:relative",
    "z-index:9999",
  ].join(";");

  renderShareButton(btn);

  row.appendChild(btn);
  parent.appendChild(row);

  btn.addEventListener("mouseenter", () => {
    btn.style.background = "#ffffff";
    btn.style.boxShadow = "0 0 40px 10px rgba(255,255,255,0.45)";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.background = "#93c7a0";
    btn.style.boxShadow = "none";
  });
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (btn.dataset.groveSharedUrl) {
      window.open(btn.dataset.groveSharedUrl, "_blank", "noopener,noreferrer");
      return;
    }
    void handleShare(btn);
  });
}

let bridgeInjected = false;

function injectCaptureBridge() {
  if (bridgeInjected || document.getElementById("gr-euphoria-capture-bridge")) {
    bridgeInjected = true;
    return;
  }

  const script = document.createElement("script");
  script.id = "gr-euphoria-capture-bridge";
  script.src = chrome.runtime.getURL("dist/euphoria-capture-bridge.js");
  document.documentElement.appendChild(script);
  bridgeInjected = true;
}

function captureTradeImage(): Promise<string> {
  injectCaptureBridge();

  const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error("Capture timed out"));
    }, 15000);

    function onMessage(event: MessageEvent) {
      if (event.source !== window || event.data?.type !== CAPTURE_RESULT) return;
      if (event.data.requestId !== requestId) return;

      clearTimeout(timeout);
      window.removeEventListener("message", onMessage);

      if (event.data.ok && event.data.image) {
        resolve(event.data.image);
      } else {
        reject(new Error(event.data.error || "Capture failed"));
      }
    }

    window.addEventListener("message", onMessage);
    window.postMessage({ type: CAPTURE_REQUEST, requestId, captureId: SHARE_CAPTURE_ID }, "*");
  });
}

function findNativeButton(label: string) {
  const normalizedLabel = label.toLowerCase();
  return Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
    .filter((button) => !button.classList.contains("gr-euphoria-share"))
    .find((button) => button.textContent?.trim().toLowerCase() === normalizedLabel) ?? null;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function compressImage(blob: Blob) {
  const bitmap = await createImageBitmap(blob);
  const maxWidth = 900;
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create image canvas");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const compressed = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.82),
  );
  if (!compressed) throw new Error("Could not compress image");

  return compressed;
}

async function readClipboardImage() {
  if (!navigator.clipboard?.read) {
    throw new Error("Clipboard image read is not available");
  }

  const items = await navigator.clipboard.read();
  for (const item of items) {
    const imageType = item.types.find((type) => type.startsWith("image/"));
    if (!imageType) continue;

    const blob = await item.getType(imageType);
    const compressed = await compressImage(blob);
    return { image: await blobToBase64(compressed), imageType: compressed.type || "image/jpeg" };
  }

  throw new Error("No image found in clipboard");
}

async function resetClipboardBeforeNativeCopy() {
  if (!navigator.clipboard?.writeText) {
    throw new Error("Clipboard reset is not available");
  }

  await navigator.clipboard.writeText(`grove-euphoria-pending-${Date.now()}-${Math.random()}`);
}

async function copyNativeShareImage() {
  const copyButton = findNativeButton("Copy");
  if (!copyButton) throw new Error("Native Copy button not found");

  await resetClipboardBeforeNativeCopy();
  copyButton.click();

  let lastError: unknown;
  for (let i = 0; i < 8; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    try {
      return await readClipboardImage();
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Clipboard image copy failed");
}

async function getShareImage() {
  try {
    return await copyNativeShareImage();
  } catch (err) {
    console.warn("[Grove] Native Copy capture failed, falling back to html2canvas:", err);
    return { image: await captureTradeImage(), imageType: "image/png" };
  }
}

async function handleShare(btn: HTMLButtonElement) {
  console.log("[Grove] Euphoria share clicked");
  const captureEl = document.getElementById(SHARE_CAPTURE_ID);
  if (!captureEl) {
    console.warn("[Grove] no Euphoria capture element found");
    setButtonStatus(btn, "No image found", 2500);
    return;
  }

  const meta = metadataFromModal();
  if (!meta) {
    console.warn("[Grove] no Euphoria metadata found");
    setButtonStatus(btn, "No trade data", 2500);
    return;
  }

  setButtonStatus(btn, "Capturing...");

  try {
    const { image, imageType } = await getShareImage();
    setButtonStatus(btn, "Uploading...");

    chrome.runtime.sendMessage(
      {
        type: "euphoria-share",
        image,
        imageType,
        profit: meta.profit,
        amount: meta.amount,
        multiplier: meta.multiplier,
        asset: meta.asset,
      },
      (res: { ok?: boolean; error?: string; url?: string }) => {
        if (res?.ok) {
          if (res.url) btn.dataset.groveSharedUrl = res.url;
          renderStatusButton(btn, "Shared", true);
        } else {
          console.error("[Grove] Euphoria upload failed:", res?.error);
          setButtonStatus(btn, res?.error ?? "Failed", 3000);
        }
      },
    );
  } catch (err) {
    setButtonStatus(btn, "Error", 3000);
    console.warn("[Grove] Euphoria share error:", err);
  }
}

function initEuphoria() {
  if (!location.hostname.includes("euphoria.finance")) return;

  let shareObs = new MutationObserver(() => {
    if (document.getElementById(SHARE_CAPTURE_ID)) {
      setTimeout(injectButton, 300);
    }
  });
  shareObs.observe(document.body, { childList: true, subtree: true });
}

initEuphoria();
