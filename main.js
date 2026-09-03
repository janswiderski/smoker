const { app, BrowserWindow, ipcMain, dialog, desktopCapturer, screen, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { compareImages } = require('./lib/diff');

app.setName('Smoker');

const DEFAULT_MISMATCH_THRESHOLD_PERCENT = 0.1;

const userDataDir = app.getPath('userData');
const smokeTestsDir = path.join(userDataDir, 'smoke-tests');
const dataDir = path.join(userDataDir, 'data');
const projectsFile = path.join(smokeTestsDir, 'projects.json');

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function readProjects() {
  if (!fs.existsSync(projectsFile)) return [];
  return JSON.parse(fs.readFileSync(projectsFile, 'utf-8'));
}

function writeProjects(projects) {
  fs.writeFileSync(projectsFile, JSON.stringify(projects, null, 2));
}

function ensureDirs() {
  fs.mkdirSync(smokeTestsDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });

  const bundledDir = path.join(__dirname, 'smoke-tests');
  for (const fileName of fs.readdirSync(bundledDir)) {
    const dest = path.join(smokeTestsDir, fileName);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(path.join(bundledDir, fileName), dest);
    }
  }

  const projects = readProjects();
  if (projects.length === 0) return;
  const validIds = new Set(projects.map((p) => p.id));

  for (const fileName of fs.readdirSync(smokeTestsDir)) {
    if (fileName === 'projects.json' || !fileName.endsWith('.json')) continue;
    const filePath = path.join(smokeTestsDir, fileName);
    const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (!validIds.has(json.projectId)) {
      json.projectId = projects[0].id;
      fs.writeFileSync(filePath, JSON.stringify(json, null, 2));
    }
  }
}

const OVERLAY_WIDTH = 480;
const OVERLAY_HEIGHT = 260;
const OVERLAY_MARGIN = 20;

let startWindow = null;
let overlayWindow = null;
let resultsWindow = null;
let editorWindow = null;
let baselinePreviewWindow = null;
let currentRun = null;

function readTest(fileName) {
  return JSON.parse(fs.readFileSync(path.join(smokeTestsDir, fileName), 'utf-8'));
}

function getRunIdsAscending(runsDir) {
  if (!fs.existsSync(runsDir)) return [];
  return fs
    .readdirSync(runsDir)
    .filter((runId) => fs.statSync(path.join(runsDir, runId)).isDirectory())
    .sort();
}

function toFileUrl(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return `${pathToFileURL(filePath).href}?t=${fs.statSync(filePath).mtimeMs}`;
}

function createStartWindow() {
  startWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 700,
    minHeight: 520,
    resizable: true,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 20, y: 20 },
    backgroundColor: '#1c1c1e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });
  startWindow.loadFile(path.join(__dirname, 'src', 'cabinet3d.html'));
}

function createOverlayWindow() {
  const primary = screen.getPrimaryDisplay();
  const { height: workHeight } = primary.workAreaSize;
  overlayWindow = new BrowserWindow({
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT,
    x: OVERLAY_MARGIN,
    y: workHeight - OVERLAY_HEIGHT - OVERLAY_MARGIN,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    fullscreenable: false,
    transparent: true,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.loadFile(path.join(__dirname, 'src', 'overlay.html'));
  overlayWindow.webContents.once('did-finish-load', () => sendStepUpdate());
  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

function sendStepUpdate() {
  if (!overlayWindow || !currentRun) return;
  const step = currentRun.steps[currentRun.stepIndex];
  overlayWindow.webContents.send('step-update', {
    testName: currentRun.testName,
    stepNumber: currentRun.stepIndex + 1,
    totalSteps: currentRun.steps.length,
    instruction: step.instruction,
    isFirst: currentRun.stepIndex === 0,
    isLast: currentRun.stepIndex === currentRun.steps.length - 1,
    requiresScreenshot: !!step.screenshot,
    stepResult: currentRun.results[step.id] || null,
  });
}

function createResultsWindow(fileName) {
  resultsWindow = new BrowserWindow({
    width: 720,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });
  resultsWindow.loadFile(path.join(__dirname, 'src', 'results.html'));
  resultsWindow.webContents.once('did-finish-load', () => {
    const json = readTest(fileName);
    resultsWindow.webContents.send('results-init', { fileName, testName: json.name });
  });
  resultsWindow.on('closed', () => {
    resultsWindow = null;
  });
}

function createEditorWindow(fileName) {
  editorWindow = new BrowserWindow({
    width: 640,
    height: 660,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });
  editorWindow.loadFile(path.join(__dirname, 'src', 'editor.html'));
  editorWindow.webContents.once('did-finish-load', () => {
    const json = readTest(fileName);
    const content = fs.readFileSync(path.join(smokeTestsDir, fileName), 'utf-8');
    editorWindow.webContents.send('editor-init', { fileName, testName: json.name, content });
  });
  editorWindow.on('closed', () => {
    editorWindow = null;
  });
}

function createBaselinePreviewWindow(imagePath) {
  if (baselinePreviewWindow) {
    baselinePreviewWindow.close();
  }

  const { width: imgWidth, height: imgHeight } = nativeImage.createFromPath(imagePath).getSize();
  const primary = screen.getPrimaryDisplay();
  const maxWidth = Math.round(primary.workAreaSize.width * 0.85);
  const maxHeight = Math.round(primary.workAreaSize.height * 0.85);
  const scale = Math.min(1, maxWidth / imgWidth, maxHeight / imgHeight);
  const winWidth = Math.max(320, Math.round(imgWidth * scale) + 40);
  const winHeight = Math.max(240, Math.round(imgHeight * scale) + 90);

  baselinePreviewWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });
  baselinePreviewWindow.setAlwaysOnTop(true, 'screen-saver');
  baselinePreviewWindow.loadFile(path.join(__dirname, 'src', 'baseline-preview.html'));
  baselinePreviewWindow.webContents.once('did-finish-load', () => {
    baselinePreviewWindow.webContents.send('baseline-preview-init', { imageUrl: toFileUrl(imagePath) });
  });
  baselinePreviewWindow.on('closed', () => {
    baselinePreviewWindow = null;
  });
}

async function captureScreen() {
  const wasVisible = overlayWindow.isVisible();
  overlayWindow.hide();
  await new Promise((r) => setTimeout(r, 150));
  const primary = screen.getPrimaryDisplay();
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.round(primary.size.width * primary.scaleFactor),
      height: Math.round(primary.size.height * primary.scaleFactor),
    },
  });
  const source = sources.find((s) => s.display_id === String(primary.id)) || sources[0];
  const png = source.thumbnail.toPNG();
  if (wasVisible) overlayWindow.show();
  return png;
}

async function buildCollage(entries) {
  const OUT_WIDTH = 900;
  const LABEL_HEIGHT = 34;
  const GAP = 18;
  const PADDING = 20;

  const rows = entries.map((entry) => {
    const { width, height } = nativeImage.createFromPath(entry.filePath).getSize();
    const scaledHeight = Math.round((height / width) * OUT_WIDTH);
    const timestamp = fs.statSync(entry.filePath).mtime.toLocaleString();
    return { ...entry, scaledHeight, timestamp };
  });

  const totalHeight =
    rows.reduce((sum, r) => sum + LABEL_HEIGHT + r.scaledHeight + GAP, 0) - GAP + PADDING * 2;
  const totalWidth = OUT_WIDTH + PADDING * 2;

  const rowsHtml = rows
    .map(
      (r) => `
      <div class="row">
        <div class="label" style="background:${r.color}">
          <span class="label-title">${r.label}</span>
          <span class="label-time">${r.timestamp}</span>
        </div>
        <img src="${pathToFileURL(r.filePath).href}" width="${OUT_WIDTH}" />
      </div>`
    )
    .join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #ffffff; font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: ${PADDING}px; }
    .row { margin-bottom: ${GAP}px; }
    .row:last-child { margin-bottom: 0; }
    .label { color: white; font-size: 14px; font-weight: 600; padding: 8px 12px; display: flex; justify-content: space-between; align-items: baseline; }
    .label-time { font-size: 11px; font-weight: 400; opacity: 0.85; }
    img { display: block; width: ${OUT_WIDTH}px; border: 1px solid #d8d8dc; border-top: none; }
  </style></head><body>${rowsHtml}</body></html>`;

  const tempHtmlPath = path.join(app.getPath('temp'), `smoker-collage-${Date.now()}.html`);
  fs.writeFileSync(tempHtmlPath, html);

  const collageWindow = new BrowserWindow({
    width: totalWidth,
    height: totalHeight,
    show: false,
    useContentSize: true,
    webPreferences: { offscreen: false },
  });

  try {
    await collageWindow.loadFile(tempHtmlPath);
    const image = await collageWindow.webContents.capturePage();
    return image.toPNG();
  } finally {
    collageWindow.destroy();
    fs.rmSync(tempHtmlPath, { force: true });
  }
}

ipcMain.handle('list-smoke-tests', () => {
  const files = fs.readdirSync(smokeTestsDir).filter((f) => f.endsWith('.json') && f !== 'projects.json');
  return files.map((f) => {
    const full = path.join(smokeTestsDir, f);
    const json = JSON.parse(fs.readFileSync(full, 'utf-8'));
    return {
      file: f,
      name: json.name || f,
      projectId: json.projectId || null,
      stepCount: (json.steps || []).length,
      mismatchThreshold: typeof json.mismatchThreshold === 'number' ? json.mismatchThreshold : DEFAULT_MISMATCH_THRESHOLD_PERCENT,
    };
  });
});

ipcMain.handle('list-projects', () => {
  return readProjects();
});

ipcMain.handle('create-project', (_event, name) => {
  const projects = readProjects();
  let id = slugify(name);
  let suffix = 2;
  while (projects.some((p) => p.id === id)) {
    id = `${slugify(name)}-${suffix++}`;
  }
  const project = { id, name };
  projects.push(project);
  writeProjects(projects);
  return project;
});

ipcMain.handle('rename-project', (_event, { id, name }) => {
  const projects = readProjects();
  const project = projects.find((p) => p.id === id);
  if (!project) throw new Error('Project not found.');
  project.name = name;
  writeProjects(projects);
  return project;
});

ipcMain.handle('delete-project', (_event, id) => {
  const projects = readProjects();
  const remaining = projects.filter((p) => p.id !== id);
  writeProjects(remaining);

  for (const fileName of fs.readdirSync(smokeTestsDir)) {
    if (fileName === 'projects.json' || !fileName.endsWith('.json')) continue;
    const filePath = path.join(smokeTestsDir, fileName);
    const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (json.projectId === id) {
      const testSlug = slugify(json.name);
      fs.rmSync(filePath, { force: true });
      fs.rmSync(path.join(dataDir, testSlug), { recursive: true, force: true });
    }
  }
});

ipcMain.handle('choose-add-test-plan-mode', async () => {
  const choice = await dialog.showMessageBox(startWindow, {
    type: 'question',
    buttons: ['Create Blank', 'Import JSON File…', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    message: 'Add a test plan',
    detail: 'Start from a blank plan, or import an existing JSON checklist.',
  });
  if (choice.response === 0) return 'blank';
  if (choice.response === 1) return 'import';
  return null;
});

ipcMain.handle('create-blank-test-plan', (_event, { name, projectId }) => {
  const json = {
    name,
    projectId,
    steps: [{ id: 1, instruction: 'Describe the first step of this test.' }],
  };
  const destName = `${slugify(name)}.json`;
  fs.writeFileSync(path.join(smokeTestsDir, destName), JSON.stringify(json, null, 2));
  return { file: destName, name, projectId, stepCount: json.steps.length };
});

ipcMain.handle('upload-smoke-test', async (_event, projectId) => {
  const result = await dialog.showOpenDialog(startWindow, {
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePaths.length) return null;

  const content = fs.readFileSync(result.filePaths[0], 'utf-8');
  const json = JSON.parse(content);
  if (!json.name || !Array.isArray(json.steps) || json.steps.length === 0) {
    throw new Error('Invalid smoke test file: expected { "name": string, "steps": [{ "id", "instruction" }, ...] }');
  }
  json.projectId = projectId;

  const destName = `${slugify(json.name)}.json`;
  fs.writeFileSync(path.join(smokeTestsDir, destName), JSON.stringify(json, null, 2));
  return { file: destName, name: json.name, projectId, stepCount: json.steps.length };
});

ipcMain.handle('delete-smoke-test', (_event, fileName) => {
  const json = readTest(fileName);
  const testSlug = slugify(json.name);
  fs.rmSync(path.join(smokeTestsDir, fileName), { force: true });
  fs.rmSync(path.join(dataDir, testSlug), { recursive: true, force: true });
});

ipcMain.handle('open-editor', (_event, fileName) => {
  createEditorWindow(fileName);
});

ipcMain.handle('save-test-content', (_event, { fileName, content }) => {
  const json = JSON.parse(content);
  if (!json.name || !Array.isArray(json.steps) || json.steps.length === 0) {
    throw new Error('Invalid smoke test: expected { "name": string, "steps": [...] }');
  }
  fs.writeFileSync(path.join(smokeTestsDir, fileName), content);
});

ipcMain.handle('download-test-plan', async (_event, fileName) => {
  const content = fs.readFileSync(path.join(smokeTestsDir, fileName), 'utf-8');
  const result = await dialog.showSaveDialog(startWindow, {
    defaultPath: fileName,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePath) return { saved: false };
  fs.writeFileSync(result.filePath, content);
  return { saved: true };
});

ipcMain.handle('download-test-content', async (_event, { fileName, content }) => {
  JSON.parse(content);
  const result = await dialog.showSaveDialog(editorWindow, {
    defaultPath: fileName,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePath) return { saved: false };
  fs.writeFileSync(result.filePath, content);
  return { saved: true };
});

ipcMain.handle('start-run', (_event, fileName) => {
  const json = readTest(fileName);
  const testSlug = slugify(json.name);
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(dataDir, testSlug, 'runs', runId);
  const baselineDir = path.join(dataDir, testSlug, 'baseline');
  fs.mkdirSync(runDir, { recursive: true });
  fs.mkdirSync(baselineDir, { recursive: true });

  currentRun = {
    testSlug,
    testName: json.name,
    steps: json.steps,
    mismatchThreshold: typeof json.mismatchThreshold === 'number' ? json.mismatchThreshold : DEFAULT_MISMATCH_THRESHOLD_PERCENT,
    stepIndex: 0,
    runId,
    startedAt: new Date().toISOString(),
    runDir,
    baselineDir,
    results: {},
  };

  createOverlayWindow();
  startWindow.hide();
  return { totalSteps: json.steps.length };
});

ipcMain.handle('take-screenshot', async (_event, delayMs) => {
  if (!currentRun) return null;
  const step = currentRun.steps[currentRun.stepIndex];
  if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
  const buffer = await captureScreen();
  const shotPath = path.join(currentRun.runDir, `step-${step.id}.png`);
  fs.writeFileSync(shotPath, buffer);

  const baselinePath = path.join(currentRun.baselineDir, `step-${step.id}.png`);
  let comparison;
  if (!fs.existsSync(baselinePath)) {
    fs.writeFileSync(baselinePath, buffer);
    comparison = { status: 'baseline-created', mismatchPercent: 0 };
  } else {
    const baselineBuffer = fs.readFileSync(baselinePath);
    const diffResult = compareImages(baselineBuffer, buffer, path.join(currentRun.runDir, `step-${step.id}-diff.png`));
    comparison = {
      status: diffResult.mismatchPercent > currentRun.mismatchThreshold ? 'mismatch' : 'match',
      mismatchPercent: diffResult.mismatchPercent,
      diffPath: diffResult.diffPath,
      dimensionsChanged: diffResult.dimensionsChanged,
    };
  }

  const result = { stepId: step.id, instruction: step.instruction, screenshotPath: shotPath, ...comparison };
  currentRun.results[step.id] = result;
  sendStepUpdate();
  return result;
});

ipcMain.handle('view-baseline', () => {
  if (!currentRun) return { exists: false };
  const step = currentRun.steps[currentRun.stepIndex];
  const baselinePath = path.join(currentRun.baselineDir, `step-${step.id}.png`);
  if (!fs.existsSync(baselinePath)) return { exists: false };
  createBaselinePreviewWindow(baselinePath);
  return { exists: true };
});

ipcMain.handle('prev-step', () => {
  if (!currentRun) return null;
  if (currentRun.stepIndex > 0) {
    currentRun.stepIndex -= 1;
    sendStepUpdate();
  }
  return { stepIndex: currentRun.stepIndex };
});

ipcMain.handle('next-step', () => {
  if (!currentRun) return null;
  if (currentRun.stepIndex < currentRun.steps.length - 1) {
    currentRun.stepIndex += 1;
    sendStepUpdate();
  }
  if (overlayWindow) overlayWindow.blur();
  return { stepIndex: currentRun.stepIndex, isLast: currentRun.stepIndex === currentRun.steps.length - 1 };
});

ipcMain.handle('end-run', () => {
  if (!currentRun) return null;
  const results = currentRun.steps
    .filter((step) => currentRun.results[step.id])
    .map((step) => currentRun.results[step.id]);
  const report = {
    testName: currentRun.testName,
    runId: currentRun.runId,
    startedAt: currentRun.startedAt,
    finishedAt: new Date().toISOString(),
    results,
  };
  fs.writeFileSync(path.join(currentRun.runDir, 'report.json'), JSON.stringify(report, null, 2));
  const runDir = currentRun.runDir;
  currentRun = null;

  if (overlayWindow) {
    overlayWindow.close();
    overlayWindow = null;
  }
  startWindow.show();
  return { runDir, report };
});

ipcMain.handle('reveal-in-finder', (_event, filePath) => {
  shell.showItemInFolder(filePath);
});

ipcMain.handle('open-path', (_event, filePath) => {
  shell.openPath(filePath);
});

ipcMain.handle('open-external', (_event, url) => {
  shell.openExternal(url);
});

ipcMain.handle('open-results', (_event, fileName) => {
  createResultsWindow(fileName);
});

ipcMain.handle('list-runs', (_event, fileName) => {
  const json = readTest(fileName);
  const testSlug = slugify(json.name);
  const runsDir = path.join(dataDir, testSlug, 'runs');
  const ascIds = getRunIdsAscending(runsDir);

  const runs = ascIds
    .map((runId, idx) => {
      const reportPath = path.join(runsDir, runId, 'report.json');
      if (!fs.existsSync(reportPath)) return null;
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
      return {
        runId,
        runNumber: idx + 1,
        startedAt: report.startedAt || null,
        finishedAt: report.finishedAt,
        stepCount: report.results.length,
        mismatchCount: report.results.filter((r) => r.status === 'mismatch').length,
      };
    })
    .filter(Boolean)
    .reverse();

  return { testName: json.name, runs };
});

ipcMain.handle('get-run-report', (_event, { fileName, runId }) => {
  const json = readTest(fileName);
  const testSlug = slugify(json.name);
  const baselineDir = path.join(dataDir, testSlug, 'baseline');
  const runsDir = path.join(dataDir, testSlug, 'runs');
  const reportPath = path.join(runsDir, runId, 'report.json');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));

  report.runNumber = getRunIdsAscending(runsDir).indexOf(runId) + 1;
  report.results = report.results.map((r) => {
    const baselinePath = path.join(baselineDir, `step-${r.stepId}.png`);
    return {
      ...r,
      screenshotUrl: toFileUrl(r.screenshotPath),
      diffUrl: r.diffPath ? toFileUrl(r.diffPath) : null,
      baselineUrl: toFileUrl(baselinePath),
    };
  });

  return report;
});

ipcMain.handle('delete-run', (_event, { fileName, runId }) => {
  const json = readTest(fileName);
  const testSlug = slugify(json.name);
  const runDir = path.join(dataDir, testSlug, 'runs', runId);
  fs.rmSync(runDir, { recursive: true, force: true });
});

ipcMain.handle('set-run-as-baseline', (_event, { fileName, runId }) => {
  const json = readTest(fileName);
  const testSlug = slugify(json.name);
  const baselineDir = path.join(dataDir, testSlug, 'baseline');
  const reportPath = path.join(dataDir, testSlug, 'runs', runId, 'report.json');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));

  fs.mkdirSync(baselineDir, { recursive: true });
  for (const r of report.results) {
    if (r.screenshotPath && fs.existsSync(r.screenshotPath)) {
      fs.copyFileSync(r.screenshotPath, path.join(baselineDir, `step-${r.stepId}.png`));
    }
  }
});

ipcMain.handle('download-collage', async (_event, { fileName, runId, stepId }) => {
  const json = readTest(fileName);
  const testSlug = slugify(json.name);
  const runsDir = path.join(dataDir, testSlug, 'runs');
  const runDir = path.join(runsDir, runId);
  const baselinePath = path.join(dataDir, testSlug, 'baseline', `step-${stepId}.png`);
  const screenshotPath = path.join(runDir, `step-${stepId}.png`);
  const diffPath = path.join(runDir, `step-${stepId}-diff.png`);
  const runNumber = getRunIdsAscending(runsDir).indexOf(runId) + 1;

  const entries = [];
  if (fs.existsSync(baselinePath)) entries.push({ label: 'Baseline', color: '#0a84ff', filePath: baselinePath });
  if (fs.existsSync(screenshotPath)) entries.push({ label: `Run #${runNumber} (Test Run)`, color: '#3a3a3c', filePath: screenshotPath });
  if (fs.existsSync(diffPath)) entries.push({ label: 'Diff', color: '#ff453a', filePath: diffPath });
  if (entries.length === 0) return { saved: false };

  const pngBuffer = await buildCollage(entries);

  const result = await dialog.showSaveDialog(resultsWindow, {
    defaultPath: `${testSlug}-run${runNumber}-step${stepId}-collage.png`,
    filters: [{ name: 'PNG Image', extensions: ['png'] }],
  });
  if (result.canceled || !result.filePath) return { saved: false };

  fs.writeFileSync(result.filePath, pngBuffer);
  return { saved: true, filePath: result.filePath };
});

app.whenReady().then(() => {
  ensureDirs();
  createStartWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createStartWindow();
});
