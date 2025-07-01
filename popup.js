function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function updateUI(domain, isBlocked) {
  document.getElementById('domain').textContent = domain;
  document.getElementById('addBtn').disabled = isBlocked;
  document.getElementById('removeBtn').disabled = !isBlocked;
}

function updateToggleButton(isEnabled) {
  const btn = document.getElementById('toggleBlockBtn');
  btn.textContent = isEnabled ? "Turn OFF Blocking" : "Turn ON Blocking";
  document.getElementById('toggleStatus').textContent = isEnabled ? "Blocking is ON" : "Blocking is OFF";
}

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const url = tabs[0].url;
  const domain = getDomain(url);

  chrome.runtime.sendMessage({ action: "getBlocklistState", domain }, (resp) => {
    updateUI(domain, resp && resp.isBlocked);
  });

  document.getElementById('addBtn').onclick = () => {
    chrome.runtime.sendMessage({ action: "addToBlocklist", domain }, (resp) => {
      document.getElementById('status').textContent = "Added!";
      updateUI(domain, true);
    });
  };

  document.getElementById('removeBtn').onclick = () => {
    chrome.runtime.sendMessage({ action: "removeFromBlocklist", domain }, (resp) => {
      document.getElementById('status').textContent = "Removed!";
      updateUI(domain, false);
    });
  };
});

chrome.runtime.sendMessage({ action: "getBlockingState" }, (resp) => {
  updateToggleButton(resp && resp.isEnabled);
  btnState = resp && resp.isEnabled;
});

let btnState = true;
document.getElementById('toggleBlockBtn').onclick = () => {
  chrome.runtime.sendMessage({ action: "toggleBlocking" }, (resp) => {
    btnState = resp.isEnabled;
    updateToggleButton(btnState);
  });
};
