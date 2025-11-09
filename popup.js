// Get version from manifest and display it
chrome.runtime.getManifest && (() => {
  const manifest = chrome.runtime.getManifest();
  const versionElement = document.getElementById('version');
  if (versionElement && manifest.version) {
    versionElement.textContent = manifest.version;
  }
})();
