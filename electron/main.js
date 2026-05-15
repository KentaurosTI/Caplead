const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const setupIpcHandlers = require('../services/ipcHandlers');

let mainWindow;

function registerManualHandler() {
  ipcMain.handle('open-user-manual', async () => {
    try {
      const candidates = [
        path.join(process.resourcesPath || '', 'docs', 'MANUAL_USUARIO_CAPLEAD_AI.pdf'),
        path.join(app.getAppPath(), 'docs', 'MANUAL_USUARIO_CAPLEAD_AI.pdf'),
        path.join(process.cwd(), 'docs', 'MANUAL_USUARIO_CAPLEAD_AI.pdf'),
        path.resolve(__dirname, '..', 'docs', 'MANUAL_USUARIO_CAPLEAD_AI.pdf')
      ];
      const manualPath = candidates.find(candidate => candidate && fs.existsSync(candidate));
      if (!manualPath) {
        return { success: false, error: 'Manual do usuário não encontrado.' };
      }
      const result = await shell.openPath(manualPath);
      if (result) return { success: false, error: result };
      return { success: true, path: manualPath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'LeadHunter AI',
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#0b1120',
  });

  mainWindow.maximize();

  const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.setMenu(null); // Remove menu padrão em produção
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Intercepta qualquer tentativa de abrir nova janela (target="_blank")
  // e redireciona para o navegador padrão do sistema
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' }; // Impede criação de nova BrowserWindow
  });

  // Também intercepta navegação direta dentro da janela principal
  // para URLs externas (segurança extra)
  mainWindow.webContents.on('will-navigate', (event, url) => {
    try {
      const parsed = new URL(url);
      // Permite apenas navegação para localhost (dev) ou file:// (prod)
      const isLocal = parsed.hostname === 'localhost' || parsed.protocol === 'file:';
      if (!isLocal) {
        event.preventDefault();
        shell.openExternal(url);
      }
    } catch {
      event.preventDefault();
    }
  });
}

app.whenReady().then(() => {
  registerManualHandler();
  createWindow();
  setupIpcHandlers(ipcMain, mainWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
