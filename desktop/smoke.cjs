const path = require('node:path');
const { app, BrowserWindow } = require('electron');
const { pageUrl, registerStaticProtocol } = require('./protocol.cjs');

const fileProbe = process.argv.includes('--file-probe');

async function until(contents, predicate, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await contents.executeJavaScript(predicate)) return;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${predicate}`);
}

async function run() {
  if (!fileProbe) registerStaticProtocol();
  const window = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true }
  });
  const errors = [];
  window.webContents.on('console-message', ({ level, message }) => {
    if (level === 'error') errors.push(message);
  });
  window.webContents.on('did-fail-load', (_event, code, message) => errors.push(`${code}: ${message}`));

  if (fileProbe) await window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  else await window.loadURL(pageUrl('index.html'));

  const firstPageReady = () => window.webContents.executeJavaScript("document.getElementById('pointCount')?.textContent === '1601 个采样点' && document.getElementById('relationBadge')?.textContent === '6 个交点'");
  if (fileProbe) {
    try { await until(window.webContents, "document.getElementById('pointCount')?.textContent === '1601 个采样点'", 5000); }
    catch { /* The probe reports the actual browser errors below. */ }
    const graphReady = await firstPageReady();
    await window.webContents.executeJavaScript("document.querySelector('.top-nav a[href=\"./signal.html\"]').click()");
    try { await until(window.webContents, "document.getElementById('mainBadge')?.textContent === '401 个时间样本'", 5000); }
    catch { /* The probe reports the actual browser errors below. */ }
    const signalReady = await window.webContents.executeJavaScript("document.getElementById('mainBadge')?.textContent === '401 个时间样本'");
    console.log(JSON.stringify({ mode: 'file', graphReady, signalReady, errors }));
    window.close();
    return;
  }

  await until(window.webContents, "document.getElementById('pointCount')?.textContent === '1601 个采样点' && document.getElementById('relationBadge')?.textContent === '6 个交点'");
  const findings = { curve: await firstPageReady() };
  await window.webContents.executeJavaScript("document.querySelector('[data-mode=\"3d\"]').click()");
  await until(window.webContents, "document.getElementById('pointCount')?.textContent === '65 × 65 网格' && document.getElementById('relationBadge')?.textContent === '存在相交线'");
  findings.surface3d = true;
  await window.webContents.executeJavaScript("document.querySelector('[data-mode=\"4d\"]').click()");
  await until(window.webContents, "document.getElementById('graphTitle')?.textContent === '随时间变化的三维曲面' && document.getElementById('pointCount')?.textContent === '65 × 65 网格'");
  findings.surface4d = true;
  await window.webContents.executeJavaScript("document.querySelector('.top-nav a[href=\"./signal.html\"]').click()");
  await until(window.webContents, "document.getElementById('mainBadge')?.textContent === '401 个时间样本' && document.getElementById('resultTitle')?.textContent === '傅里叶幅度谱 |F(ω)|'");
  findings.fourier = true;
  await window.webContents.executeJavaScript("document.querySelector('[data-mode=\"laplace\"]').click()");
  await until(window.webContents, "document.getElementById('resultTitle')?.textContent === 'σ = 0 截面 · 傅里叶幅度'");
  findings.laplace = true;
  await window.webContents.executeJavaScript("document.querySelector('[data-mode=\"discrete\"]').click()");
  await until(window.webContents, "document.querySelector('#zPanel:not(.hidden)') && document.getElementById('mainBadge')?.textContent === 'N = 32'");
  findings.discreteAndZ = true;
  if (errors.length) throw new Error(`Renderer errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ mode: 'custom-protocol', findings, errors }));
  window.close();
}

app.whenReady().then(run).then(() => app.quit()).catch(error => {
  console.error(error);
  app.exit(1);
});
