function escapeHtml(value) {
  return String(value ?? "Unknown").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

export function renderAboutContent({ systemTitle, systemId, systemVersion, foundryVersion }) {
  return `<div class="sf-dialog sf-about">
    <p>${escapeHtml(systemTitle)}</p>
    <dl>
      <div><dt>System version</dt><dd>${escapeHtml(systemVersion)}</dd></div>
      <div><dt>Foundry version</dt><dd>${escapeHtml(foundryVersion)}</dd></div>
      <div><dt>System ID</dt><dd>${escapeHtml(systemId)}</dd></div>
    </dl>
    <p>These are the versions loaded in this game session.</p>
  </div>`;
}
