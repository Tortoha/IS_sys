import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { api, getDb } from './db'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 960,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    title: 'Прокат автомобилей',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  getDb()

  for (const [name, fn] of Object.entries(api)) {
    ipcMain.handle(name, (_e, ...args) => {
      try {
        return { ok: true, data: (fn as (...a: unknown[]) => unknown)(...args) }
      } catch (e) {
        return { ok: false, error: friendlyError(e) }
      }
    })
  }

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (msg.includes('UNIQUE') && msg.includes('iin')) return 'Клиент с таким ИИН уже есть'
  if (msg.includes('UNIQUE') && msg.includes('plate')) return 'Автомобиль с таким госномером уже есть'
  if (msg.includes('CHECK') && msg.includes('iin')) return 'ИИН должен содержать 12 цифр'
  if (msg.includes('FOREIGN KEY')) return 'Нельзя удалить: запись используется в договорах'
  return msg
}
