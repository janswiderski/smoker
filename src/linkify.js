function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function linkify(text) {
  const escaped = escapeHtml(text);
  return escaped.replace(/(https?:\/\/[^\s<]+)/g, (url) => `<a href="${url}" data-external-link>${url}</a>`);
}

document.addEventListener('click', (e) => {
  const link = e.target.closest('a[data-external-link]');
  if (!link) return;
  e.preventDefault();
  window.api.openExternal(link.getAttribute('href'));
});
