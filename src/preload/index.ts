import { contextBridge, ipcRenderer } from 'electron'

// Каждая операция main-процесса доступна окну как window.api.<имя>(...)
const names = [
  'login', 'logout', 'me',
  'refs', 'refMeta', 'refList', 'refSave', 'refDelete',
  'employeesList', 'employeesSave',
  'clientsList', 'clientsSave', 'clientsDelete', 'clientHistory',
  'carsList', 'carsSave', 'carsDelete', 'carsAvailable',
  'bookingsList', 'bookingsCreate', 'bookingsConfirm', 'bookingsCancel',
  'contractsList', 'contractsOpen', 'contractGet', 'contractsCreate', 'contractsExtend', 'contractsTerminate', 'finesAdd', 'contractsToClose', 'contractsClose',
  'paymentsList', 'contractFind', 'paymentsRegister', 'settlementsList', 'settlementRun',
  'returnsList', 'returnsCreate',
  'maintenanceList', 'maintenanceQueue', 'maintenanceSend', 'maintenanceCreate',
  'report', 'demoLoad', 'demoClear'
]

const bridge: Record<string, (...args: unknown[]) => Promise<unknown>> = {}
for (const n of names) {
  bridge[n] = async (...args) => {
    const res = await ipcRenderer.invoke(n, ...args)
    if (!res.ok) throw new Error(res.error)
    return res.data
  }
}

contextBridge.exposeInMainWorld('api', bridge)
