const { app, BrowserWindow, ipcMain, dialog, desktopCapturer, screen, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { compareImages } = require('./lib/diff');

const MISMATCH_THRESHOLD_PERCENT = 0.1;

const userDataDir = app.getPath('userData');
const smokeTestsDir = path.join(userDataDir, 'smoke-tests');
const dataDir = path.join(userDataDir, 'data');

function ensureDirs() {
  fs.mkdirSync(smokeTestsDir, { recursive: true });
  fs.mkdirSync(dataDir, { recursive: true });
  const bundledExample = path.join(__dirname, 'smoke-tests', 'example-login-flow.json');
  const destExample = path.join(smokeTestsDir, 'example-login-flow.json');
  if (fs.existsSync(bundledExample) && !fs.existsSync(destExample)) {
    fs.copyFileSync(bundledExample, destExample);
  }
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

let startWindow = null;
let overlayWindow = null;
let resultsWindow = null;
let currentRun = null;

function readTest(fileName) {
  return JSON.parse(fs.readFileSync(path.join(smokeTestsDir, fileName), 'utf-8'));
}

function createStartWindow() {
  startWindow = new BrowserWindow({
    width: 560,
    height: 640,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });
  startWindow.loadFile(path.join(__dirname, 'src', 'start.html'));
}

function createOverlayWindow() {
  const primary = screen.getPrimaryDisplay();
  const { width } = primary.workAreaSize;
  overlayWindow = new BrowserWindow({
    width: 420,
    height: 240,
    x: width - 440,
    y: 20,
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
    isLast: currentRun.stepIndex === currentRun.steps.length - 1,
    requiresScreenshot: !!step.screenshot,
    lastResult: currentRun.results[currentRun.results.length - 1] || null,
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

ipcMain.handle('list-smoke-tests', () => {
  const files = fs.readdirSync(smokeTestsDir).filter((f) => f.endsWith('.json'));
  return files.map((f) => {
    const full = path.join(smokeTestsDir, f);
    const json = JSON.parse(fs.readFileSync(full, 'utf-8'));
    return { file: f, name: json.name || f, stepCount: (json.steps || []).length };
  });
});

ipcMain.handle('upload-smoke-test', async () => {
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

  const destName = `${slugify(json.name)}.json`;
  fs.writeFileSync(path.join(smokeTestsDir, destName), JSON.stringify(json, null, 2));
  return { file: destName, name: json.name, stepCount: json.steps.length };
});

ipcMain.handle('start-run', (_event, fileName) => {
  const json = JSON.parse(fs.readFileSync(path.join(smokeTestsDir, fileName), 'utf-8'));
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
    stepIndex: 0,
    runId,
    runDir,
    baselineDir,
    results: [],
  };

  createOverlayWindow();
  startWindow.hide();
  return { totalSteps: json.steps.length };
});

ipcMain.handle('take-screenshot', async () => {
  if (!currentRun) return null;
  const step = currentRun.steps[currentRun.stepIndex];
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
      status: diffResult.mismatchPercent > MISMATCH_THRESHOLD_PERCENT ? 'mismatch' : 'match',
      mismatchPercent: diffResult.mismatchPercent,
      diffPath: diffResult.diffPath,
      dimensionsChanged: diffResult.dimensionsChanged,
    };
  }

  const result = { stepId: step.id, instruction: step.instruction, screenshotPath: shotPath, ...comparison };
  currentRun.results.push(result);
  sendStepUpdate();
  return result;
});

ipcMain.handle('next-step', () => {
  if (!currentRun) return null;
  if (currentRun.stepIndex < currentRun.steps.length - 1) {
    currentRun.stepIndex += 1;
    sendStepUpdate();
  }
  return { stepIndex: currentRun.stepIndex, isLast: currentRun.stepIndex === currentRun.steps.length - 1 };
});

ipcMain.handle('end-run', () => {
  if (!currentRun) return null;
  const report = {
    testName: currentRun.testName,
    runId: currentRun.runId,
    finishedAt: new Date().toISOString(),
    results: currentRun.results,
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

ipcMain.handle('open-results', (_event, fileName) => {
  createResultsWindow(fileName);
});

ipcMain.handle('list-runs', (_event, fileName) => {
  const json = readTest(fileName);
  const testSlug = slugify(json.name);
  const runsDir = path.join(dataDir, testSlug, 'runs');
  if (!fs.existsSync(runsDir)) return { testName: json.name, runs: [] };

  const runs = fs
    .readdirSync(runsDir)
    .filter((runId) => fs.statSync(path.join(runsDir, runId)).isDirectory())
    .map((runId) => {
      const reportPath = path.join(runsDir, runId, 'report.json');
      if (!fs.existsSync(reportPath)) return null;
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
      return {
        runId,
        finishedAt: report.finishedAt,
        stepCount: report.results.length,
        mismatchCount: report.results.filter((r) => r.status === 'mismatch').length,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.runId.localeCompare(a.runId));

  return { testName: json.name, runs };
});

ipcMain.handle('get-run-report', (_event, { fileName, runId }) => {
  const json = readTest(fileName);
  const testSlug = slugify(json.name);
  const baselineDir = path.join(dataDir, testSlug, 'baseline');
  const reportPath = path.join(dataDir, testSlug, 'runs', runId, 'report.json');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));

  report.results = report.results.map((r) => {
    const baselinePath = path.join(baselineDir, `step-${r.stepId}.png`);
    return {
      ...r,
      screenshotUrl: fs.existsSync(r.screenshotPath) ? pathToFileURL(r.screenshotPath).href : null,
      diffUrl: r.diffPath && fs.existsSync(r.diffPath) ? pathToFileURL(r.diffPath).href : null,
      baselineUrl: fs.existsSync(baselinePath) ? pathToFileURL(baselinePath).href : null,
    };
  });

  return report;
});

app.whenReady().then(() => {
  ensureDirs();
  createStartWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createStartWindow();
});
