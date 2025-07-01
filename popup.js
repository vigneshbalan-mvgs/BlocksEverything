// Helper to get domain from URL
function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

let currentDomain = '';
let blocklist = [];

function renderBlocklist() {
  const ul = document.getElementById('blockedList');
  ul.innerHTML = '';
  blocklist.forEach(domain => {
    const li = document.createElement('li');
    li.textContent = domain;
    const btn = document.createElement('button');
    btn.textContent = '✕';
    btn.className = 'remove-btn';
    btn.onclick = () => {
      chrome.runtime.sendMessage({ action: "removeFromBlocklist", domain }, () => {
        blocklist = blocklist.filter(d => d !== domain);
        renderBlocklist();
      });
    };
    li.appendChild(btn);
    ul.appendChild(li);
  });
}

function updateToggleSwitch(isEnabled) {
  const toggle = document.getElementById('toggleBlockSwitch');
  const label = document.getElementById('toggleLabel');
  toggle.checked = isEnabled;
  label.textContent = isEnabled ? "Blocking is ON" : "Blocking is OFF";
}

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const url = tabs[0].url;
  currentDomain = getDomain(url);
  document.getElementById('domain').textContent = currentDomain;

  // Get blocklist and blocking state
  chrome.runtime.sendMessage({ action: "getPopupState" }, (resp) => {
    blocklist = resp.blockedSites || [];
    renderBlocklist();
    updateToggleSwitch(resp.isEnabled);
    document.getElementById('blocksToday').textContent = resp.blocksToday || 0;

    // Disable add button if already blocked
    document.getElementById('addBtn').disabled = blocklist.includes(currentDomain);
  });
});

// Toggle ON/OFF
document.getElementById('toggleBlockSwitch').addEventListener('change', function() {
  chrome.runtime.sendMessage({ action: "toggleBlocking" }, (resp) => {
    updateToggleSwitch(resp.isEnabled);
  });
});

// Add current site to blocklist
document.getElementById('addBtn').onclick = () => {
  if (!currentDomain) return;
  chrome.runtime.sendMessage({ action: "addToBlocklist", domain: currentDomain }, () => {
    if (!blocklist.includes(currentDomain)) {
      blocklist.push(currentDomain);
      renderBlocklist();
      document.getElementById('addBtn').disabled = true;
    }
  });
};
