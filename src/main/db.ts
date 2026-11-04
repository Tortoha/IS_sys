import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import schema from '../../db/schema.sql?raw'
import refs from '../../db/refs.sql?raw'

export interface User {
  id: number
  code: string
  full_name: string
  role_id: number
  login: string
}

export const ROLE = { manager: 1, cashier: 2, tech: 3, boss: 4 } as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = any

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(join(app.getPath('userData'), 'rental.db'))
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    db.exec(schema)
    db.exec(refs)
    ensureEmployees(db)
  }
  return db
}

export const all = (sql: string, ...p: unknown[]): Row[] => getDb().prepare(sql).all(...p)
export const one = (sql: string, ...p: unknown[]): Row | undefined => getDb().prepare(sql).get(...p)
export const run = (sql: string, ...p: unknown[]) => getDb().prepare(sql).run(...p)

export function fail(msg: string): never {
  throw new Error(msg)
}

// ───────────── пароли ─────────────
export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString('hex')
  return salt + ':' + scryptSync(pw, salt, 32).toString('hex')
}

export function checkPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  const test = scryptSync(pw, salt, 32)
  const real = Buffer.from(hash, 'hex')
  return test.length === real.length && timingSafeEqual(test, real)
}

function ensureEmployees(d: Database.Database): void {
  const n = (d.prepare('SELECT COUNT(*) n FROM employees').get() as Row).n
  if (n > 0) return
  const ins = d.prepare(
    'INSERT INTO employees (code, full_name, role_id, login, password_hash) VALUES (?,?,?,?,?)'
  )
  const pw = hashPassword('1234')
  ins.run('S-001', 'Сулейменов И.К.', ROLE.boss, 'boss', pw)
  ins.run('S-002', 'Жомартов Ж.Д.', ROLE.manager, 'manager', pw)
  ins.run('S-003', 'Омарова А.К.', ROLE.cashier, 'kassir', pw)
  ins.run('S-004', 'Бекова С.Н.', ROLE.tech, 'to', pw)
}

// ───────────── даты и коды ─────────────
const p2 = (n: number) => String(n).padStart(2, '0')
export const isoDate = (d: Date): string => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
export const today = (): string => isoDate(new Date())
export const addDays = (s: string, n: number): string => {
  const d = new Date(s + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return isoDate(d)
}
export const daysBetween = (from: string, to: string): number =>
  Math.round((+new Date(to + 'T00:00:00') - +new Date(from + 'T00:00:00')) / 86400000) + 1

/** Следующий код вида PREFIX + номер (+ год). */
export function nextCode(table: string, prefix: string, width: number, year?: string): string {
  const full = year ? `${prefix}-${year}-` : prefix
  const last = one(`SELECT code FROM ${table} WHERE code LIKE ? ORDER BY id DESC LIMIT 1`, full + '%')
  const num = last ? parseInt(String(last.code).slice(full.length), 10) + 1 : 1
  return full + String(num).padStart(width, '0')
}

export const FUEL = ['Пустой', '1/4 бака', '1/2 бака', '3/4 бака', 'Полный'] as const
