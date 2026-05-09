import { app, BrowserWindow, ipcMain } from 'electron'
import * as path from 'path'

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 600,
    title: 'ROV 监控系统',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  } else {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.handle('getSerialPorts', async () => {
  try {
    if ('serial' in navigator) {
      const ports = await navigator.serial.getPorts()
      return ports.map((port: any) => ({
        path: port.path || 'Unknown',
        name: port.name || 'Unknown',
      }))
    }
    return []
  } catch (error) {
    console.error('Error getting serial ports:', error)
    return []
  }
})