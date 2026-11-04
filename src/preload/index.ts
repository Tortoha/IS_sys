import { contextBridge, ipcRenderer } from 'electron'

const names = [
  'clientsList',
  'clientsSave',
  'clientsDelete',
  'carsList',
  'carsSave',
  'carsDelete',
  'rentalsList',
  'rentalsCreate',
  'rentalsFinish'
] as const

const bridge: Record<string, (...args: unknown[]) => Promise<unknown>> = {}
for (const n of names) {
  bridge[n] = async (...args) => {
    const res = await ipcRenderer.invoke(n, ...args)
    if (!res.ok) throw new Error(res.error)
    return res.data
  }
}

contextBridge.exposeInMainWorld('api', bridge)
