const titleEl = document.getElementById('editorTitle');
const errorEl = document.getElementById('editorError');
const contentEl = document.getElementById('editorContent');
const thresholdInput = document.getElementById('thresholdInput');
const closeBtn = document.getElementById('closeBtn');
const downloadBtn = document.getElementById('downloadBtn');
const saveBtn = document.getElementById('saveBtn');

let currentFileName = null;

function showError(message) {
  errorEl.textContent = message;
  errorEl.style.display = message ? 'block' : 'none';
}

function contentWithThreshold() {
  const json = JSON.parse(contentEl.value);
  const threshold = parseFloat(thresholdInput.value);
  json.mismatchThreshold = Number.isFinite(threshold) ? threshold : 0.1;
  return JSON.stringify(json, null, 2);
}

window.api.onEditorInit(({ fileName, testName, content }) => {
  currentFileName = fileName;
  titleEl.textContent = `Edit — ${testName}`;
  contentEl.value = content;
  try {
    const json = JSON.parse(content);
    thresholdInput.value = typeof json.mismatchThreshold === 'number' ? json.mismatchThreshold : 0.1;
  } catch {
    thresholdInput.value = 0.1;
  }
});

saveBtn.addEventListener('click', async () => {
  showError('');
  try {
    const merged = contentWithThreshold();
    await window.api.saveTestContent(currentFileName, merged);
    contentEl.value = merged;
    saveBtn.textContent = 'Saved ✓';
    setTimeout(() => { saveBtn.textContent = 'Save'; }, 1500);
  } catch (err) {
    showError(err.message || String(err));
  }
});

downloadBtn.addEventListener('click', async () => {
  showError('');
  try {
    const merged = contentWithThreshold();
    await window.api.downloadTestContent(currentFileName, merged);
  } catch (err) {
    showError(err.message || String(err));
  }
});

closeBtn.addEventListener('click', () => window.close());
