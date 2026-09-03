import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ================================================================
// DOM overlay: error banner, action panel (per test plan), text prompt
// ================================================================
const errorEl = document.getElementById('error');
function showError(message) {
  errorEl.textContent = message;
  errorEl.style.display = message ? 'block' : 'none';
}

const actionOverlay = document.getElementById('actionOverlay');
const actionPlanNameEl = document.getElementById('actionPlanName');
const actionStartBtn = document.getElementById('actionStartBtn');
const actionResultsBtn = document.getElementById('actionResultsBtn');
const actionEditBtn = document.getElementById('actionEditBtn');
const actionDownloadBtn = document.getElementById('actionDownloadBtn');
const actionDeleteBtn = document.getElementById('actionDeleteBtn');
const actionBackBtn = document.getElementById('actionBackBtn');
let selectedTestFile = null;

function openActionPanel(test, color) {
  selectedTestFile = test.file;
  actionPlanNameEl.textContent = test.name;
  const panel = actionOverlay.querySelector('.action-panel');
  panel.style.setProperty('--pack-color', color || '#2f6fed');
  actionOverlay.style.display = 'flex';
  panel.classList.remove('flip-in');
  panel.style.opacity = '';
  panel.style.transform = '';
  void panel.offsetWidth;
  panel.classList.add('flip-in');
  // Safety net: guarantee the panel ends up fully visible even if the CSS
  // animation never completes (e.g. a throttled/backgrounded window).
  clearTimeout(panel._flipInFallbackTimer);
  panel._flipInFallbackTimer = setTimeout(() => {
    panel.classList.remove('flip-in');
    panel.style.opacity = '1';
    panel.style.transform = 'none';
  }, 600);
}
function closeActionPanel() {
  actionOverlay.style.display = 'none';
  selectedTestFile = null;
}
actionOverlay.addEventListener('click', (e) => { if (e.target === actionOverlay) closeActionPanel(); });
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
  if (selectedTestFile) window.api.openResults(selectedTestFile);
});
actionEditBtn.addEventListener('click', () => {
  if (selectedTestFile) window.api.openEditor(selectedTestFile);
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
  await loadAndBuild();
});

const textPromptOverlay = document.getElementById('textPromptOverlay');
const textPromptTitle = document.getElementById('textPromptTitle');
const textPromptInput = document.getElementById('textPromptInput');
const textPromptOkBtn = document.getElementById('textPromptOkBtn');
const textPromptCancelBtn = document.getElementById('textPromptCancelBtn');
let textPromptResolve = null;

function promptForText(title, defaultValue) {
  return new Promise((resolve) => {
    textPromptResolve = resolve;
    textPromptTitle.textContent = title;
    textPromptInput.value = defaultValue || '';
    textPromptOverlay.style.display = 'flex';
    requestAnimationFrame(() => { textPromptInput.focus(); textPromptInput.select(); });
  });
}
function closeTextPrompt(result) {
  textPromptOverlay.style.display = 'none';
  if (textPromptResolve) {
    const resolve = textPromptResolve;
    textPromptResolve = null;
    resolve(result);
  }
}
textPromptOkBtn.addEventListener('click', () => closeTextPrompt(textPromptInput.value));
textPromptCancelBtn.addEventListener('click', () => closeTextPrompt(null));
textPromptInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') closeTextPrompt(textPromptInput.value);
  if (e.key === 'Escape') closeTextPrompt(null);
});
textPromptOverlay.addEventListener('click', (e) => { if (e.target === textPromptOverlay) closeTextPrompt(null); });

// ================================================================
// Project/test-plan actions (mirror the 2D app's flows)
// ================================================================
async function createProjectFlow() {
  const name = await promptForText('New project name:');
  if (!name || !name.trim()) return;
  showError('');
  try {
    await window.api.createProject(name.trim());
    await loadAndBuild();
  } catch (err) {
    showError(err.message || String(err));
  }
}

async function renameProjectFlow(project) {
  const newName = await promptForText('Rename project:', project.name);
  if (!newName || !newName.trim() || newName.trim() === project.name) return;
  showError('');
  try {
    await window.api.renameProject(project.id, newName.trim());
    await loadAndBuild();
  } catch (err) {
    showError(err.message || String(err));
  }
}

async function deleteProjectFlow(project) {
  showError('');
  try {
    const tests = currentTestsByProject.get(project.id) || [];
    const warning = tests.length > 0
      ? `Delete "${project.name}" and permanently remove its ${tests.length} test plan${tests.length === 1 ? '' : 's'} (including all run history)? This cannot be undone.`
      : `Delete "${project.name}"? This cannot be undone.`;
    if (!window.confirm(warning)) return;
    await window.api.deleteProject(project.id);
    await loadAndBuild();
  } catch (err) {
    showError(err.message || String(err));
  }
}

async function addTestPlanFlow(project) {
  showError('');
  try {
    const mode = await window.api.chooseAddTestPlanMode();
    if (mode === 'blank') {
      const name = await promptForText('New test plan name:');
      if (!name || !name.trim()) return;
      const created = await window.api.createBlankTestPlan(name.trim(), project.id);
      await loadAndBuild();
      window.api.openEditor(created.file);
    } else if (mode === 'import') {
      const uploaded = await window.api.uploadSmokeTest(project.id);
      if (uploaded) await loadAndBuild();
    }
  } catch (err) {
    showError(err.message || String(err));
  }
}

// ================================================================
// Fixed dimensions (units match the spec given for the cabinet parts)
// ================================================================
const BODY_WIDTH = 700;
const BODY_DEPTH = 200;
const INDENT_MARGIN_X = 50;
const INDENT_DEPTH = 50;
const HEADER_SPACE = 260; // room above the cavity for the logo
const FOOTER_SPACE = 150; // room below the cavity

const SHELF_WIDTH = 600;
const SHELF_DEPTH = 40;
const SHELF_HEIGHT = 10;

const PACK_HEIGHT = 100;
const PACK_WIDTH_DEFAULT = 60;
const PACK_MIN_WIDTH = 30;
const PACK_DEPTH = 20;

const COVER_WIDTH = 600;
const COVER_HEIGHT = 150;
const COVER_DEPTH = 10;

const ROW_GAP = 6;
const ROW_PITCH = COVER_HEIGHT + ROW_GAP;
const OPEN_ANGLE = 110 * (Math.PI / 180); // positive: hinge at the bottom, swings up and out
const SWING_DURATION_MS = 650;

const CHEVRON_WIDTH = 50;
const CHEVRON_HEIGHT = 100;
const CHEVRON_DEPTH = 20;
const SIDE_GAP = 30;
const SIDE_GAP_2 = 20;
const ICON_BUTTON_SIZE = 70;

const PACK_COMFORTABLE_MIN = 40; // below this, stop shrinking and switch to scrolling instead
const SCROLL_STEP = SHELF_WIDTH * 0.6;
const SCROLL_DURATION_MS = 400;

const PROP_GAP = 100; // clearance between the side buttons and the decorative props
const TRASH_RADIUS_TOP = 90;
const TRASH_RADIUS_BOTTOM = 76;
const TRASH_HEIGHT = 220;
const BOX_SIZE = 140;
const BOX_HEIGHT = 120;

const PACK_COLORS = ['#2f6fed', '#e0393e', '#2fae5c', '#a04fd6', '#e08a1e', '#1eb8b0', '#d6417a'];

const halfW = BODY_WIDTH / 2;
const halfD = BODY_DEPTH / 2;
const cavityLeft = -halfW + INDENT_MARGIN_X;
const cavityRight = halfW - INDENT_MARGIN_X;
const cavityFrontZ = halfD;
const cavityBackZ = halfD - INDENT_DEPTH;

// ================================================================
// Renderer / scene / camera (created once)
// ================================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1c1c1e);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 20000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
keyLight.position.set(600, 900, 1200);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xffffff, 0.35);
fillLight.position.set(-800, 200, -600);
scene.add(fillLight);

// ---- Editable texture files (src/textures/*.png) — one per element ----
renderer.localClippingEnabled = true;
const textureLoader = new THREE.TextureLoader();
function loadTexture(file) {
  const texture = textureLoader.load(`textures/${file}`);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
const TEX = {
  body: loadTexture('cabinet-body.png'),
  shelf: loadTexture('shelf.png'),
  cover: loadTexture('cover.png'),
  coverAddProject: loadTexture('cover-add-project.png'),
  pack: loadTexture('pack.png'), // near-white/neutral — tinted per pack via material.color
  packAdd: loadTexture('pack-add.png'),
  chevron: loadTexture('chevron.png'),
  buttonEdit: loadTexture('button-edit.png'),
  buttonDelete: loadTexture('button-delete.png'),
  trashCan: loadTexture('trash-can.png'),
  cardboardBox: loadTexture('cardboard-box.png'),
};

// Clips anything outside a shelf's own width — lets packs scroll "through" the shelf edges.
const PACK_CLIP_PLANES = [
  new THREE.Plane(new THREE.Vector3(1, 0, 0), SHELF_WIDTH / 2),
  new THREE.Plane(new THREE.Vector3(-1, 0, 0), SHELF_WIDTH / 2),
];

const bodyMaterial = new THREE.MeshStandardMaterial({ map: TEX.body, roughness: 0.8, metalness: 0.1 });
const shelfMaterial = new THREE.MeshStandardMaterial({ map: TEX.shelf, roughness: 0.6 });
const coverMaterial = new THREE.MeshStandardMaterial({ map: TEX.cover, roughness: 0.5 });
const chevronMaterial = new THREE.MeshStandardMaterial({ map: TEX.chevron, roughness: 0.5 });
const addProjectMaterial = new THREE.MeshStandardMaterial({ map: TEX.coverAddProject, roughness: 0.6 });
const addPackMaterial = new THREE.MeshStandardMaterial({ map: TEX.packAdd, roughness: 0.5, clippingPlanes: PACK_CLIP_PLANES });
const editMaterial = new THREE.MeshStandardMaterial({ map: TEX.buttonEdit, roughness: 0.5 });
const deleteMaterial = new THREE.MeshStandardMaterial({ map: TEX.buttonDelete, roughness: 0.5 });
const trashCanMaterial = new THREE.MeshStandardMaterial({ map: TEX.trashCan, roughness: 0.6, metalness: 0.2 });
const cardboardBoxMaterial = new THREE.MeshStandardMaterial({ map: TEX.cardboardBox, roughness: 0.9 });

const contentGroup = new THREE.Group();
scene.add(contentGroup);

function disposeObject(obj) {
  const children = obj.children ? obj.children.slice() : [];
  for (const child of children) disposeObject(child);
  if (obj.geometry) obj.geometry.dispose();
  // Shared/loaded textures and module-level materials are reused across rebuilds by
  // reference (three.js lazily re-initializes GPU resources on next use), so disposing
  // them here on every rebuild is safe even though they aren't newly created each time.
  if (obj.material) {
    if (obj.material.map) obj.material.map.dispose();
    obj.material.dispose();
  }
}

function clearGroup(group) {
  while (group.children.length) {
    disposeObject(group.children.pop());
  }
}

function addBox(width, height, depth, material, x, y, z, parent = contentGroup) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

// ---- Canvas-texture helpers (logo + icon glyphs) ----
function createCanvasTexture(drawFn, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  drawFn(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createLogoTexture() {
  return createCanvasTexture((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.font = 'italic bold 100px Georgia, "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#59e816';
    ctx.shadowBlur = 40;
    ctx.fillStyle = '#59e816';
    ctx.fillText('SMOKER', w / 2, h / 2);
    ctx.fillText('SMOKER', w / 2, h / 2);
  }, 900, 220);
}

function createLabelTexture(text) {
  return createCanvasTexture((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.font = 'bold 44px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1c1c1e';
    const words = text.split(' ');
    if (words.length > 1 && text.length > 12) {
      ctx.fillText(words.slice(0, Math.ceil(words.length / 2)).join(' '), w / 2, h / 2 - 26);
      ctx.fillText(words.slice(Math.ceil(words.length / 2)).join(' '), w / 2, h / 2 + 26);
    } else {
      ctx.fillText(text, w / 2, h / 2);
    }
  }, 512, 200);
}

function addPlane(width, height, texture, x, y, z, parent = contentGroup, clippingPlanes) {
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  if (clippingPlanes) material.clippingPlanes = clippingPlanes;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function addChevron(pointsLeft, x, y, z) {
  const shape = new THREE.Shape();
  const halfCw = CHEVRON_WIDTH / 2;
  const halfCh = CHEVRON_HEIGHT / 2;
  if (pointsLeft) {
    shape.moveTo(-halfCw, 0);
    shape.lineTo(halfCw, halfCh);
    shape.lineTo(halfCw, -halfCh);
  } else {
    shape.moveTo(halfCw, 0);
    shape.lineTo(-halfCw, halfCh);
    shape.lineTo(-halfCw, -halfCh);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: CHEVRON_DEPTH, bevelEnabled: false });
  geometry.translate(0, 0, -CHEVRON_DEPTH / 2);
  const mesh = new THREE.Mesh(geometry, chevronMaterial);
  mesh.position.set(x, y, z);
  contentGroup.add(mesh);
  return mesh;
}

function addIconButton(material, x, y, z) {
  return addBox(ICON_BUTTON_SIZE, ICON_BUTTON_SIZE, CHEVRON_DEPTH, material, x, y, z);
}

// ================================================================
// Data + scene building
// ================================================================
let currentProjects = [];
let currentTestsByProject = new Map();
let cameraInitialized = false;

let swingingCovers = []; // { group, mesh, isOpen, animStart, animFrom, animTo }
let scrollingRows = []; // { group, min, max, target, animFrom, animStart }
let interactables = []; // { mesh, onClick }
let pulseables = []; // { mesh, scale }
let openCoverEntry = null;

async function loadAndBuild() {
  try {
    const [projects, tests] = await Promise.all([window.api.listProjects(), window.api.listSmokeTests()]);
    currentProjects = projects;
    currentTestsByProject = new Map(projects.map((p) => [p.id, tests.filter((t) => t.projectId === p.id)]));
    buildScene();
  } catch (err) {
    showError(err.message || String(err));
  }
}

function layoutPacks(count) {
  let packWidth = PACK_WIDTH_DEFAULT;
  const maxUsable = SHELF_WIDTH * 0.92;
  if (count * packWidth > maxUsable) {
    packWidth = maxUsable / count;
  }
  if (packWidth < PACK_COMFORTABLE_MIN) {
    // Too many packs to shrink-to-fit comfortably — hold a readable fixed width
    // and let the shelf scroll (via the side chevrons) instead of shrinking further.
    const fixedWidth = PACK_COMFORTABLE_MIN;
    const gap = fixedWidth * 0.3;
    return { packWidth: fixedWidth, gap, scrollable: true };
  }
  const gap = (SHELF_WIDTH - count * packWidth) / (count + 1);
  return { packWidth, gap, scrollable: false };
}

function scrollRow(entry, delta) {
  entry.animFrom = entry.group.position.x;
  entry.target = Math.min(entry.max, Math.max(entry.min, entry.target + delta));
  entry.animStart = performance.now();
}

function buildScene() {
  clearGroup(contentGroup);
  swingingCovers = [];
  scrollingRows = [];
  interactables = [];
  pulseables = [];
  openCoverEntry = null;

  const rowCount = currentProjects.length + 1; // +1 for the trailing "add project" row
  const cavityHeight = rowCount * ROW_PITCH - ROW_GAP;
  const bodyHeight = HEADER_SPACE + cavityHeight + FOOTER_SPACE;
  const halfH = bodyHeight / 2;
  const cavityBottom = -halfH + FOOTER_SPACE;
  const cavityTop = cavityBottom + cavityHeight;

  // ---- Main body: back block + 4 front frame strips around the cavity opening ----
  const backBlockDepth = cavityBackZ - -halfD;
  addBox(BODY_WIDTH, bodyHeight, backBlockDepth, bodyMaterial, 0, 0, -halfD + backBlockDepth / 2);

  const frameDepth = cavityFrontZ - cavityBackZ;
  const frameCenterZ = (cavityBackZ + cavityFrontZ) / 2;
  addBox(BODY_WIDTH, halfH - cavityTop, frameDepth, bodyMaterial, 0, (cavityTop + halfH) / 2, frameCenterZ);
  addBox(BODY_WIDTH, cavityBottom - -halfH, frameDepth, bodyMaterial, 0, (-halfH + cavityBottom) / 2, frameCenterZ);
  addBox(cavityLeft - -halfW, cavityTop - cavityBottom, frameDepth, bodyMaterial, (-halfW + cavityLeft) / 2, (cavityTop + cavityBottom) / 2, frameCenterZ);
  addBox(halfW - cavityRight, cavityTop - cavityBottom, frameDepth, bodyMaterial, (cavityRight + halfW) / 2, (cavityTop + cavityBottom) / 2, frameCenterZ);

  // ---- Logo above the topmost cover ----
  addPlane(500, 122, createLogoTexture(), 0, (cavityTop + halfH) / 2, cavityFrontZ + 1);

  // ---- One row per project ----
  currentProjects.forEach((project, row) => {
    buildRow(row, cavityBottom, project, currentTestsByProject.get(project.id) || []);
  });

  // ---- Trailing "add project" row ----
  buildAddProjectRow(currentProjects.length, cavityBottom);

  // ---- Decorative props: trash can (right), stacked cardboard boxes (left) ----
  buildProps(halfH);

  // ---- Camera: only positioned on the very first build, so edits don't reset the user's view ----
  if (!cameraInitialized) {
    const distance = Math.max(1800, bodyHeight * 1.3);
    camera.position.set(BODY_WIDTH, 150, distance);
    controls.target.set(0, 0, 0);
    controls.update();
    cameraInitialized = true;
  }
}

function buildRow(row, cavityBottom, project, tests) {
  const rowBottom = cavityBottom + row * ROW_PITCH;
  const rowCenterY = rowBottom + COVER_HEIGHT / 2;
  const shelfCenterZ = cavityBackZ + INDENT_DEPTH / 2;

  addBox(SHELF_WIDTH, SHELF_HEIGHT, SHELF_DEPTH, shelfMaterial, 0, rowBottom + SHELF_HEIGHT / 2, shelfCenterZ);

  const packCount = tests.length + 1; // +1 for the trailing "add test plan" pack
  const { packWidth, gap, scrollable } = layoutPacks(packCount);
  const packCenterY = rowBottom + SHELF_HEIGHT + PACK_HEIGHT / 2;

  const packGroup = new THREE.Group();
  contentGroup.add(packGroup);

  for (let i = 0; i < packCount; i++) {
    const leftEdge = -SHELF_WIDTH / 2 + gap * (i + 1) + packWidth * i;
    const centerX = leftEdge + packWidth / 2;
    const isAddPack = i === tests.length;
    const material = isAddPack
      ? addPackMaterial
      : new THREE.MeshStandardMaterial({ color: PACK_COLORS[i % PACK_COLORS.length], map: TEX.pack, roughness: 0.4, clippingPlanes: PACK_CLIP_PLANES });
    const packMesh = addBox(packWidth, PACK_HEIGHT, PACK_DEPTH, material, centerX, packCenterY, shelfCenterZ, packGroup);

    if (isAddPack) {
      const plusTexture = createLabelTexture('+ Add Test Plan');
      addPlane(packWidth * 0.9, packWidth * 0.9 * (200 / 512), plusTexture, centerX, packCenterY, shelfCenterZ + PACK_DEPTH / 2 + 1, packGroup, PACK_CLIP_PLANES);
      interactables.push({ mesh: packMesh, onClick: () => addTestPlanFlow(project) });
    } else {
      const test = tests[i];
      const labelTexture = createLabelTexture(test.name);
      addPlane(packWidth * 0.9, packWidth * 0.9 * (200 / 512), labelTexture, centerX, packCenterY, shelfCenterZ + PACK_DEPTH / 2 + 1, packGroup, PACK_CLIP_PLANES);
      const color = PACK_COLORS[i % PACK_COLORS.length];
      interactables.push({ mesh: packMesh, onClick: () => openActionPanel(test, color) });
    }
  }

  // How far the pack row overflows the shelf's own width — the scroll range.
  const contentWidth = gap * (packCount + 1) + packWidth * packCount;
  const overflow = Math.max(0, contentWidth - SHELF_WIDTH);
  const scrollEntry = { group: packGroup, min: -overflow, max: 0, target: 0, animFrom: 0, animStart: 0 };
  scrollingRows.push(scrollEntry);
  const needsScroll = scrollable && overflow > 0;

  // Cover: hinged at its bottom edge, swings up and forward when opened
  const coverClosedCenterZ = cavityFrontZ - COVER_DEPTH / 2;
  const hinge = new THREE.Group();
  hinge.position.set(0, rowBottom, coverClosedCenterZ);
  contentGroup.add(hinge);
  const coverMesh = new THREE.Mesh(new THREE.BoxGeometry(COVER_WIDTH, COVER_HEIGHT, COVER_DEPTH), coverMaterial);
  coverMesh.position.set(0, COVER_HEIGHT / 2, 0);
  hinge.add(coverMesh);
  const coverLabel = createLabelTexture(project.name);
  addPlane(COVER_WIDTH * 0.6, COVER_WIDTH * 0.6 * (200 / 512), coverLabel, 0, COVER_HEIGHT / 2, COVER_DEPTH / 2 + 1, hinge);

  const coverEntry = { group: hinge, mesh: coverMesh, isOpen: false, animStart: 0, animFrom: 0, animTo: 0 };
  swingingCovers.push(coverEntry);
  interactables.push({ mesh: coverMesh, onClick: () => toggleCover(coverEntry) });

  // Side controls: chevrons flank the row, edit/delete sit further outward
  const sideZ = coverClosedCenterZ;
  const leftChevronX = -(halfW + SIDE_GAP + CHEVRON_WIDTH / 2);
  const rightChevronX = halfW + SIDE_GAP + CHEVRON_WIDTH / 2;
  const editX = -(halfW + SIDE_GAP + CHEVRON_WIDTH + SIDE_GAP_2 + ICON_BUTTON_SIZE / 2);
  const deleteX = halfW + SIDE_GAP + CHEVRON_WIDTH + SIDE_GAP_2 + ICON_BUTTON_SIZE / 2;

  const leftChevron = addChevron(true, leftChevronX, rowCenterY, sideZ);
  const rightChevron = addChevron(false, rightChevronX, rowCenterY, sideZ);
  leftChevron.visible = needsScroll;
  rightChevron.visible = needsScroll;
  const editBtn = addIconButton(editMaterial, editX, rowCenterY, sideZ);
  const deleteBtn = addIconButton(deleteMaterial, deleteX, rowCenterY, sideZ);

  if (needsScroll) {
    pulseables.push({ mesh: leftChevron, scale: 1 }, { mesh: rightChevron, scale: 1 });
    interactables.push({ mesh: leftChevron, onClick: () => { pulse(leftChevron); scrollRow(scrollEntry, SCROLL_STEP); } });
    interactables.push({ mesh: rightChevron, onClick: () => { pulse(rightChevron); scrollRow(scrollEntry, -SCROLL_STEP); } });
  }
  pulseables.push({ mesh: editBtn, scale: 1 }, { mesh: deleteBtn, scale: 1 });
  interactables.push({ mesh: editBtn, onClick: () => { pulse(editBtn); renameProjectFlow(project); } });
  interactables.push({ mesh: deleteBtn, onClick: () => { pulse(deleteBtn); deleteProjectFlow(project); } });
}

function buildProps(halfH) {
  const deleteEdgeX = halfW + SIDE_GAP + CHEVRON_WIDTH + SIDE_GAP_2 + ICON_BUTTON_SIZE;
  const editEdgeX = -deleteEdgeX;

  const trashX = deleteEdgeX + PROP_GAP + TRASH_RADIUS_TOP;
  const trashMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(TRASH_RADIUS_TOP, TRASH_RADIUS_BOTTOM, TRASH_HEIGHT, 24),
    trashCanMaterial
  );
  trashMesh.position.set(trashX, -halfH + TRASH_HEIGHT / 2, 0);
  contentGroup.add(trashMesh);

  const boxX = editEdgeX - PROP_GAP - BOX_SIZE / 2;
  const boxTilts = [-0.05, 0.04, -0.03];
  for (let i = 0; i < 3; i++) {
    const boxMesh = new THREE.Mesh(new THREE.BoxGeometry(BOX_SIZE, BOX_HEIGHT, BOX_SIZE), cardboardBoxMaterial);
    boxMesh.position.set(boxX, -halfH + BOX_HEIGHT * (i + 0.5), 0);
    boxMesh.rotation.y = boxTilts[i];
    contentGroup.add(boxMesh);
  }
}

function buildAddProjectRow(row, cavityBottom) {
  const rowBottom = cavityBottom + row * ROW_PITCH;
  const coverClosedCenterZ = cavityFrontZ - COVER_DEPTH / 2;
  const mesh = addBox(COVER_WIDTH, COVER_HEIGHT, COVER_DEPTH, addProjectMaterial, 0, rowBottom + COVER_HEIGHT / 2, coverClosedCenterZ);
  const label = createLabelTexture('+ Add New Project');
  addPlane(COVER_WIDTH * 0.6, COVER_WIDTH * 0.6 * (200 / 512), label, 0, rowBottom + COVER_HEIGHT / 2, coverClosedCenterZ + COVER_DEPTH / 2 + 1);
  interactables.push({ mesh, onClick: () => createProjectFlow() });
}

function toggleCover(coverEntry) {
  const now = performance.now();
  if (openCoverEntry && openCoverEntry !== coverEntry) {
    openCoverEntry.animFrom = openCoverEntry.group.rotation.x;
    openCoverEntry.isOpen = false;
    openCoverEntry.animTo = 0;
    openCoverEntry.animStart = now;
  }
  coverEntry.animFrom = coverEntry.group.rotation.x;
  coverEntry.isOpen = !coverEntry.isOpen;
  coverEntry.animTo = coverEntry.isOpen ? OPEN_ANGLE : 0;
  coverEntry.animStart = now;
  openCoverEntry = coverEntry.isOpen ? coverEntry : null;
}

function pulse(mesh) {
  const entry = pulseables.find((p) => p.mesh === mesh);
  if (entry) entry.scale = 1.25;
}

// ================================================================
// Click interaction
// ================================================================
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

renderer.domElement.addEventListener('click', (event) => {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const hit = raycaster.intersectObjects(interactables.map((e) => e.mesh));
  if (hit.length === 0) return;
  const entry = interactables.find((e) => e.mesh === hit[0].object);
  entry.onClick();
});

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ================================================================
// Render loop
// ================================================================
function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  for (const cover of swingingCovers) {
    if (cover.animStart === 0) continue;
    const t = Math.min(1, (now - cover.animStart) / SWING_DURATION_MS);
    cover.group.rotation.x = cover.animFrom + (cover.animTo - cover.animFrom) * easeInOutCubic(t);
    if (t >= 1) cover.animStart = 0;
  }

  for (const row of scrollingRows) {
    if (row.animStart === 0) continue;
    const t = Math.min(1, (now - row.animStart) / SCROLL_DURATION_MS);
    row.group.position.x = row.animFrom + (row.target - row.animFrom) * easeInOutCubic(t);
    if (t >= 1) row.animStart = 0;
  }

  for (const entry of pulseables) {
    if (entry.scale > 1) {
      entry.scale = Math.max(1, entry.scale - 0.02);
      entry.mesh.scale.setScalar(entry.scale);
    }
  }

  controls.update();
  renderer.render(scene, camera);
}
animate();

window.addEventListener('focus', loadAndBuild);
loadAndBuild();
