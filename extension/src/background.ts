chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// Relay profile view from content script to side panel
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "x-profile-view") {
    void chrome.storage.local.set({ xProfileView: msg.handle ?? null });
    // Forward to any open side panels
    void chrome.runtime.sendMessage(msg).catch(() => {});
    sendResponse({ ok: true });
  }
});
