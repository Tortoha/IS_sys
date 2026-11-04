import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { ROLE, checkPassword, getDb, one, type User } from './db'
import { publicApi, services } from './services'
import { clearAll, loadDemo } from './demo'

const { manager: M, cashier: C, tech: T, boss: B } = ROLE

/** Какие роли могут вызывать каждую операцию. Руководитель имеет доступ ко всему. */
const access: Record<string, number[]> = {
  refs: [M, C, T, B],
  refMeta: [B], refList: [B], refSave: [B], refDelete: [B],
  employeesList: [B], employeesSave: [B],
  clientsList: [M, B], clientsSave: [M, B], clientsDelete: [M, B], clientHistory: [M, B],
  carsList: [M, T, B], carsSave: [M, B], carsDelete: [B], carsAvailable: [M, B],
  bookingsList: [M, B], bookingsCreate: [M, B], bookingsConfirm: [M, B], bookingsCancel: [M, B],
  contractsList: [M, C, B], contractsOpen: [M, C, B], contractGet: [M, C, B],
  contractsCreate: [M, B], contractsExtend: [M, C, B], contractsTerminate: [M, B], finesAdd: [M, C, B],
  contractsToClose: [M, B], contractsClose: [M, B],
  paymentsList: [C, B], contractFind: [C, B], paymentsRegister: [C, B], settlementsList: [C, B], settlementRun: [C, B],
  returnsList: [M, B], returnsCreate: [M, B],
  maintenanceList: [T, M, B], maintenanceQueue: [T, B], maintenanceSend: [T, M, B], maintenanceCreate: [T, B],
  report: [M, B]
}

let session: User | null = null

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    title: 'Прокат автомобилей',
    icon: join(__dirname, '../../build/icon.png'),
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

function handle(name: string, fn: (...args: unknown[]) => unknown): void {
  ipcMain.handle(name, (_e, ...args) => {
    try {
      return { ok: true, data: fn(...args) }
    } catch (e) {
      return { ok: false, error: friendlyError(e) }
    }
  })
}

app.whenReady().then(() => {
  getDb()

  handle('login', (login, password) => {
    const e = one('SELECT * FROM employees WHERE login=?', String(login ?? '').trim())
    if (!e || !checkPassword(String(password ?? ''), e.password_hash)) throw new Error('Неверный логин или пароль')
    if (!e.active) throw new Error('Учётная запись отключена')
    session = { id: e.id, code: e.code, full_name: e.full_name, role_id: e.role_id, login: e.login }
    return session
  })
  handle('logout', () => {
    session = null
  })
  handle('me', () => session)

  for (const [name, fn] of Object.entries(services)) {
    handle(name, (...args) => {
      if (!session) throw new Error('Войдите в систему')
      const roles = access[name]
      if (!roles) throw new Error('Операция недоступна')
      if (session.role_id !== B && !roles.includes(session.role_id)) throw new Error('Недостаточно прав для этой операции')
      return (fn as (u: User, ...a: unknown[]) => unknown)(session, ...args)
    })
  }

  // клиентский режим доступен без входа, но только эти три операции
  for (const [name, fn] of Object.entries(publicApi)) handle(name, (...args) => (fn as (a: unknown) => unknown)(args[0]))

  handle('demoLoad', () => {
    if (session?.role_id !== B) throw new Error('Недостаточно прав для этой операции')
    return loadDemo()
  })
  handle('demoClear', () => {
    if (session?.role_id !== B) throw new Error('Недостаточно прав для этой операции')
    clearAll()
  })

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
  if (msg.includes('UNIQUE') && msg.includes('iin_bin')) return 'Клиент с таким ИИН или БИН уже есть'
  if (msg.includes('UNIQUE') && msg.includes('plate')) return 'Автомобиль с таким госномером уже есть'
  if (msg.includes('UNIQUE') && msg.includes('vin')) return 'Автомобиль с таким VIN уже есть'
  if (msg.includes('UNIQUE') && msg.includes('login')) return 'Такой логин уже занят'
  if (msg.includes('UNIQUE')) return 'Такая запись уже существует'
  if (msg.includes('CHECK') && msg.includes('iin_bin')) return 'ИИН или БИН должен содержать 12 цифр'
  if (msg.includes('FOREIGN KEY')) return 'Нельзя удалить: запись используется в других данных'
  return msg
}
