import type { Api } from '../../main/db'

export type { Client, Car, Rental } from '../../main/db'

type AsyncApi = { [K in keyof Api]: (...a: Parameters<Api[K]>) => Promise<ReturnType<Api[K]>> }

declare global {
  interface Window {
    api: AsyncApi
  }
}

export const carStatus: Record<string, string> = {
  free: 'Свободен',
  rented: 'В прокате',
  service: 'На обслуживании'
}

export const rentalStatus: Record<string, string> = {
  active: 'Активен',
  closed: 'Закрыт',
  cancelled: 'Отменён'
}

export const money = (n: number): string => n.toLocaleString('ru-RU') + ' ₸'

export const dateRu = (s: string): string => s.split('-').reverse().join('.')
