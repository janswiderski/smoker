const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  listSmokeTests: () => ipcRenderer.invoke('list-smoke-tests'),
  uploadSmokeTest: () => ipcRenderer.invoke('upload-smoke-test'),
  startRun: (fileName) => ipcRenderer.invoke('start-run', fileName),
  takeScreenshot: () => ipcRenderer.invoke('take-screenshot'),
  nextStep: () => ipcRenderer.invoke('next-step'),
  endRun: () => ipcRenderer.invoke('end-run'),
  revealInFinder: (filePath) => ipcRenderer.invoke('reveal-in-finder', filePath),
  openPath: (filePath) => ipcRenderer.invoke('open-path', filePath),
  openResults: (fileName) => ipcRenderer.invoke('open-results', fileName),
  listRuns: (fileName) => ipcRenderer.invoke('list-runs', fileName),
  getRunReport: (fileName, runId) => ipcRenderer.invoke('get-run-report', { fileName, runId }),
  deleteRun: (fileName, runId) => ipcRenderer.invoke('delete-run', { fileName, runId }),
  setRunAsBaseline: (fileName, runId) => ipcRenderer.invoke('set-run-as-baseline', { fileName, runId }),
  onStepUpdate: (callback) => ipcRenderer.on('step-update', (_event, data) => callback(data)),
  onResultsInit: (callback) => ipcRenderer.on('results-init', (_event, data) => callback(data)),
});
