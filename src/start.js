const errorEl = document.getElementById('error');

const projectsView = document.getElementById('projectsView');
const projectListEl = document.getElementById('projectList');

const shelfView = document.getElementById('shelfView');
const shelfProjectNameEl = document.getElementById('shelfProjectName');
const backToProjectsBtn = document.getElementById('backToProjectsBtn');
const packRowEl = document.getElementById('packRow');
const packPrevBtn = document.getElementById('packPrevBtn');
const packNextBtn = document.getElementById('packNextBtn');

const actionOverlay = document.getElementById('actionOverlay');
const actionPlanNameEl = document.getElementById('actionPlanName');
const actionStartBtn = document.getElementById('actionStartBtn');
const actionResultsBtn = document.getElementById('actionResultsBtn');
const actionEditBtn = document.getElementById('actionEditBtn');
const actionDownloadBtn = document.getElementById('actionDownloadBtn');
const actionDeleteBtn = document.getElementById('actionDeleteBtn');
const actionBackBtn = document.getElementById('actionBackBtn');

const PACK_COLORS = ['#2f6fed', '#e0393e', '#2fae5c', '#a04fd6', '#e08a1e', '#1eb8b0', '#d6417a'];

let currentProject = null;
let selectedTestFile = null;

function showError(message) {
  errorEl.textContent = message;
  errorEl.style.display = message ? 'block' : 'none';
}

function playOpenAnimation(el) {
  return new Promise((resolve) => {
    el.classList.add('opening');
    setTimeout(resolve, 320);
  });
}

function enterView(el, displayValue) {
  el.style.display = displayValue;
  el.classList.add('enter');
  void el.offsetWidth;
  el.classList.remove('enter');
}

async function loadProjects() {
  const projects = await window.api.listProjects();
  renderProjects(projects);
}

function renderProjects(projects) {
  projectListEl.innerHTML = '';

  projects.forEach((project) => {
    const cover = document.createElement('div');
    cover.className = 'shelf-cover';
    cover.textContent = project.name;
    cover.addEventListener('click', () => openProject(project, cover));
    projectListEl.appendChild(cover);
  });

  const addCover = document.createElement('div');
  addCover.className = 'shelf-cover add-new';
  addCover.textContent = '+ Add New Project';
  addCover.addEventListener('click', createProjectFlow);
  projectListEl.appendChild(addCover);
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

async function openProject(project, coverEl) {
  currentProject = project;
  await playOpenAnimation(coverEl);
  coverEl.classList.remove('opening');
  projectsView.style.display = 'none';
  await loadShelf(project);
  enterView(shelfView, 'flex');
}

async function loadShelf(project) {
  shelfProjectNameEl.textContent = project.name;
  const tests = await window.api.listSmokeTests();
  renderPackRow(tests.filter((t) => t.projectId === project.id));
}

function renderPackRow(tests) {
  packRowEl.innerHTML = '';

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
    packRowEl.appendChild(pack);
  });

  const addPack = document.createElement('div');
  addPack.className = 'pack pack-add';
  addPack.innerHTML = `
    <div class="pack-notch add-notch"></div>
    <div class="pack-body"><span class="pack-name">+ Add Test Plan</span></div>
    <div class="pack-band add-band"></div>
  `;
  addPack.addEventListener('click', addTestPlanFlow);
  packRowEl.appendChild(addPack);

  updateChevronVisibility();
}

function updateChevronVisibility() {
  requestAnimationFrame(() => {
    const overflow = packRowEl.scrollWidth > packRowEl.clientWidth + 4;
    packPrevBtn.style.visibility = overflow ? 'visible' : 'hidden';
    packNextBtn.style.visibility = overflow ? 'visible' : 'hidden';
  });
}

packPrevBtn.addEventListener('click', () => packRowEl.scrollBy({ left: -280, behavior: 'smooth' }));
packNextBtn.addEventListener('click', () => packRowEl.scrollBy({ left: 280, behavior: 'smooth' }));
window.addEventListener('resize', updateChevronVisibility);

async function addTestPlanFlow() {
  if (!currentProject) return;
  showError('');
  try {
    const uploaded = await window.api.uploadSmokeTest(currentProject.id);
    if (uploaded) await loadShelf(currentProject);
  } catch (err) {
    showError(err.message || String(err));
  }
}

backToProjectsBtn.addEventListener('click', () => {
  shelfView.style.display = 'none';
  currentProject = null;
  enterView(projectsView, 'block');
});

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
  if (!selectedTestFile || !currentProject) return;
  if (!window.confirm(`Delete "${actionPlanNameEl.textContent}" and all of its run history? This cannot be undone.`)) return;
  const project = currentProject;
  await window.api.deleteSmokeTest(selectedTestFile);
  closeActionPanel();
  await loadShelf(project);
});

window.addEventListener('focus', () => {
  if (currentProject) {
    loadShelf(currentProject);
  } else {
    loadProjects();
  }
});

loadProjects();
