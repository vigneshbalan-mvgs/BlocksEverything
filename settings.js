document.addEventListener('DOMContentLoaded', () => {
  const passwordSection = document.getElementById('passwordSection');
  const settingsContent = document.getElementById('settingsContent');
  let state = null;

  // Load state
  chrome.storage.local.get(['state'], (result) => {
    state = result.state || { password: '', blockedSites: [] };
  });

  // Password handling
  document.getElementById('unlockBtn').addEventListener('click', () => {
    const password = document.getElementById('passwordInput').value;
    if (password === state.password) {
      passwordSection.classList.add('hidden');
      settingsContent.classList.remove('hidden');
      loadSettings();
    } else {
      alert('Incorrect password!');
    }
  });

  function loadSettings() {
    const sitesList = document.getElementById('sitesList');
    sitesList.innerHTML = '';
    state.blockedSites.forEach(site => {
      const li = document.createElement('li');
      li.textContent = site;
      const removeBtn = document.createElement('button');
      removeBtn.textContent = '✕';
      removeBtn.onclick = () => removeSite(site);
      li.appendChild(removeBtn);
      sitesList.appendChild(li);
    });
  }

  document.getElementById('addSite').addEventListener('click', () => {
    const newSite = document.getElementById('newSite').value.trim();
    if (newSite && !state.blockedSites.includes(newSite)) {
      state.blockedSites.push(newSite);
      chrome.storage.local.set({ state }, loadSettings);
    }
  });

  document.getElementById('saveSettings').addEventListener('click', () => {
    chrome.storage.local.set({ state }, () => {
      alert('Settings saved!');
    });
  });

  function removeSite(site) {
    state.blockedSites = state.blockedSites.filter(s => s !== site);
    chrome.storage.local.set({ state }, loadSettings);
  }
});
