const testListEl = document.getElementById('testList');
const startBtn = document.getElementById('startBtn');
const resultsBtn = document.getElementById('resultsBtn');
const uploadBtn = document.getElementById('uploadBtn');
const errorEl = document.getElementById('error');

let tests = [];
let selectedFile = null;

function showError(message) {
  errorEl.textContent = message;
  errorEl.style.display = message ? 'block' : 'none';
}

function render() {
  if (tests.length === 0) {
    testListEl.innerHTML = '<div class="empty-state">No smoke tests yet. Upload a JSON checklist to get started.</div>';
    return;
  }
  testListEl.innerHTML = '';
  for (const test of tests) {
    const item = document.createElement('div');
    item.className = 'test-item' + (test.file === selectedFile ? ' selected' : '');
    item.innerHTML = `<span class="name">${test.name}</span><span class="meta">${test.stepCount} steps</span>`;
    item.addEventListener('click', () => {
      selectedFile = test.file;
      startBtn.disabled = false;
      resultsBtn.disabled = false;
      render();
    });
    testListEl.appendChild(item);
  }
}

async function loadTests() {
  tests = await window.api.listSmokeTests();
  render();
}

uploadBtn.addEventListener('click', async () => {
  showError('');
  try {
    const uploaded = await window.api.uploadSmokeTest();
    if (uploaded) {
      await loadTests();
      selectedFile = uploaded.file;
      startBtn.disabled = false;
      resultsBtn.disabled = false;
      render();
    }
  } catch (err) {
    showError(err.message || String(err));
  }
});

startBtn.addEventListener('click', async () => {
  if (!selectedFile) return;
  showError('');
  try {
    await window.api.startRun(selectedFile);
  } catch (err) {
    showError(err.message || String(err));
  }
});

resultsBtn.addEventListener('click', () => {
  if (!selectedFile) return;
  window.api.openResults(selectedFile);
});

loadTests();
