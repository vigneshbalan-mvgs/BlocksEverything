let state = {
  isEnabled: true,
  blockedSites: ['youtube.com', 'reddit.com', 'instagram.com'],
  schedule: [
    { start: '10:00', end: '13:00' },
    { start: '19:00', end: '22:00' }
  ],
  password: '1234' // Default password
};

let unblockUntil = null;

function updateBadge() {
  chrome.browserAction.setBadgeText({ text: state.isEnabled ? "ON" : "OFF" });
  chrome.browserAction.setBadgeBackgroundColor({ color: state.isEnabled ? "#d32f2f" : "#388e3c" }); // red or green
}

// Load state and unblockUntil from storage
chrome.storage.local.get(['state', 'unblockUntil'], (result) => {
  if (result.state) {
    state = { ...state, ...result.state };
  } else {
    chrome.storage.local.set({ state });
  }
  unblockUntil = result.unblockUntil || null;
  updateBadge();
});

function isTemporarilyUnblocked() {
  if (!unblockUntil) return false;
  return Date.now() < unblockUntil;
}

function isInBlockedHours() {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  return state.schedule.some(window => {
    return currentTime >= window.start && currentTime <= window.end;
  });
}

function shouldBlockSite(url) {
  if (!state.isEnabled || !isInBlockedHours() || isTemporarilyUnblocked()) return false;
  
  const hostname = new URL(url).hostname;
  return state.blockedSites.some(site => hostname.includes(site));
}

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (shouldBlockSite(details.url)) {
      return { redirectUrl: chrome.runtime.getURL('blocked.html') };
    }
    return { cancel: false };
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);

chrome.browserAction.onClicked.addListener(() => {
  state.isEnabled = !state.isEnabled;
  chrome.storage.local.set({ state });
  updateBadge();
});

// Listen for timer unblock requests
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "unblockForMinutes" && typeof msg.minutes === "number") {
    unblockUntil = Date.now() + msg.minutes * 60 * 1000;
    chrome.storage.local.set({ unblockUntil }, () => {
      updateBadge();
      sendResponse({ success: true, until: unblockUntil });
    });
    return true; // Indicate async response
  } else if (msg.action === "getUnblockStatus") {
    sendResponse({ unblockUntil });
    return false;
  } else if (msg.action === "getBlocklistState" && msg.domain) {
    const isBlocked = state.blockedSites.includes(msg.domain);
    sendResponse({ isBlocked });
    return false;
  } else if (msg.action === "addToBlocklist" && msg.domain) {
    if (!state.blockedSites.includes(msg.domain)) {
      state.blockedSites.push(msg.domain);
      chrome.storage.local.set({ state }, () => {
        sendResponse({ success: true });
      });
      return true; // Indicate async response
    } else {
      sendResponse({ success: true });
      return false;
    }
  } else if (msg.action === "removeFromBlocklist" && msg.domain) {
    state.blockedSites = state.blockedSites.filter(site => site !== msg.domain);
    chrome.storage.local.set({ state }, () => {
      sendResponse({ success: true });
    });
    return true; // Indicate async response
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
  }
});

// Periodically check if unblock expired and update badge
setInterval(() => {
  if (unblockUntil && Date.now() > unblockUntil) {
    unblockUntil = null;
    chrome.storage.local.remove('unblockUntil');
    updateBadge();
  }
}, 10000);
