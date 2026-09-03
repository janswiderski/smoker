const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1100,
    height: 900,
    backgroundColor: '#1c1c1e',
    webPreferences: {
      contextIsolation: true,
    },
  });
  win.loadFile(path.join(__dirname, 'src', 'cabinet3d.html'));
});

app.on('window-all-closed', () => {
  app.quit();
});
