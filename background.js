let state = {
  isEnabled: true,
  blockedSites: ['youtube.com', 'reddit.com', 'instagram.com'],
  password: '1234'
};

let unblockUntil = null;
let blocksToday = 0;
let todayDate = (new Date()).toISOString().slice(0,10);
let stateLoaded = false;

// Helper for browser compatibility (browser or chrome)
const ext = typeof browser !== "undefined" ? browser : chrome;

// Use ext.browserAction or ext.action for badge (browser compatibility)
function setBadge(text, color) {
  if (ext.browserAction && ext.browserAction.setBadgeText) {
    ext.browserAction.setBadgeText({ text });
    ext.browserAction.setBadgeBackgroundColor({ color });
  } else if (ext.action && ext.action.setBadgeText) {
    ext.action.setBadgeText({ text });
    ext.action.setBadgeBackgroundColor({ color });
  }
}

function updateBadge() {
  setBadge(state.isEnabled ? "ON" : "OFF", state.isEnabled ? "#d32f2f" : "#388e3c");
}

function ensureBlocklist() {
  if (!Array.isArray(state.blockedSites)) state.blockedSites = [];
}

function loadState(callback) {
  chrome.storage.local.get(['state', 'unblockUntil', 'blocksToday', 'todayDate'], (result) => {
    if (result.state) state = { ...state, ...result.state };
    ensureBlocklist();
    unblockUntil = result.unblockUntil || null;
    blocksToday = result.blocksToday || 0;
    todayDate = result.todayDate || todayDate;
    stateLoaded = true;
    updateBadge();
    if (callback) callback();
  });
}
loadState();

function isTemporarilyUnblocked() {
  return unblockUntil && Date.now() < unblockUntil;
}

function normalizeDomain(domain) {
  return (domain || '').replace(/^www\./, '').toLowerCase();
}

function shouldBlockSite(url) {
  if (!stateLoaded) return false;
  if (!state.isEnabled || isTemporarilyUnblocked()) return false;
  let hostname = '';
  try {
    hostname = new URL(url).hostname;
  } catch {
    return false;
  }
  hostname = normalizeDomain(hostname);
  ensureBlocklist();
  const match = state.blockedSites.some(site => {
    const normSite = normalizeDomain(site);
    return hostname === normSite || hostname.endsWith('.' + normSite);
  });
  console.log(`[BlocksEverything] Checked: ${hostname} | Blocked: ${match}`);
  return match;
}

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!stateLoaded) {
      loadState();
      return { cancel: false };
    }
    if (shouldBlockSite(details.url)) {
      const nowDate = (new Date()).toISOString().slice(0,10);
      if (nowDate !== todayDate) {
        todayDate = nowDate;
        blocksToday = 0;
        chrome.storage.local.set({ blocksToday, todayDate });
      }
      blocksToday++;
      chrome.storage.local.set({ blocksToday, todayDate });
      return { redirectUrl: chrome.runtime.getURL('blocked.html') };
    }
    return { cancel: false };
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);

// Replace chrome.browserAction.onClicked with fallback for browser compatibility
if (ext.browserAction && ext.browserAction.onClicked) {
  ext.browserAction.onClicked.addListener(() => {
    state.isEnabled = !state.isEnabled;
    chrome.storage.local.set({ state });
    updateBadge();
  });
} else if (ext.action && ext.action.onClicked) {
  ext.action.onClicked.addListener(() => {
    state.isEnabled = !state.isEnabled;
    chrome.storage.local.set({ state });
    updateBadge();
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  ensureBlocklist();
  if (msg.action === "unblockForMinutes" && typeof msg.minutes === "number") {
    unblockUntil = Date.now() + msg.minutes * 60 * 1000;
    chrome.storage.local.set({ unblockUntil }, () => {
      updateBadge();
      sendResponse({ success: true, until: unblockUntil });
    });
    return true;
  } else if (msg.action === "getUnblockStatus") {
    sendResponse({ unblockUntil });
    return false;
  } else if (msg.action === "getBlocklistState" && msg.domain) {
    sendResponse({ isBlocked: state.blockedSites.map(normalizeDomain).includes(normalizeDomain(msg.domain)) });
    return false;
  } else if (msg.action === "addToBlocklist" && msg.domain) {
    const nd = normalizeDomain(msg.domain);
    if (!state.blockedSites.map(normalizeDomain).includes(nd)) {
      state.blockedSites.push(msg.domain);
      chrome.storage.local.set({ state }, () => sendResponse({ success: true }));
      return true;
    } else {
      sendResponse({ success: true });
      return false;
    }
  } else if (msg.action === "removeFromBlocklist" && msg.domain) {
    const nd = normalizeDomain(msg.domain);
    state.blockedSites = state.blockedSites.filter(site => normalizeDomain(site) !== nd);
    chrome.storage.local.set({ state }, () => sendResponse({ success: true }));
    return true;
  } else if (msg.action === "getBlockingState") {
    sendResponse({ isEnabled: state.isEnabled });
    return false;
  } else if (msg.action === "toggleBlocking") {
    state.isEnabled = !state.isEnabled;
    chrome.storage.local.set({ state }, () => {
      updateBadge();
      sendResponse({ isEnabled: state.isEnabled });
    });
    return true;
  } else if (msg.action === "getPopupState") {
    chrome.storage.local.get(['state', 'blocksToday', 'todayDate'], (result) => {
      const nowDate = (new Date()).toISOString().slice(0,10);
      let blocks = result.blocksToday || 0;
      if (result.todayDate !== nowDate) {
        blocks = 0;
        chrome.storage.local.set({ blocksToday: 0, todayDate: nowDate });
      }
      sendResponse({
        isEnabled: state.isEnabled,
        blockedSites: state.blockedSites,
        blocksToday: blocks
      });
    });
    return true;
  }
});

setInterval(() => {
  if (unblockUntil && Date.now() > unblockUntil) {
    unblockUntil = null;
    chrome.storage.local.remove('unblockUntil');
    updateBadge();
  }
}, 10000);
