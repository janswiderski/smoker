const testTitleEl = document.getElementById('testTitle');
const mainMenuBtn = document.getElementById('mainMenuBtn');
const runListView = document.getElementById('runListView');
const runListEl = document.getElementById('runList');
const runDetailView = document.getElementById('runDetailView');
const runMetaEl = document.getElementById('runMeta');
const stepListEl = document.getElementById('stepList');
const backBtn = document.getElementById('backBtn');
const setBaselineBtn = document.getElementById('setBaselineBtn');
const deleteRunBtn = document.getElementById('deleteRunBtn');

const lightboxEl = document.getElementById('lightbox');
const lightboxTitleEl = document.getElementById('lightboxTitle');
const lightboxBodyEl = document.getElementById('lightboxBody');
const lightboxStepLabelEl = document.getElementById('lightboxStepLabel');
const modeSideBySideBtn = document.getElementById('modeSideBySideBtn');
const modeDiffBtn = document.getElementById('modeDiffBtn');
const lightboxCloseBtn = document.getElementById('lightboxCloseBtn');
const lightboxPrevBtn = document.getElementById('lightboxPrevBtn');
const lightboxNextBtn = document.getElementById('lightboxNextBtn');

let currentFileName = null;
let currentRunId = null;
let currentReport = null;
let shotsWithImages = [];
let lightboxIndex = 0;
let lightboxMode = 'side-by-side';

function statusLabel(result) {
  if (result.status === 'baseline-created') return 'Baseline created';
  if (result.status === 'match') return `Match (${result.mismatchPercent.toFixed(2)}% diff)`;
  return `Mismatch (${result.mismatchPercent.toFixed(2)}% diff)`;
}

async function showRunList() {
  currentRunId = null;
  currentReport = null;
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
    const when = new Date(run.startedAt || run.finishedAt).toLocaleString();
    let badge;
    if (run.stepCount === 0) {
      badge = '<span class="meta">no screenshots taken</span>';
    } else if (run.mismatchCount > 0) {
      badge = `<span class="meta mismatch-count">${run.mismatchCount} mismatch${run.mismatchCount === 1 ? '' : 'es'}</span>`;
    } else {
      badge = '<span class="meta match-count">all matched</span>';
    }
    item.innerHTML = `
      <span class="name">Run #${run.runNumber} — ${when}</span>
      <span class="run-row-right">
        ${badge}
        <button class="secondary danger-outline delete-run-btn">Delete</button>
      </span>
    `;
    item.addEventListener('click', () => showRunDetail(run.runId));
    item.querySelector('.delete-run-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!window.confirm(`Delete Run #${run.runNumber} permanently? This cannot be undone.`)) return;
      await window.api.deleteRun(currentFileName, run.runId);
      showRunList();
    });
    runListEl.appendChild(item);
  }
}

async function showRunDetail(runId) {
  const report = await window.api.getRunReport(currentFileName, runId);
  currentRunId = runId;
  currentReport = report;
  shotsWithImages = report.results.filter((r) => r.screenshotUrl);

  runListView.style.display = 'none';
  runDetailView.style.display = 'block';

  const started = report.startedAt ? new Date(report.startedAt).toLocaleString() : null;
  const finished = new Date(report.finishedAt).toLocaleString();
  runMetaEl.textContent = started
    ? `Run #${report.runNumber} — started ${started}, finished ${finished}`
    : `Run #${report.runNumber} — finished ${finished}`;

  const runLabel = `Run #${report.runNumber}`;
  stepListEl.innerHTML = '';

  if (report.results.length === 0) {
    stepListEl.innerHTML = '<div class="empty-state">This run was saved, but no screenshots were taken before it ended.</div>';
  }

  for (const r of report.results) {
    const card = document.createElement('div');
    card.className = `step-card ${r.status}`;

    let imagesHtml = '';
    if (r.screenshotUrl) {
      imagesHtml += `<div class="step-image"><span>${runLabel}</span><img src="${r.screenshotUrl}" data-step-id="${r.stepId}" /></div>`;
    }
    if (r.baselineUrl) {
      imagesHtml += `<div class="step-image"><span>Baseline</span><img src="${r.baselineUrl}" data-step-id="${r.stepId}" /></div>`;
    }
    if (r.diffUrl) {
      imagesHtml += `<div class="step-image"><span>Diff</span><img src="${r.diffUrl}" data-step-id="${r.stepId}" /></div>`;
    }

    const collageBtnHtml = r.screenshotUrl
      ? `<button class="secondary download-collage-btn" data-step-id="${r.stepId}">Download Collage</button>`
      : '';

    card.innerHTML = `
      <div class="step-card-header">
        <span class="step-instruction">${linkify(r.instruction)}</span>
        <span class="step-status ${r.status}">${statusLabel(r)}</span>
      </div>
      <div class="step-images">${imagesHtml}</div>
      ${collageBtnHtml ? `<div class="step-card-footer">${collageBtnHtml}</div>` : ''}
    `;
    stepListEl.appendChild(card);
  }

  stepListEl.querySelectorAll('img[data-step-id]').forEach((img) => {
    img.addEventListener('click', () => {
      const stepId = Number(img.dataset.stepId);
      const index = shotsWithImages.findIndex((r) => r.stepId === stepId);
      if (index >= 0) openLightbox(index);
    });
  });

  stepListEl.querySelectorAll('.download-collage-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const stepId = Number(btn.dataset.stepId);
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Building…';
      try {
        const res = await window.api.downloadCollage(currentFileName, currentRunId, stepId);
        btn.textContent = res.saved ? 'Saved ✓' : originalText;
      } finally {
        btn.disabled = false;
        setTimeout(() => { btn.textContent = originalText; }, 1500);
      }
    });
  });
}

function openLightbox(index) {
  lightboxIndex = index;
  lightboxMode = 'side-by-side';
  lightboxEl.style.display = 'flex';
  renderLightbox();
}

function closeLightbox() {
  lightboxEl.style.display = 'none';
}

function renderLightbox() {
  const r = shotsWithImages[lightboxIndex];
  const runLabel = `Run #${currentReport.runNumber}`;

  lightboxTitleEl.textContent = `Step ${r.stepId} — ${r.instruction}`;
  lightboxStepLabelEl.textContent = `${lightboxIndex + 1} / ${shotsWithImages.length}`;

  modeDiffBtn.style.display = r.diffUrl ? 'inline-block' : 'none';
  modeSideBySideBtn.classList.toggle('mode-active', lightboxMode === 'side-by-side');
  modeDiffBtn.classList.toggle('mode-active', lightboxMode === 'diff');

  if (lightboxMode === 'diff' && r.diffUrl) {
    lightboxBodyEl.innerHTML = `
      <div class="lightbox-pane full">
        <span class="lightbox-pane-label">Diff Highlight — ${runLabel} vs Baseline</span>
        <img src="${r.diffUrl}" />
      </div>
    `;
  } else {
    lightboxBodyEl.innerHTML = `
      <div class="lightbox-pane">
        <span class="lightbox-pane-label">Baseline</span>
        ${r.baselineUrl ? `<img src="${r.baselineUrl}" />` : '<div class="lightbox-missing">No baseline available</div>'}
      </div>
      <div class="lightbox-pane">
        <span class="lightbox-pane-label">${runLabel} (Current)</span>
        <img src="${r.screenshotUrl}" />
      </div>
    `;
  }
}

modeSideBySideBtn.addEventListener('click', () => {
  lightboxMode = 'side-by-side';
  renderLightbox();
});
modeDiffBtn.addEventListener('click', () => {
  if (!shotsWithImages[lightboxIndex].diffUrl) return;
  lightboxMode = 'diff';
  renderLightbox();
});
lightboxPrevBtn.addEventListener('click', () => {
  lightboxIndex = (lightboxIndex - 1 + shotsWithImages.length) % shotsWithImages.length;
  renderLightbox();
});
lightboxNextBtn.addEventListener('click', () => {
  lightboxIndex = (lightboxIndex + 1) % shotsWithImages.length;
  renderLightbox();
});
lightboxCloseBtn.addEventListener('click', closeLightbox);

document.addEventListener('keydown', (e) => {
  if (lightboxEl.style.display === 'none') return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') lightboxPrevBtn.click();
  if (e.key === 'ArrowRight') lightboxNextBtn.click();
});

setBaselineBtn.addEventListener('click', async () => {
  if (!currentRunId || !currentReport) return;
  if (!window.confirm(`Use Run #${currentReport.runNumber} as the new baseline for all its screenshot steps?`)) return;
  await window.api.setRunAsBaseline(currentFileName, currentRunId);
  await showRunDetail(currentRunId);
});

deleteRunBtn.addEventListener('click', async () => {
  if (!currentRunId || !currentReport) return;
  if (!window.confirm(`Delete Run #${currentReport.runNumber} permanently? This cannot be undone.`)) return;
  await window.api.deleteRun(currentFileName, currentRunId);
  showRunList();
});

backBtn.addEventListener('click', showRunList);
mainMenuBtn.addEventListener('click', () => window.close());

window.api.onResultsInit(({ fileName }) => {
  currentFileName = fileName;
  showRunList();
});
