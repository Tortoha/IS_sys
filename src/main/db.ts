import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import schema from '../../db/schema.sql?raw'

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(join(app.getPath('userData'), 'carrental.db'))
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    db.exec(schema)
  }
  return db
}

export interface Client {
  id: number
  full_name: string
  iin: string
  phone: string
  license_no: string
}

export interface Car {
  id: number
  brand: string
  model: string
  plate: string
  vin: string | null
  year: number
  daily_price: number
  status: 'free' | 'rented' | 'service'
}

export interface Rental {
  id: number
  client_id: number
  car_id: number
  date_from: string
  date_to: string
  total: number
  status: 'active' | 'closed' | 'cancelled'
  client_name: string
  car_name: string
  plate: string
}

function days(from: string, to: string): number {
  const ms = new Date(to).getTime() - new Date(from).getTime()
  return Math.max(1, Math.round(ms / 86400000) + 1)
}

export const api = {
  // Клиенты
  clientsList: (): Client[] =>
    getDb().prepare('SELECT * FROM clients ORDER BY full_name').all() as Client[],
  clientsSave: (c: Omit<Client, 'id'> & { id?: number }): void => {
    if (c.id) {
      getDb()
        .prepare('UPDATE clients SET full_name=?, iin=?, phone=?, license_no=? WHERE id=?')
        .run(c.full_name, c.iin, c.phone, c.license_no, c.id)
    } else {
      getDb()
        .prepare('INSERT INTO clients (full_name, iin, phone, license_no) VALUES (?,?,?,?)')
        .run(c.full_name, c.iin, c.phone, c.license_no)
    }
  },
  clientsDelete: (id: number): void => {
    getDb().prepare('DELETE FROM clients WHERE id=?').run(id)
  },

  // Автомобили
  carsList: (): Car[] => getDb().prepare('SELECT * FROM cars ORDER BY brand, model').all() as Car[],
  carsSave: (c: Omit<Car, 'id' | 'status'> & { id?: number; status?: Car['status'] }): void => {
    if (c.id) {
      getDb()
        .prepare(
          'UPDATE cars SET brand=?, model=?, plate=?, vin=?, year=?, daily_price=?, status=COALESCE(?, status) WHERE id=?'
        )
        .run(c.brand, c.model, c.plate, c.vin, c.year, c.daily_price, c.status ?? null, c.id)
    } else {
      getDb()
        .prepare(
          'INSERT INTO cars (brand, model, plate, vin, year, daily_price) VALUES (?,?,?,?,?,?)'
        )
        .run(c.brand, c.model, c.plate, c.vin, c.year, c.daily_price)
    }
  },
  carsDelete: (id: number): void => {
    getDb().prepare('DELETE FROM cars WHERE id=?').run(id)
  },

  // Договоры проката
  rentalsList: (): Rental[] =>
    getDb()
      .prepare(
        `SELECT r.*, cl.full_name AS client_name,
                c.brand || ' ' || c.model AS car_name, c.plate
           FROM rentals r
           JOIN clients cl ON cl.id = r.client_id
           JOIN cars c ON c.id = r.car_id
          ORDER BY r.id DESC`
      )
      .all() as Rental[],
  rentalsCreate: (r: { client_id: number; car_id: number; date_from: string; date_to: string }): void => {
    const d = getDb()
    d.transaction(() => {
      const car = d.prepare('SELECT * FROM cars WHERE id=?').get(r.car_id) as Car | undefined
      if (!car) throw new Error('Автомобиль не найден')
      if (car.status !== 'free') throw new Error('Автомобиль сейчас недоступен')
      if (r.date_to < r.date_from) throw new Error('Дата возврата раньше даты выдачи')
      const total = days(r.date_from, r.date_to) * car.daily_price
      d.prepare(
        'INSERT INTO rentals (client_id, car_id, date_from, date_to, total) VALUES (?,?,?,?,?)'
      ).run(r.client_id, r.car_id, r.date_from, r.date_to, total)
      d.prepare("UPDATE cars SET status='rented' WHERE id=?").run(r.car_id)
    })()
  },
  rentalsFinish: (id: number, status: 'closed' | 'cancelled'): void => {
    const d = getDb()
    d.transaction(() => {
      const r = d.prepare('SELECT car_id FROM rentals WHERE id=?').get(id) as
        | { car_id: number }
        | undefined
      if (!r) return
      d.prepare('UPDATE rentals SET status=? WHERE id=?').run(status, id)
      d.prepare("UPDATE cars SET status='free' WHERE id=?").run(r.car_id)
    })()
  }
}

export type Api = typeof api
