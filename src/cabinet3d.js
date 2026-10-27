import * as THREE from 'three';

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
    const res = await window.api.startRun(selectedTestFile);
    if (!res.cancelled) closeActionPanel();
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

const settingsBtn = document.getElementById('settingsBtn');
const settingsOverlay = document.getElementById('settingsOverlay');
const settingsCurrentRoot = document.getElementById('settingsCurrentRoot');
const settingsChooseBtn = document.getElementById('settingsChooseBtn');
const settingsRevealBtn = document.getElementById('settingsRevealBtn');
const settingsResetBtn = document.getElementById('settingsResetBtn');
const settingsCancelBtn = document.getElementById('settingsCancelBtn');
let currentDataRoot = null;

async function openSettingsPanel() {
  showError('');
  try {
    const { dataRoot, isShared } = await window.api.getDataRoot();
    currentDataRoot = dataRoot;
    settingsCurrentRoot.innerHTML = `<span class="settings-badge ${isShared ? 'shared' : 'local'}">${isShared ? 'SHARED' : 'LOCAL ONLY'}</span><br>${dataRoot}`;
    settingsResetBtn.style.display = isShared ? '' : 'none';
    settingsOverlay.style.display = 'flex';
  } catch (err) {
    showError(err.message || String(err));
  }
}
function closeSettingsPanel() {
  settingsOverlay.style.display = 'none';
}
settingsBtn.addEventListener('click', openSettingsPanel);
settingsCancelBtn.addEventListener('click', closeSettingsPanel);
settingsOverlay.addEventListener('click', (e) => { if (e.target === settingsOverlay) closeSettingsPanel(); });
settingsRevealBtn.addEventListener('click', () => {
  if (currentDataRoot) window.api.openPath(currentDataRoot);
});
settingsChooseBtn.addEventListener('click', async () => {
  showError('');
  try {
    const result = await window.api.chooseSharedDataRoot();
    if (result) {
      settingsCurrentRoot.innerHTML = `<span class="settings-badge shared">SHARED</span><br>Restarting…`;
    }
  } catch (err) {
    showError(err.message || String(err));
  }
});
settingsResetBtn.addEventListener('click', async () => {
  if (!window.confirm('Switch back to this Mac\'s local (non-shared) data folder? The app will restart.')) return;
  showError('');
  try {
    await window.api.resetDataRoot();
    settingsCurrentRoot.innerHTML = `<span class="settings-badge local">LOCAL ONLY</span><br>Restarting…`;
  } catch (err) {
    showError(err.message || String(err));
  }
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
async function createProjectFlow(slotIndex) {
  const name = await promptForText('New project name:');
  if (!name || !name.trim()) return;
  showError('');
  try {
    await window.api.createProject(name.trim(), slotIndex);
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
const PACK_DEPTH = 40;

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
// Both icon buttons sit left of the cabinet: edit next to the chevron, delete further out.
const EDIT_BUTTON_X = -(BODY_WIDTH / 2 + SIDE_GAP + CHEVRON_WIDTH + SIDE_GAP_2 + ICON_BUTTON_SIZE / 2);
const DELETE_BUTTON_X = EDIT_BUTTON_X - ICON_BUTTON_SIZE - SIDE_GAP_2;

const MAX_PACKS_VISIBLE = 10; // packs shown at once before a shelf switches to scrolling
const SCROLL_STEP = SHELF_WIDTH * 0.6;
const SCROLL_DURATION_MS = 400;

const PROP_GAP = 100; // clearance between the side buttons and the decorative props
const TRASH_RADIUS_TOP = 135;
const TRASH_RADIUS_BOTTOM = 114;
const TRASH_HEIGHT = 330;
const TRASH_RADIAL_SEGMENTS = 24;
// Stacked bottom to top. yaw = rotation around the vertical axis; negative turns the front face left.
const BOXES = [
  { size: 280, height: 240, yaw: -0.05 },
  { size: 280, height: 240, yaw: -20 * Math.PI / 180 },
  { size: 210, height: 180, yaw: -0.03 },
];

const WALL_WIDTH = 2200;
const WALL_HEIGHT = 1700;
const WALL_DEPTH = 30;
const WALL_GAP = 20; // gap between the cabinet's back face and the wall

const SIDEWALK_WIDTH = 2200;
const SIDEWALK_DEPTH = 420; // shallow enough that the road shows at the bottom of the default view
const SIDEWALK_THICKNESS = 24;

const CURB_HEIGHT = 30;
const CURB_DEPTH = 20;

const ROAD_WIDTH = 2200;
const ROAD_DEPTH = 1200;
const ROAD_THICKNESS = 20;

const CAMERA_ZOOM_DISTANCE = 900; // how far from a shelf the camera sits once zoomed in
const CAMERA_ZOOM_DURATION_MS = 700;

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

// The scene is mostly static (a menu you look at and occasionally click), so the render loop
// only actually draws a frame when something changed or is mid-animation, instead of forcing a
// GPU render 60 times a second forever. Anything that changes what's on screen outside of the
// per-frame animation updates (a rebuild, a resize) must set this back to true.
let needsRender = true;

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  needsRender = true;
});

scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const keyLight = new THREE.DirectionalLight(0xffffff, 0.6);
keyLight.position.set(600, 900, 1200);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xffffff, 0.25);
fillLight.position.set(-800, 200, -600);
scene.add(fillLight);

// ---- Editable texture files (src/textures/*.png) — one per element ----
renderer.localClippingEnabled = true;
// The first build waits for every texture: 'cover' fitting needs each image's size, and drawing
// before they arrive leaves the scene dark until the next click triggers a render.
const textureLoadingManager = new THREE.LoadingManager();
const texturesReady = new Promise((resolve) => { textureLoadingManager.onLoad = resolve; });
const textureLoader = new THREE.TextureLoader(textureLoadingManager);
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
  wall: loadTexture('wall.png'),
  wallLeft: loadTexture('wall-left.png'),
  sidewalk: loadTexture('sidewalk.png'),
  road: loadTexture('road.png'),
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
const wallMaterial = new THREE.MeshStandardMaterial({ map: TEX.wall, roughness: 0.9 });
const wallLeftMaterial = new THREE.MeshStandardMaterial({ map: TEX.wallLeft, roughness: 0.9 });
const sidewalkMaterial = new THREE.MeshStandardMaterial({ map: TEX.sidewalk, roughness: 0.85 });
const roadMaterial = new THREE.MeshStandardMaterial({ map: TEX.road, roughness: 0.75 });

// ---- Texture fitting ----
// 'repeat' surfaces tile their image at a fixed world size, so big objects repeat it instead of
// stretching it. 'cover' objects show the image once per face, cropped to the face's shape.
const TILE_SIZE = { body: 400, shelf: 300, wall: 600, sidewalk: 300, road: 400, trashCan: 300 };

function useRepeat(material, tileSize) {
  material.map.wrapS = THREE.RepeatWrapping;
  material.map.wrapT = THREE.RepeatWrapping;
  material.userData.fit = { mode: 'repeat', tileSize };
}

function useCover(material) {
  material.userData.fit = { mode: 'cover' };
}

useRepeat(bodyMaterial, TILE_SIZE.body);
useRepeat(shelfMaterial, TILE_SIZE.shelf);
useRepeat(wallMaterial, TILE_SIZE.wall);
useRepeat(wallLeftMaterial, TILE_SIZE.wall);
useRepeat(sidewalkMaterial, TILE_SIZE.sidewalk);
useRepeat(roadMaterial, TILE_SIZE.road);
useRepeat(trashCanMaterial, TILE_SIZE.trashCan);
[coverMaterial, chevronMaterial, addProjectMaterial, addPackMaterial, editMaterial, deleteMaterial, cardboardBoxMaterial].forEach(useCover);

function faceUVTransform(fit, map, faceWidth, faceHeight) {
  if (fit.mode === 'repeat') {
    return { su: faceWidth / fit.tileSize, sv: faceHeight / fit.tileSize, ou: 0, ov: 0 };
  }
  const imageAspect = map.image && map.image.width ? map.image.width / map.image.height : 1;
  const faceAspect = faceWidth / faceHeight;
  if (faceAspect > imageAspect) {
    const sv = imageAspect / faceAspect;
    return { su: 1, sv, ou: 0, ov: (1 - sv) / 2 };
  }
  const su = faceAspect / imageAspect;
  return { su, sv: 1, ou: (1 - su) / 2, ov: 0 };
}

function transformUVs(uv, start, count, { su, sv, ou, ov }) {
  for (let i = start; i < start + count; i++) {
    uv.setXY(i, uv.getX(i) * su + ou, uv.getY(i) * sv + ov);
  }
  uv.needsUpdate = true;
}

// BoxGeometry stores 4 UVs per face, in the order +x, -x, +y, -y, +z, -z.
function createBoxGeometry(width, height, depth, material) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const fit = material.userData.fit;
  if (!fit) return geometry;
  const faceSizes = [[depth, height], [depth, height], [width, depth], [width, depth], [width, height], [width, height]];
  faceSizes.forEach(([faceWidth, faceHeight], face) => {
    transformUVs(geometry.attributes.uv, face * 4, 4, faceUVTransform(fit, material.map, faceWidth, faceHeight));
  });
  return geometry;
}

// One shared material per pack color, reused across every shelf and every rebuild — avoids
// allocating a new MeshStandardMaterial (and GPU program) per pack on every data change.
const packMaterialsByColor = PACK_COLORS.map(
  (color) => new THREE.MeshStandardMaterial({ color, map: TEX.pack, roughness: 0.4, clippingPlanes: PACK_CLIP_PLANES })
);
packMaterialsByColor.forEach(useCover);

const contentGroup = new THREE.Group();
scene.add(contentGroup);

function disposeObject(obj) {
  const children = obj.children ? obj.children.slice() : [];
  for (const child of children) disposeObject(child);
  if (obj.geometry) obj.geometry.dispose();
  // Only planes (labels/logo) get a fresh CanvasTexture-backed material every rebuild — every
  // other mesh uses one of the shared, module-level materials above and must not be disposed,
  // or the next rebuild would render it with a torn-down GPU texture/program.
  if (obj.material && obj.geometry?.type === 'PlaneGeometry') {
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
  const mesh = new THREE.Mesh(createBoxGeometry(width, height, depth, material), material);
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
  // ExtrudeGeometry UVs are raw shape coordinates; map the chevron's bounds onto the image first.
  const uv = geometry.attributes.uv;
  transformUVs(uv, 0, uv.count, { su: 1 / CHEVRON_WIDTH, sv: 1 / CHEVRON_HEIGHT, ou: 0.5, ov: 0.5 });
  transformUVs(uv, 0, uv.count, faceUVTransform(chevronMaterial.userData.fit, chevronMaterial.map, CHEVRON_WIDTH, CHEVRON_HEIGHT));
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
let currentProjects = []; // slot array: a project { id, name } or null for an empty/"Add Project" slot
let currentTestsByProject = new Map();
let cameraInitialized = false;
let defaultCameraPos = null;
let defaultCameraTarget = null;
let currentCameraTarget = new THREE.Vector3(0, 0, 0);
let cameraAnim = null; // { fromPos, toPos, fromTarget, toTarget, animStart }

let swingingCovers = []; // { group, mesh, isOpen, animStart, animFrom, animTo }
let scrollingRows = []; // { group, min, max, target, animFrom, animStart }
let interactables = []; // { mesh, onClick }
let pulseables = []; // { mesh, scale }
let openCoverEntry = null;

async function loadAndBuild() {
  try {
    const [projects, tests] = await Promise.all([window.api.listProjects(), window.api.listSmokeTests(), texturesReady]);
    currentProjects = projects;
    currentTestsByProject = new Map(
      projects.filter(Boolean).map((p) => [p.id, tests.filter((t) => t.projectId === p.id)])
    );
    buildScene();
  } catch (err) {
    showError(err.message || String(err));
  }
}

function layoutPacks(count) {
  if (count <= MAX_PACKS_VISIBLE) {
    let packWidth = PACK_WIDTH_DEFAULT;
    const maxUsable = SHELF_WIDTH * 0.92;
    if (count * packWidth > maxUsable) packWidth = maxUsable / count;
    const gap = (SHELF_WIDTH - count * packWidth) / (count + 1);
    return { packWidth, gap, scrollable: false };
  }
  // More packs than fit comfortably — hold a fixed width sized so exactly
  // MAX_PACKS_VISIBLE show at once, and scroll (via the side chevrons) for the rest.
  const packWidth = (SHELF_WIDTH * 0.92) / MAX_PACKS_VISIBLE;
  const gap = packWidth * 0.3;
  return { packWidth, gap, scrollable: true };
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

  // Slot count is fixed once seeded — it never shrinks (a deleted project's slot becomes an
  // empty "Add Project" slot instead of being removed) and never grows automatically either
  // (filling the last empty slot just disables further adds until one frees up again).
  const rowCount = Math.max(1, currentProjects.length);
  const cavityHeight = rowCount * ROW_PITCH - ROW_GAP;
  const bodyHeight = HEADER_SPACE + cavityHeight + FOOTER_SPACE;
  const halfH = bodyHeight / 2;
  const cavityBottom = -halfH + FOOTER_SPACE;
  const cavityTop = cavityBottom + cavityHeight;

  // ---- Street scene backdrop: wall, sidewalk + curb, road ----
  buildStreetScene(halfH);

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

  // ---- One row per slot: a real project, or an empty "Add Project" slot ----
  currentProjects.forEach((slot, row) => {
    if (slot) {
      buildRow(row, cavityBottom, slot, currentTestsByProject.get(slot.id) || []);
    } else {
      buildAddProjectRow(row, cavityBottom);
    }
  });

  // ---- Decorative props: trash can (right), stacked cardboard boxes (left) ----
  buildProps(halfH);

  // ---- Camera: default position/target computed once (the cabinet's size is now fixed), then
  // reset to it on every build — rebuilds already reset every cover to closed, so the camera
  // returning to default alongside them is consistent, not just on an explicit close click.
  if (!cameraInitialized) {
    const distance = Math.max(1800, bodyHeight * 1.3);
    defaultCameraPos = new THREE.Vector3(BODY_WIDTH, 150, distance);
    defaultCameraTarget = new THREE.Vector3(0, 0, 0);
    cameraInitialized = true;
  }
  cameraAnim = null;
  camera.position.copy(defaultCameraPos);
  currentCameraTarget.copy(defaultCameraTarget);
  camera.lookAt(currentCameraTarget);
  needsRender = true;
}

function buildRow(row, cavityBottom, project, tests) {
  const rowBottom = cavityBottom + row * ROW_PITCH;
  const rowCenterY = rowBottom + COVER_HEIGHT / 2;
  const shelfCenterZ = cavityBackZ + INDENT_DEPTH / 2;
  // Packs stand against the cavity's back so their front stays behind the closed cover.
  const packCenterZ = cavityBackZ + PACK_DEPTH / 2;

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
    const material = isAddPack ? addPackMaterial : packMaterialsByColor[i % PACK_COLORS.length];
    const packMesh = addBox(packWidth, PACK_HEIGHT, PACK_DEPTH, material, centerX, packCenterY, packCenterZ, packGroup);

    if (isAddPack) {
      const plusTexture = createLabelTexture('+ Add Test Plan');
      addPlane(packWidth * 0.9, packWidth * 0.9 * (200 / 512), plusTexture, centerX, packCenterY, packCenterZ + PACK_DEPTH / 2 + 1, packGroup, PACK_CLIP_PLANES);
      interactables.push({ mesh: packMesh, onClick: () => addTestPlanFlow(project) });
    } else {
      const test = tests[i];
      const labelTexture = createLabelTexture(test.name);
      addPlane(packWidth * 0.9, packWidth * 0.9 * (200 / 512), labelTexture, centerX, packCenterY, packCenterZ + PACK_DEPTH / 2 + 1, packGroup, PACK_CLIP_PLANES);
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
  const coverMesh = new THREE.Mesh(createBoxGeometry(COVER_WIDTH, COVER_HEIGHT, COVER_DEPTH, coverMaterial), coverMaterial);
  coverMesh.position.set(0, COVER_HEIGHT / 2, 0);
  hinge.add(coverMesh);
  const coverLabel = createLabelTexture(project.name);
  addPlane(COVER_WIDTH * 0.6, COVER_WIDTH * 0.6 * (200 / 512), coverLabel, 0, COVER_HEIGHT / 2, COVER_DEPTH / 2 + 1, hinge);

  const coverEntry = {
    group: hinge,
    mesh: coverMesh,
    isOpen: false,
    animStart: 0,
    animFrom: 0,
    animTo: 0,
    focusPos: new THREE.Vector3(BODY_WIDTH * 0.35, rowCenterY, coverClosedCenterZ + CAMERA_ZOOM_DISTANCE),
    focusTarget: new THREE.Vector3(0, rowCenterY, coverClosedCenterZ),
  };
  swingingCovers.push(coverEntry);
  interactables.push({ mesh: coverMesh, onClick: () => toggleCover(coverEntry) });

  // Side controls: chevrons flank the row, edit/delete sit further out on the left
  const sideZ = coverClosedCenterZ;
  const leftChevronX = -(halfW + SIDE_GAP + CHEVRON_WIDTH / 2);
  const rightChevronX = halfW + SIDE_GAP + CHEVRON_WIDTH / 2;

  const leftChevron = addChevron(true, leftChevronX, rowCenterY, sideZ);
  const rightChevron = addChevron(false, rightChevronX, rowCenterY, sideZ);
  leftChevron.visible = needsScroll;
  rightChevron.visible = needsScroll;
  const editBtn = addIconButton(editMaterial, EDIT_BUTTON_X, rowCenterY, sideZ);
  const deleteBtn = addIconButton(deleteMaterial, DELETE_BUTTON_X, rowCenterY, sideZ);

  if (needsScroll) {
    pulseables.push({ mesh: leftChevron, scale: 1 }, { mesh: rightChevron, scale: 1 });
    interactables.push({ mesh: leftChevron, onClick: () => { pulse(leftChevron); scrollRow(scrollEntry, SCROLL_STEP); } });
    interactables.push({ mesh: rightChevron, onClick: () => { pulse(rightChevron); scrollRow(scrollEntry, -SCROLL_STEP); } });
  }
  pulseables.push({ mesh: editBtn, scale: 1 }, { mesh: deleteBtn, scale: 1 });
  interactables.push({ mesh: editBtn, onClick: () => { pulse(editBtn); renameProjectFlow(project); } });
  interactables.push({ mesh: deleteBtn, onClick: () => { pulse(deleteBtn); deleteProjectFlow(project); } });
}

function buildStreetScene(halfH) {
  // Wall: flat backdrop behind the cabinet, bottom flush with the sidewalk.
  const wallBackZ = -halfD - WALL_GAP - WALL_DEPTH / 2;
  addBox(WALL_WIDTH, WALL_HEIGHT, WALL_DEPTH, wallMaterial, 0, -halfH + WALL_HEIGHT / 2, wallBackZ);

  // Left wall: perpendicular to the back wall, along the sidewalk's left edge up to the curb.
  const leftWallLength = SIDEWALK_DEPTH + WALL_DEPTH;
  addBox(WALL_DEPTH, WALL_HEIGHT, leftWallLength, wallLeftMaterial, -SIDEWALK_WIDTH / 2 + WALL_DEPTH / 2, -halfH + WALL_HEIGHT / 2, wallBackZ - WALL_DEPTH / 2 + leftWallLength / 2);

  // Sidewalk: the ground plane everything else rests on (top surface at -halfH).
  const sidewalkBackZ = -halfD - WALL_GAP;
  const sidewalkFrontZ = sidewalkBackZ + SIDEWALK_DEPTH;
  addBox(SIDEWALK_WIDTH, SIDEWALK_THICKNESS, SIDEWALK_DEPTH, sidewalkMaterial, 0, -halfH - SIDEWALK_THICKNESS / 2, sidewalkBackZ + SIDEWALK_DEPTH / 2);

  // Curb: raised lip at the sidewalk's front edge, stepping down to road level.
  addBox(SIDEWALK_WIDTH, CURB_HEIGHT, CURB_DEPTH, sidewalkMaterial, 0, -halfH - CURB_HEIGHT / 2, sidewalkFrontZ + CURB_DEPTH / 2);

  // Road: one curb-height lower than the sidewalk, extending further toward the camera.
  const roadBackZ = sidewalkFrontZ + CURB_DEPTH;
  const roadTopY = -halfH - CURB_HEIGHT;
  addBox(ROAD_WIDTH, ROAD_THICKNESS, ROAD_DEPTH, roadMaterial, 0, roadTopY - ROAD_THICKNESS / 2, roadBackZ + ROAD_DEPTH / 2);
}

function buildProps(halfH) {
  // The trash can keeps the spot it had when the delete button sat on the right.
  const rightEdgeX = halfW + SIDE_GAP + CHEVRON_WIDTH + SIDE_GAP_2 + ICON_BUTTON_SIZE;
  const leftEdgeX = DELETE_BUTTON_X - ICON_BUTTON_SIZE / 2;

  const trashX = rightEdgeX + PROP_GAP + TRASH_RADIUS_TOP;
  const trashGeometry = new THREE.CylinderGeometry(TRASH_RADIUS_TOP, TRASH_RADIUS_BOTTOM, TRASH_HEIGHT, TRASH_RADIAL_SEGMENTS);
  // Tile only the side (the first (segments + 1) * 2 UVs); a whole number of repeats around
  // avoids a seam. The lid and bottom keep showing the image once.
  const repeatsAround = Math.max(1, Math.round((2 * Math.PI * TRASH_RADIUS_TOP) / TILE_SIZE.trashCan));
  transformUVs(trashGeometry.attributes.uv, 0, (TRASH_RADIAL_SEGMENTS + 1) * 2, { su: repeatsAround, sv: TRASH_HEIGHT / TILE_SIZE.trashCan, ou: 0, ov: 0 });
  const trashMesh = new THREE.Mesh(trashGeometry, trashCanMaterial);
  trashMesh.position.set(trashX, -halfH + TRASH_HEIGHT / 2, 0);
  contentGroup.add(trashMesh);

  const boxX = leftEdgeX - PROP_GAP - Math.max(...BOXES.map((b) => b.size)) / 2;
  let boxBottomY = -halfH;
  for (const box of BOXES) {
    const boxMesh = new THREE.Mesh(createBoxGeometry(box.size, box.height, box.size, cardboardBoxMaterial), cardboardBoxMaterial);
    boxMesh.position.set(boxX, boxBottomY + box.height / 2, 0);
    boxMesh.rotation.y = box.yaw;
    contentGroup.add(boxMesh);
    boxBottomY += box.height;
  }
}

function buildAddProjectRow(row, cavityBottom) {
  const rowBottom = cavityBottom + row * ROW_PITCH;
  const coverClosedCenterZ = cavityFrontZ - COVER_DEPTH / 2;
  const mesh = addBox(COVER_WIDTH, COVER_HEIGHT, COVER_DEPTH, addProjectMaterial, 0, rowBottom + COVER_HEIGHT / 2, coverClosedCenterZ);
  const label = createLabelTexture('+ Add New Project');
  addPlane(COVER_WIDTH * 0.6, COVER_WIDTH * 0.6 * (200 / 512), label, 0, rowBottom + COVER_HEIGHT / 2, coverClosedCenterZ + COVER_DEPTH / 2 + 1);
  interactables.push({ mesh, onClick: () => createProjectFlow(row) });
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

  const toPos = openCoverEntry ? openCoverEntry.focusPos : defaultCameraPos;
  const toTarget = openCoverEntry ? openCoverEntry.focusTarget : defaultCameraTarget;
  cameraAnim = {
    fromPos: camera.position.clone(),
    toPos: toPos.clone(),
    fromTarget: currentCameraTarget.clone(),
    toTarget: toTarget.clone(),
    animStart: now,
  };
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
  let animating = false;

  for (const cover of swingingCovers) {
    if (cover.animStart === 0) continue;
    animating = true;
    const t = Math.min(1, (now - cover.animStart) / SWING_DURATION_MS);
    cover.group.rotation.x = cover.animFrom + (cover.animTo - cover.animFrom) * easeInOutCubic(t);
    if (t >= 1) cover.animStart = 0;
  }

  for (const row of scrollingRows) {
    if (row.animStart === 0) continue;
    animating = true;
    const t = Math.min(1, (now - row.animStart) / SCROLL_DURATION_MS);
    row.group.position.x = row.animFrom + (row.target - row.animFrom) * easeInOutCubic(t);
    if (t >= 1) row.animStart = 0;
  }

  for (const entry of pulseables) {
    if (entry.scale > 1) {
      animating = true;
      entry.scale = Math.max(1, entry.scale - 0.02);
      entry.mesh.scale.setScalar(entry.scale);
    }
  }

  if (cameraAnim) {
    animating = true;
    const t = Math.min(1, (now - cameraAnim.animStart) / CAMERA_ZOOM_DURATION_MS);
    const eased = easeInOutCubic(t);
    camera.position.lerpVectors(cameraAnim.fromPos, cameraAnim.toPos, eased);
    currentCameraTarget.lerpVectors(cameraAnim.fromTarget, cameraAnim.toTarget, eased);
    if (t >= 1) cameraAnim = null;
  }

  // The scene is static outside of the animations above (or an explicit rebuild/resize) — skip
  // the render call entirely rather than redrawing an unchanged frame 60 times a second.
  if (!needsRender && !animating) return;
  needsRender = false;

  camera.lookAt(currentCameraTarget);
  renderer.render(scene, camera);
}
animate();

window.addEventListener('focus', loadAndBuild);
loadAndBuild();
