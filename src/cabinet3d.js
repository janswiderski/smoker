import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ---- Spec dimensions (all in arbitrary "units") ----
const BODY_WIDTH = 700;
const BODY_DEPTH = 200;
const BODY_HEIGHT = 1500;

const INDENT_MARGIN_X = 50; // cavity starts/ends this far from the left/right edges
const INDENT_BOTTOM_MARGIN = 400; // cavity ends this far from the bottom
const INDENT_DEPTH = 50; // how deep the cavity cuts in from the front face
// (there is no top margin input anymore: the cavity's top is derived below so it
// matches the covers stack exactly, with no leftover gap above the topmost cover)

const SHELF_WIDTH = 600;
const SHELF_DEPTH = 40;
const SHELF_HEIGHT = 10;

const PACK_HEIGHT = 100;
const PACK_WIDTH = 60;
const PACK_DEPTH = 20;

const COVER_WIDTH = 600;
const COVER_HEIGHT = 150;
const COVER_DEPTH = 10;

const SHELF_COUNT = 5;
const PACKS_PER_SHELF = 6;
const ROW_GAP = 6; // small visual seam between rows so covers don't render as one seamless panel
const ROW_PITCH = COVER_HEIGHT + ROW_GAP; // vertical spacing from one row's bottom to the next
const OPEN_ANGLE = 110 * (Math.PI / 180); // positive: hinge at the BOTTOM, swings up and out
const SWING_DURATION_MS = 650;

// Side controls (chevrons + edit/delete), one set per row
const CHEVRON_WIDTH = 50;
const CHEVRON_HEIGHT = 100;
const CHEVRON_DEPTH = 20;
const SIDE_GAP = 30; // clearance from the cabinet body to the first side control
const SIDE_GAP_2 = 20; // clearance from the chevron to the edit/delete button
const ICON_BUTTON_SIZE = 70;

const COLORS = {
  body: 0x808080, // grey
  shelf: 0x2fae5c, // green
  pack: 0x2f6fed, // blue
  cover: 0xe0393e, // red
  chevron: 0xe2e2e6,
  edit: 0xffffff,
  delete: 0xe0393e,
};

// ---- Derived cavity bounds (body centered at the origin) ----
const halfW = BODY_WIDTH / 2;
const halfH = BODY_HEIGHT / 2;
const halfD = BODY_DEPTH / 2;

const cavityLeft = -halfW + INDENT_MARGIN_X;
const cavityRight = halfW - INDENT_MARGIN_X;
const cavityBottom = -halfH + INDENT_BOTTOM_MARGIN;
const cavityTop = cavityBottom + (SHELF_COUNT - 1) * ROW_PITCH + COVER_HEIGHT; // exactly matches the covers stack, no gap
const cavityFrontZ = halfD;
const cavityBackZ = halfD - INDENT_DEPTH;

// ---- Renderer / scene / camera ----
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1c1c1e);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
camera.position.set(750, 150, 2300);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.update();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- Lighting ----
scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
keyLight.position.set(600, 900, 1200);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xffffff, 0.35);
fillLight.position.set(-800, 200, -600);
scene.add(fillLight);

// ---- Materials ----
const bodyMaterial = new THREE.MeshStandardMaterial({ color: COLORS.body, roughness: 0.8, metalness: 0.1 });
const shelfMaterial = new THREE.MeshStandardMaterial({ color: COLORS.shelf, roughness: 0.6 });
const packMaterial = new THREE.MeshStandardMaterial({ color: COLORS.pack, roughness: 0.4 });
const coverMaterial = new THREE.MeshStandardMaterial({ color: COLORS.cover, roughness: 0.5 });
const chevronMaterial = new THREE.MeshStandardMaterial({ color: COLORS.chevron, roughness: 0.5 });

function addBox(width, height, depth, material, x, y, z, parent = scene) {
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
    ctx.fillText('SMOKER', w / 2, h / 2); // second pass builds up a stronger glow
  }, 900, 220);
}

function createIconTexture(emoji) {
  return createCanvasTexture((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.font = `${Math.round(h * 0.65)}px "Apple Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, w / 2, h / 2);
  }, 128, 128);
}

function addPlane(width, height, texture, x, y, z) {
  const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.position.set(x, y, z);
  scene.add(mesh);
  return mesh;
}

// Solid triangular chevron, `pointsLeft` controls which way it points.
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
  scene.add(mesh);
  return mesh;
}

// Flat colored icon button (edit/delete), with an emoji glyph on its front face.
function addIconButton(color, emoji, x, y, z) {
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
  const mesh = addBox(ICON_BUTTON_SIZE, ICON_BUTTON_SIZE, CHEVRON_DEPTH, material, x, y, z);
  const iconTexture = createIconTexture(emoji);
  addPlane(ICON_BUTTON_SIZE * 0.8, ICON_BUTTON_SIZE * 0.8, iconTexture, x, y, z + CHEVRON_DEPTH / 2 + 1);
  return mesh;
}

// ---- Main body: back block + 4 front frame strips around the cavity opening ----
const backBlockDepth = cavityBackZ - -halfD;
addBox(BODY_WIDTH, BODY_HEIGHT, backBlockDepth, bodyMaterial, 0, 0, -halfD + backBlockDepth / 2);

const frameDepth = cavityFrontZ - cavityBackZ;
const frameCenterZ = (cavityBackZ + cavityFrontZ) / 2;

// top strip
addBox(BODY_WIDTH, halfH - cavityTop, frameDepth, bodyMaterial, 0, (cavityTop + halfH) / 2, frameCenterZ);
// bottom strip
addBox(BODY_WIDTH, cavityBottom - -halfH, frameDepth, bodyMaterial, 0, (-halfH + cavityBottom) / 2, frameCenterZ);
// left strip
addBox(cavityLeft - -halfW, cavityTop - cavityBottom, frameDepth, bodyMaterial, (-halfW + cavityLeft) / 2, (cavityTop + cavityBottom) / 2, frameCenterZ);
// right strip
addBox(halfW - cavityRight, cavityTop - cavityBottom, frameDepth, bodyMaterial, (cavityRight + halfW) / 2, (cavityTop + cavityBottom) / 2, frameCenterZ);

// ---- Logo: placed above the topmost ("first", reading top-down) section cover ----
const logoTexture = createLogoTexture();
addPlane(500, 122, logoTexture, 0, (cavityTop + halfH) / 2, cavityFrontZ + 1);

// ---- Rows: shelf + packs + swinging cover + side controls, stacked bottom-up ----
const swingingCovers = []; // { group, mesh, isOpen, animStart, animFrom, animTo }
const pulseables = []; // { mesh, scale: current pulse scale }

for (let row = 0; row < SHELF_COUNT; row++) {
  const rowBottom = cavityBottom + row * ROW_PITCH;
  const rowTop = rowBottom + COVER_HEIGHT;
  const rowCenterY = rowBottom + COVER_HEIGHT / 2;

  // Shelf: centered in the cavity's depth range
  const shelfCenterZ = cavityBackZ + INDENT_DEPTH / 2;
  addBox(SHELF_WIDTH, SHELF_HEIGHT, SHELF_DEPTH, shelfMaterial, 0, rowBottom + SHELF_HEIGHT / 2, shelfCenterZ);

  // Packs: sit on top of the shelf, evenly spaced across the shelf width
  const packsTotalWidth = PACKS_PER_SHELF * PACK_WIDTH;
  const gap = (SHELF_WIDTH - packsTotalWidth) / (PACKS_PER_SHELF + 1);
  const packCenterY = rowBottom + SHELF_HEIGHT + PACK_HEIGHT / 2;
  for (let i = 0; i < PACKS_PER_SHELF; i++) {
    const packLeftEdge = -SHELF_WIDTH / 2 + gap * (i + 1) + PACK_WIDTH * i;
    const packCenterX = packLeftEdge + PACK_WIDTH / 2;
    addBox(PACK_WIDTH, PACK_HEIGHT, PACK_DEPTH, packMaterial, packCenterX, packCenterY, shelfCenterZ);
  }

  // Cover: hinged at its BOTTOM edge (rowBottom), swings up and forward when opened
  const coverClosedCenterZ = cavityFrontZ - COVER_DEPTH / 2;
  const hinge = new THREE.Group();
  hinge.position.set(0, rowBottom, coverClosedCenterZ);
  scene.add(hinge);

  const coverMesh = new THREE.Mesh(new THREE.BoxGeometry(COVER_WIDTH, COVER_HEIGHT, COVER_DEPTH), coverMaterial);
  coverMesh.position.set(0, COVER_HEIGHT / 2, 0);
  hinge.add(coverMesh);

  swingingCovers.push({ group: hinge, mesh: coverMesh, isOpen: false, animStart: 0, animFrom: 0, animTo: 0 });

  // Side controls: chevrons flank the row, edit/delete sit further outward on each side
  const sideZ = coverClosedCenterZ;
  const leftChevronX = -(halfW + SIDE_GAP + CHEVRON_WIDTH / 2);
  const rightChevronX = halfW + SIDE_GAP + CHEVRON_WIDTH / 2;
  const editX = -(halfW + SIDE_GAP + CHEVRON_WIDTH + SIDE_GAP_2 + ICON_BUTTON_SIZE / 2);
  const deleteX = halfW + SIDE_GAP + CHEVRON_WIDTH + SIDE_GAP_2 + ICON_BUTTON_SIZE / 2;

  const leftChevron = addChevron(true, leftChevronX, rowCenterY, sideZ);
  const rightChevron = addChevron(false, rightChevronX, rowCenterY, sideZ);
  const editBtn = addIconButton(COLORS.edit, '✏️', editX, rowCenterY, sideZ);
  const deleteBtn = addIconButton(COLORS.delete, '🗑️', deleteX, rowCenterY, sideZ);

  pulseables.push(
    { mesh: leftChevron, scale: 1 },
    { mesh: rightChevron, scale: 1 },
    { mesh: editBtn, scale: 1 },
    { mesh: deleteBtn, scale: 1 },
  );
}

// ---- Click interaction ----
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

renderer.domElement.addEventListener('click', (event) => {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const coverHit = raycaster.intersectObjects(swingingCovers.map((c) => c.mesh));
  if (coverHit.length > 0) {
    const cover = swingingCovers.find((c) => c.mesh === coverHit[0].object);
    const now = performance.now();
    cover.animFrom = cover.group.rotation.x;
    cover.isOpen = !cover.isOpen;
    cover.animTo = cover.isOpen ? OPEN_ANGLE : 0;
    cover.animStart = now;
    return;
  }

  const sideHit = raycaster.intersectObjects(pulseables.map((p) => p.mesh));
  if (sideHit.length > 0) {
    const entry = pulseables.find((p) => p.mesh === sideHit[0].object);
    entry.scale = 1.25; // decays back to 1 in the render loop, just a click acknowledgment
  }
});

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ---- Render loop ----
function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  for (const cover of swingingCovers) {
    if (cover.animStart === 0) continue;
    const t = Math.min(1, (now - cover.animStart) / SWING_DURATION_MS);
    cover.group.rotation.x = cover.animFrom + (cover.animTo - cover.animFrom) * easeInOutCubic(t);
    if (t >= 1) cover.animStart = 0;
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
