const testTitleEl = document.getElementById('testTitle');
const runListView = document.getElementById('runListView');
const runListEl = document.getElementById('runList');
const runDetailView = document.getElementById('runDetailView');
const runMetaEl = document.getElementById('runMeta');
const stepListEl = document.getElementById('stepList');
const backBtn = document.getElementById('backBtn');

let currentFileName = null;

function statusLabel(result) {
  if (result.status === 'baseline-created') return 'Baseline created';
  if (result.status === 'match') return `Match (${result.mismatchPercent.toFixed(2)}% diff)`;
  return `Mismatch (${result.mismatchPercent.toFixed(2)}% diff)`;
}

async function showRunList() {
  runDetailView.style.display = 'none';
  runListView.style.display = 'block';

  const { testName, runs } = await window.api.listRuns(currentFileName);
  testTitleEl.textContent = testName;

  if (runs.length === 0) {
    runListEl.innerHTML = '<div class="empty-state">No runs yet for this smoke test.</div>';
    return;
  }

  runListEl.innerHTML = '';
  for (const run of runs) {
    const item = document.createElement('div');
    item.className = 'test-item';
    const when = new Date(run.finishedAt).toLocaleString();
    const badge = run.mismatchCount > 0
      ? `<span class="meta mismatch-count">${run.mismatchCount} mismatch${run.mismatchCount === 1 ? '' : 'es'}</span>`
      : '<span class="meta match-count">all matched</span>';
    item.innerHTML = `<span class="name">${when}</span>${badge}`;
    item.addEventListener('click', () => showRunDetail(run.runId));
    runListEl.appendChild(item);
  }
}

async function showRunDetail(runId) {
  const report = await window.api.getRunReport(currentFileName, runId);
  runListView.style.display = 'none';
  runDetailView.style.display = 'block';
  runMetaEl.textContent = `Run finished ${new Date(report.finishedAt).toLocaleString()}`;

  stepListEl.innerHTML = '';
  for (const r of report.results) {
    const card = document.createElement('div');
    card.className = `step-card ${r.status}`;

    let imagesHtml = '';
    if (r.screenshotUrl) {
      imagesHtml += `<div class="step-image"><span>Captured</span><img src="${r.screenshotUrl}" data-path="${r.screenshotPath}" /></div>`;
    }
    if (r.status === 'mismatch' && r.baselineUrl) {
      imagesHtml += `<div class="step-image"><span>Baseline</span><img src="${r.baselineUrl}" /></div>`;
    }
    if (r.diffUrl) {
      imagesHtml += `<div class="step-image"><span>Diff</span><img src="${r.diffUrl}" data-path="${r.diffPath}" /></div>`;
    }

    card.innerHTML = `
      <div class="step-card-header">
        <span class="step-instruction">${r.instruction}</span>
        <span class="step-status ${r.status}">${statusLabel(r)}</span>
      </div>
      <div class="step-images">${imagesHtml}</div>
    `;
    stepListEl.appendChild(card);
  }

  stepListEl.querySelectorAll('img[data-path]').forEach((img) => {
    img.addEventListener('click', () => window.api.openPath(img.dataset.path));
  });
}

backBtn.addEventListener('click', showRunList);

window.api.onResultsInit(({ fileName }) => {
  currentFileName = fileName;
  showRunList();
});
