// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = any

export interface User {
  id: number
  code: string
  full_name: string
  role_id: number
  login: string
}

type Fn = (...args: Row[]) => Promise<Row>
type Names =
  | 'login' | 'logout' | 'me' | 'refs' | 'refMeta' | 'refList' | 'refSave' | 'refDelete'
  | 'employeesList' | 'employeesSave'
  | 'clientsList' | 'clientsSave' | 'clientsDelete' | 'clientHistory'
  | 'carsList' | 'carsSave' | 'carsDelete' | 'carsAvailable'
  | 'bookingsList' | 'bookingsCreate' | 'bookingsConfirm' | 'bookingsCancel'
  | 'contractsList' | 'contractsOpen' | 'contractGet' | 'contractsCreate' | 'contractsExtend' | 'contractsTerminate' | 'finesAdd' | 'contractsToClose' | 'contractsClose'
  | 'paymentsList' | 'contractFind' | 'paymentsRegister' | 'settlementsList' | 'settlementRun'
  | 'returnsList' | 'returnsCreate'
  | 'maintenanceList' | 'maintenanceQueue' | 'maintenanceSend' | 'maintenanceCreate'
  | 'report' | 'demoLoad' | 'demoClear'

declare global {
  interface Window {
    api: Record<Names, Fn>
  }
}

export const ROLE = { manager: 1, cashier: 2, tech: 3, boss: 4 }

export const money = (n: number | null | undefined): string => Number(n ?? 0).toLocaleString('ru-RU') + ' ₸'
export const dateRu = (s: string | null | undefined): string => (s ? s.split('-').reverse().join('.') : '')

export const todayIso = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const addDaysIso = (s: string, n: number): string => {
  const d = new Date(s + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const daysCount = (from: string, to: string): number =>
  Math.max(0, Math.round((+new Date(to + 'T00:00:00') - +new Date(from + 'T00:00:00')) / 86400000) + 1)

export const cleanError = (e: unknown): string =>
  (e as Error).message.replace(/^Error invoking remote method '.*?': Error: /, '')
