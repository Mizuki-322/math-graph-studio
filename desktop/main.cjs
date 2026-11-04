const { app, BrowserWindow } = require('electron');
const { pageUrl, registerStaticProtocol } = require('./protocol.cjs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 900,
    minHeight: 620,
    title: '函数图像实验室',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  });
  mainWindow.webContents.on('will-navigate', (event, destination) => {
    const url = new URL(destination);
    if (url.protocol !== 'mathgraph:' || url.host !== 'app' || !['/index.html', '/signal.html'].includes(url.pathname)) event.preventDefault();
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.loadURL(pageUrl('index.html'));
}

app.whenReady().then(() => {
  registerStaticProtocol();
  createWindow();
});
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
