import type Database from 'better-sqlite3'

const maleFirst = ['Алихан', 'Нурлан', 'Ерлан', 'Данияр', 'Асхат', 'Тимур', 'Руслан', 'Марат', 'Бауыржан', 'Арман', 'Динмухамед', 'Санжар', 'Айдос', 'Максат']
const femaleFirst = ['Айгерим', 'Аружан', 'Динара', 'Мадина', 'Жанар', 'Алия', 'Томирис', 'Асель', 'Камила', 'Гульнара', 'Салтанат', 'Дана']
const lastNames = ['Сейтказин', 'Омаров', 'Ахметов', 'Нургалиев', 'Касымов', 'Жумабаев', 'Темирбеков', 'Искаков', 'Байжанов', 'Сулейменов', 'Оспанов', 'Кенжебаев', 'Мухамедов', 'Абдрахманов']

const fleet: [string, string, number, number][] = [
  ['Toyota', 'Camry', 2022, 28000],
  ['Toyota', 'Corolla', 2021, 21000],
  ['Toyota', 'Land Cruiser Prado', 2023, 55000],
  ['Hyundai', 'Elantra', 2022, 20000],
  ['Hyundai', 'Tucson', 2023, 32000],
  ['Kia', 'K5', 2022, 26000],
  ['Kia', 'Sportage', 2023, 34000],
  ['Chevrolet', 'Cobalt', 2020, 14000],
  ['Chevrolet', 'Tracker', 2022, 22000],
  ['Skoda', 'Octavia', 2021, 22000],
  ['Volkswagen', 'Polo', 2021, 18000],
  ['Lexus', 'RX 350', 2022, 70000],
  ['BMW', '5 Series', 2021, 62000],
  ['Mercedes-Benz', 'E-Class', 2020, 65000],
  ['Chery', 'Tiggo 7 Pro', 2023, 25000]
]

const rnd = (n: number) => Math.floor(Math.random() * n)
const pick = <T,>(a: T[]): T => a[rnd(a.length)]
const digits = (n: number) => Array.from({ length: n }, () => rnd(10)).join('')
const letters = (n: number) => Array.from({ length: n }, () => pick([...'ABCEHKMOPTXY'])).join('')
const iso = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000)

function fullName(): string {
  if (Math.random() < 0.5) return `${pick(lastNames)} ${pick(maleFirst)}`
  const last = pick(lastNames)
  return `${last.endsWith('в') ? last + 'а' : last} ${pick(femaleFirst)}`
}

export function seedDemo(db: Database.Database, clientCount = 20): { clients: number; cars: number; rentals: number } {
  return db.transaction(() => {
    const addClient = db.prepare('INSERT INTO clients (full_name, iin, phone, license_no) VALUES (?,?,?,?)')
    const addCar = db.prepare(
      'INSERT INTO cars (brand, model, plate, vin, year, daily_price, status) VALUES (?,?,?,?,?,?,?)'
    )
    const addRental = db.prepare(
      'INSERT INTO rentals (client_id, car_id, date_from, date_to, total, status) VALUES (?,?,?,?,?,?)'
    )

    const clientIds: number[] = []
    for (let i = 0; i < clientCount; i++) {
      const yy = String(70 + rnd(30))
      const iin = yy + String(rnd(12) + 1).padStart(2, '0') + String(rnd(28) + 1).padStart(2, '0') + digits(6)
      const phone = `+7 7${pick(['00', '01', '07', '47', '71', '75', '77', '78'])} ${digits(3)} ${digits(2)} ${digits(2)}`
      try {
        clientIds.push(
          Number(addClient.run(fullName(), iin, phone, 'KZ' + digits(7)).lastInsertRowid)
        )
      } catch {
        /* повтор ИИН — пропускаем */
      }
    }

    const cars: { id: number; price: number }[] = []
    for (const [brand, model, year, price] of fleet) {
      const plate = `${digits(3)} ${letters(3)} ${pick(['01', '02', '02', '02', '05', '09', '15'])}`
      const id = Number(addCar.run(brand, model, plate, letters(3) + digits(14), year, price, 'free').lastInsertRowid)
      cars.push({ id, price })
    }

    const now = new Date()
    let rentals = 0
    const setStatus = db.prepare('UPDATE cars SET status=? WHERE id=?')
    const busy = new Set<number>()

    // История: закрытые и несколько отменённых договоров за последние 3 месяца
    for (let i = 0; i < 28; i++) {
      const car = pick(cars)
      const start = addDays(now, -(rnd(90) + 8))
      const len = rnd(9) + 1
      const end = addDays(start, len - 1)
      if (end >= addDays(now, -2)) continue
      addRental.run(
        pick(clientIds),
        car.id,
        iso(start),
        iso(end),
        len * car.price,
        Math.random() < 0.9 ? 'closed' : 'cancelled'
      )
      rentals++
    }

    // Активные договоры: автомобили в прокате
    const shuffled = [...cars].sort(() => Math.random() - 0.5)
    for (const car of shuffled.slice(0, 5)) {
      const start = addDays(now, -rnd(4))
      const len = rnd(8) + 3
      addRental.run(pick(clientIds), car.id, iso(start), iso(addDays(start, len - 1)), len * car.price, 'active')
      setStatus.run('rented', car.id)
      busy.add(car.id)
      rentals++
    }

    // Одна машина на обслуживании
    const svc = shuffled.find((c) => !busy.has(c.id))
    if (svc) setStatus.run('service', svc.id)

    return { clients: clientIds.length, cars: cars.length, rentals }
  })()
}

export function clearAll(db: Database.Database): void {
  db.transaction(() => {
    db.exec('DELETE FROM rentals; DELETE FROM cars; DELETE FROM clients;')
    db.exec("DELETE FROM sqlite_sequence WHERE name IN ('rentals','cars','clients')")
  })()
}
