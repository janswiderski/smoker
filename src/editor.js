const titleEl = document.getElementById('editorTitle');
const errorEl = document.getElementById('editorError');
const contentEl = document.getElementById('editorContent');
const closeBtn = document.getElementById('closeBtn');
const downloadBtn = document.getElementById('downloadBtn');
const saveBtn = document.getElementById('saveBtn');

let currentFileName = null;

function showError(message) {
  errorEl.textContent = message;
  errorEl.style.display = message ? 'block' : 'none';
}

window.api.onEditorInit(({ fileName, testName, content }) => {
  currentFileName = fileName;
  titleEl.textContent = `Edit — ${testName}`;
  contentEl.value = content;
});

saveBtn.addEventListener('click', async () => {
  showError('');
  try {
    await window.api.saveTestContent(currentFileName, contentEl.value);
    saveBtn.textContent = 'Saved ✓';
    setTimeout(() => { saveBtn.textContent = 'Save'; }, 1500);
  } catch (err) {
    showError(err.message || String(err));
  }
});

downloadBtn.addEventListener('click', async () => {
  showError('');
  try {
    await window.api.downloadTestContent(currentFileName, contentEl.value);
  } catch (err) {
    showError(err.message || String(err));
  }
});

closeBtn.addEventListener('click', () => window.close());
