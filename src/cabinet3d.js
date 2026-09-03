import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ---- Spec dimensions (all in arbitrary "units") ----
const BODY_WIDTH = 500;
const BODY_DEPTH = 200;
const BODY_HEIGHT = 1500;

const INDENT_MARGIN_X = 50; // cavity starts/ends this far from the left/right edges
const INDENT_TOP_MARGIN = 200; // cavity starts this far from the top
const INDENT_BOTTOM_MARGIN = 400; // cavity ends this far from the bottom
const INDENT_DEPTH = 50; // how deep the cavity cuts in from the front face

const SHELF_WIDTH = 400;
const SHELF_DEPTH = 40;
const SHELF_HEIGHT = 10;

const PACK_HEIGHT = 100;
const PACK_WIDTH = 60;
const PACK_DEPTH = 20;

const COVER_WIDTH = 400;
const COVER_HEIGHT = 150;
const COVER_DEPTH = 10;

const SHELF_COUNT = 5;
const PACKS_PER_SHELF = 5;
const ROW_GAP = 6; // small visual seam between rows so 5 covers don't render as one seamless panel
const ROW_PITCH = COVER_HEIGHT + ROW_GAP; // vertical spacing from one row's bottom to the next
const OPEN_ANGLE = -110 * (Math.PI / 180);
const SWING_DURATION_MS = 650;

const COLORS = {
  body: 0x808080, // grey
  shelf: 0x2fae5c, // green
  pack: 0x2f6fed, // blue
  cover: 0xe0393e, // red
};

// ---- Derived cavity bounds (body centered at the origin) ----
const halfW = BODY_WIDTH / 2;
const halfH = BODY_HEIGHT / 2;
const halfD = BODY_DEPTH / 2;

const cavityLeft = -halfW + INDENT_MARGIN_X;
const cavityRight = halfW - INDENT_MARGIN_X;
const cavityTop = halfH - INDENT_TOP_MARGIN;
const cavityBottom = -halfH + INDENT_BOTTOM_MARGIN;
const cavityFrontZ = halfD;
const cavityBackZ = halfD - INDENT_DEPTH;

// ---- Renderer / scene / camera ----
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1c1c1e);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
camera.position.set(650, 150, 1900);

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

function addBox(width, height, depth, material, x, y, z, parent = scene) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
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

// ---- Rows: shelf + packs + swinging cover, stacked bottom-up ----
const swingingCovers = []; // { group, isOpen }

for (let row = 0; row < SHELF_COUNT; row++) {
  const rowBottom = cavityBottom + row * ROW_PITCH;
  const rowTop = rowBottom + COVER_HEIGHT;

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

  // Cover: hinged at its top edge (rowTop), sits flush with the cavity's front opening when closed
  const coverClosedCenterZ = cavityFrontZ - COVER_DEPTH / 2;
  const hinge = new THREE.Group();
  hinge.position.set(0, rowTop, coverClosedCenterZ);
  scene.add(hinge);

  const coverMesh = new THREE.Mesh(new THREE.BoxGeometry(COVER_WIDTH, COVER_HEIGHT, COVER_DEPTH), coverMaterial);
  coverMesh.position.set(0, -COVER_HEIGHT / 2, 0);
  hinge.add(coverMesh);

  swingingCovers.push({ group: hinge, mesh: coverMesh, isOpen: false, animStart: 0, animFrom: 0, animTo: 0 });
}

// ---- Click-to-swing interaction ----
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

renderer.domElement.addEventListener('click', (event) => {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const hit = raycaster.intersectObjects(swingingCovers.map((c) => c.mesh));
  if (hit.length === 0) return;

  const cover = swingingCovers.find((c) => c.mesh === hit[0].object);
  const now = performance.now();
  cover.animFrom = cover.group.rotation.x;
  cover.isOpen = !cover.isOpen;
  cover.animTo = cover.isOpen ? OPEN_ANGLE : 0;
  cover.animStart = now;
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

  controls.update();
  renderer.render(scene, camera);
}
animate();
