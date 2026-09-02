const errorEl = document.getElementById('error');
const projectListEl = document.getElementById('projectList');

const actionOverlay = document.getElementById('actionOverlay');
const actionPlanNameEl = document.getElementById('actionPlanName');
const actionStartBtn = document.getElementById('actionStartBtn');
const actionResultsBtn = document.getElementById('actionResultsBtn');
const actionEditBtn = document.getElementById('actionEditBtn');
const actionDownloadBtn = document.getElementById('actionDownloadBtn');
const actionDeleteBtn = document.getElementById('actionDeleteBtn');
const actionBackBtn = document.getElementById('actionBackBtn');

const PACK_COLORS = ['#2f6fed', '#e0393e', '#2fae5c', '#a04fd6', '#e08a1e', '#1eb8b0', '#d6417a'];
const CHEVRON_SCROLL_AMOUNT = 280;

let openUnitEl = null;
let selectedTestFile = null;

document.getElementById('winCloseBtn').addEventListener('click', () => window.close());
document.getElementById('winMinimizeBtn').addEventListener('click', () => window.api.minimizeWindow());

function showError(message) {
  errorEl.textContent = message;
  errorEl.style.display = message ? 'block' : 'none';
}

async function loadProjects() {
  const [projects, tests] = await Promise.all([window.api.listProjects(), window.api.listSmokeTests()]);
  renderProjects(projects, tests);
}

function renderProjects(projects, tests) {
  projectListEl.innerHTML = '';
  openUnitEl = null;

  projects.forEach((project) => {
    const projectTests = tests.filter((t) => t.projectId === project.id);
    projectListEl.appendChild(buildShelfUnit(project, projectTests));
  });

  const addCover = document.createElement('div');
  addCover.className = 'shelf-cover add-new';
  addCover.textContent = '+ Add New Project';
  addCover.addEventListener('click', createProjectFlow);
  projectListEl.appendChild(addCover);
}

function buildShelfUnit(project, tests) {
  const unit = document.createElement('div');
  unit.className = 'shelf-unit';
  unit.dataset.projectId = project.id;

  const packArea = document.createElement('div');
  packArea.className = 'shelf-pack-area';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'chevron-btn chevron-prev';
  prevBtn.textContent = '‹';
  prevBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    packRow.scrollBy({ left: -CHEVRON_SCROLL_AMOUNT, behavior: 'smooth' });
  });

  const packRow = document.createElement('div');
  packRow.className = 'pack-row';

  const nextBtn = document.createElement('button');
  nextBtn.className = 'chevron-btn chevron-next';
  nextBtn.textContent = '›';
  nextBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    packRow.scrollBy({ left: CHEVRON_SCROLL_AMOUNT, behavior: 'smooth' });
  });

  packArea.append(prevBtn, packRow, nextBtn);
  renderPacksInto(packRow, tests, project);

  const flap = document.createElement('div');
  flap.className = 'shelf-cover-flap';
  flap.innerHTML = `
    <span class="shelf-cover-name">${project.name}</span>
    <span class="shelf-cover-actions">
      <button class="icon-btn rename-btn" title="Rename project">✏️</button>
      <button class="icon-btn delete-btn" title="Delete project">🗑</button>
    </span>
  `;
  flap.addEventListener('click', () => toggleShelf(unit, packRow, prevBtn, nextBtn));
  flap.querySelector('.rename-btn').addEventListener('click', (e) => renameProjectFlow(e, project));
  flap.querySelector('.delete-btn').addEventListener('click', (e) => deleteProjectFlow(e, project));

  unit.append(packArea, flap);
  updateChevronVisibility(packRow, prevBtn, nextBtn);
  return unit;
}

function toggleShelf(unit, packRow, prevBtn, nextBtn) {
  if (openUnitEl && openUnitEl !== unit) {
    openUnitEl.classList.remove('open');
  }
  const isOpen = unit.classList.toggle('open');
  openUnitEl = isOpen ? unit : null;
  if (isOpen) {
    updateChevronVisibility(packRow, prevBtn, nextBtn);
  }
}

function updateChevronVisibility(packRow, prevBtn, nextBtn) {
  requestAnimationFrame(() => {
    const overflow = packRow.scrollWidth > packRow.clientWidth + 4;
    prevBtn.style.visibility = overflow ? 'visible' : 'hidden';
    nextBtn.style.visibility = overflow ? 'visible' : 'hidden';
  });
}

function renderPacksInto(packRow, tests, project) {
  packRow.innerHTML = '';

  tests.forEach((test, i) => {
    const pack = document.createElement('div');
    pack.className = 'pack';
    pack.style.setProperty('--pack-color', PACK_COLORS[i % PACK_COLORS.length]);
    pack.innerHTML = `
      <div class="pack-notch"></div>
      <div class="pack-body"><span class="pack-name">${test.name}</span></div>
      <div class="pack-band"></div>
    `;
    pack.addEventListener('click', () => openActionPanel(test));
    packRow.appendChild(pack);
  });

  const addPack = document.createElement('div');
  addPack.className = 'pack pack-add';
  addPack.innerHTML = `
    <div class="pack-notch add-notch"></div>
    <div class="pack-body"><span class="pack-name">+ Add Test Plan</span></div>
    <div class="pack-band add-band"></div>
  `;
  addPack.addEventListener('click', () => addTestPlanFlow(project));
  packRow.appendChild(addPack);
}

async function refreshShelf(project) {
  const tests = await window.api.listSmokeTests();
  const unit = projectListEl.querySelector(`.shelf-unit[data-project-id="${CSS.escape(project.id)}"]`);
  if (!unit) return;
  const packRow = unit.querySelector('.pack-row');
  const prevBtn = unit.querySelector('.chevron-prev');
  const nextBtn = unit.querySelector('.chevron-next');
  renderPacksInto(packRow, tests.filter((t) => t.projectId === project.id), project);
  updateChevronVisibility(packRow, prevBtn, nextBtn);
}

async function createProjectFlow() {
  const name = window.prompt('New project name:');
  if (!name || !name.trim()) return;
  showError('');
  try {
    await window.api.createProject(name.trim());
    await loadProjects();
  } catch (err) {
    showError(err.message || String(err));
  }
}

async function renameProjectFlow(e, project) {
  e.stopPropagation();
  const newName = window.prompt('Rename project:', project.name);
  if (!newName || !newName.trim() || newName.trim() === project.name) return;
  showError('');
  try {
    await window.api.renameProject(project.id, newName.trim());
    await loadProjects();
  } catch (err) {
    showError(err.message || String(err));
  }
}

async function deleteProjectFlow(e, project) {
  e.stopPropagation();
  showError('');
  try {
    const tests = await window.api.listSmokeTests();
    const count = tests.filter((t) => t.projectId === project.id).length;
    const warning = count > 0
      ? `Delete "${project.name}" and permanently remove its ${count} test plan${count === 1 ? '' : 's'} (including all run history)? This cannot be undone.`
      : `Delete "${project.name}"? This cannot be undone.`;
    if (!window.confirm(warning)) return;
    await window.api.deleteProject(project.id);
    await loadProjects();
  } catch (err) {
    showError(err.message || String(err));
  }
}

async function addTestPlanFlow(project) {
  showError('');
  try {
    const mode = await window.api.chooseAddTestPlanMode();
    if (mode === 'blank') {
      const name = window.prompt('New test plan name:');
      if (!name || !name.trim()) return;
      const created = await window.api.createBlankTestPlan(name.trim(), project.id);
      await refreshShelf(project);
      window.api.openEditor(created.file);
    } else if (mode === 'import') {
      const uploaded = await window.api.uploadSmokeTest(project.id);
      if (uploaded) await refreshShelf(project);
    }
  } catch (err) {
    showError(err.message || String(err));
  }
}

function openActionPanel(test) {
  selectedTestFile = test.file;
  actionPlanNameEl.textContent = test.name;
  actionOverlay.style.display = 'flex';
}

function closeActionPanel() {
  actionOverlay.style.display = 'none';
  selectedTestFile = null;
}

actionOverlay.addEventListener('click', (e) => {
  if (e.target === actionOverlay) closeActionPanel();
});
actionBackBtn.addEventListener('click', closeActionPanel);

actionStartBtn.addEventListener('click', async () => {
  if (!selectedTestFile) return;
  showError('');
  try {
    await window.api.startRun(selectedTestFile);
    closeActionPanel();
  } catch (err) {
    showError(err.message || String(err));
  }
});

actionResultsBtn.addEventListener('click', () => {
  if (!selectedTestFile) return;
  window.api.openResults(selectedTestFile);
});

actionEditBtn.addEventListener('click', () => {
  if (!selectedTestFile) return;
  window.api.openEditor(selectedTestFile);
});

actionDownloadBtn.addEventListener('click', async () => {
  if (!selectedTestFile) return;
  showError('');
  try {
    await window.api.downloadTestPlan(selectedTestFile);
  } catch (err) {
    showError(err.message || String(err));
  }
});

actionDeleteBtn.addEventListener('click', async () => {
  if (!selectedTestFile) return;
  if (!window.confirm(`Delete "${actionPlanNameEl.textContent}" and all of its run history? This cannot be undone.`)) return;
  await window.api.deleteSmokeTest(selectedTestFile);
  closeActionPanel();
  await loadProjects();
});

window.addEventListener('focus', loadProjects);

loadProjects();
