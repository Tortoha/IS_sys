import { FUEL, addDays, all, getDb, one, run, today, type Row, type User } from './db'
import { services as s } from './services'

const maleFirst = ['Алихан', 'Нурлан', 'Ерлан', 'Данияр', 'Асхат', 'Тимур', 'Руслан', 'Марат', 'Бауыржан', 'Арман', 'Санжар', 'Айдос', 'Максат', 'Серик']
const femaleFirst = ['Айгерим', 'Аружан', 'Динара', 'Мадина', 'Жанар', 'Алия', 'Томирис', 'Асель', 'Камила', 'Гульнара', 'Салтанат', 'Дана']
const lastNames = ['Сейтказин', 'Омаров', 'Ахметов', 'Нургалиев', 'Касымов', 'Жумабаев', 'Темирбеков', 'Искаков', 'Байжанов', 'Оспанов', 'Кенжебаев', 'Мухамедов', 'Абдрахманов', 'Сарсенов']
const companies = ['ТОО «Алем Транс»', 'ТОО «Каспий Логистик»', 'ТОО «Степь Групп»', 'ИП «Нурсултанов»']

// марка, модель, год, класс
const fleet: [string, string, number, number][] = [
  ['Toyota', 'Corolla', 2021, 1], ['Hyundai', 'Accent', 2022, 1], ['Chevrolet', 'Cobalt', 2020, 1], ['Volkswagen', 'Polo', 2021, 1],
  ['Toyota', 'Camry', 2022, 2], ['Kia', 'K5', 2022, 2], ['Skoda', 'Octavia', 2021, 2],
  ['Lexus', 'ES 250', 2022, 3], ['BMW', '5 Series', 2021, 3], ['Mercedes-Benz', 'E-Class', 2020, 3],
  ['Toyota', 'Land Cruiser Prado', 2023, 4], ['Hyundai', 'Tucson', 2023, 4], ['Kia', 'Sportage', 2023, 4],
  ['Toyota', 'Alphard', 2021, 5], ['Hyundai', 'Staria', 2022, 5]
]
const colors = ['Белый', 'Чёрный', 'Серый', 'Серебристый', 'Синий']

const rnd = (n: number) => Math.floor(Math.random() * n)
const pick = <T,>(a: T[]): T => a[rnd(a.length)]
const digits = (n: number) => Array.from({ length: n }, () => rnd(10)).join('')
const letters = (n: number) => Array.from({ length: n }, () => pick([...'ABCEHKMOPTXY'])).join('')

function person(): string {
  if (Math.random() < 0.5) return `${pick(lastNames)} ${pick(maleFirst)}`
  const last = pick(lastNames)
  return `${last.endsWith('в') ? last + 'а' : last} ${pick(femaleFirst)}`
}

export function clearAll(): void {
  const d = getDb()
  d.transaction(() => {
    d.exec(`DELETE FROM maintenance; DELETE FROM fines; DELETE FROM return_acts; DELETE FROM payments;
            DELETE FROM contract_services; DELETE FROM contracts; DELETE FROM bookings;
            DELETE FROM cars; DELETE FROM clients;`)
    d.exec(`DELETE FROM sqlite_sequence WHERE name IN
            ('maintenance','fines','return_acts','payments','contract_services','contracts','bookings','cars','clients')`)
  })()
}

function userByRole(role: number): User {
  const e = one('SELECT id, code, full_name, role_id, login FROM employees WHERE role_id=? AND active=1 ORDER BY id', role)
  if (!e) throw new Error('Нет сотрудника с нужной ролью')
  return e
}

export function loadDemo(): Row {
  clearAll()
  const manager = userByRole(1)
  const cashier = userByRole(2)
  const tech = userByRole(3)
  const now = today()

  // клиенты: 18 физических, 4 юридических, 2 с просроченным ВУ
  const clients: number[] = []
  const expiredClients: number[] = []
  const phone = () => `+7 7${pick(['00', '01', '07', '47', '71', '75', '77', '78'])} ${digits(3)} ${digits(2)} ${digits(2)}`
  for (let i = 0; i < 24; i++) {
    const legal = i >= 18 && i < 22
    const expired = i >= 22
    const iin = legal ? '1' + digits(11) : String(70 + rnd(30)) + String(rnd(12) + 1).padStart(2, '0') + String(rnd(28) + 1).padStart(2, '0') + digits(6)
    try {
      s.clientsSave(manager, {
        type_id: legal ? 2 : 1,
        full_name: legal ? companies[i - 18] : person(),
        iin_bin: iin,
        phone: phone(),
        email: legal ? `info${i}@company.kz` : null,
        representative: legal ? person() + ', директор' : null,
        id_doc_no: legal ? null : digits(9),
        license_no: 'KZ' + digits(7),
        license_expiry: expired ? addDays(now, -(30 + rnd(300))) : addDays(now, 365 + rnd(1800))
      })
    } catch {
      /* повтор ИИН */
    }
  }
  for (const c of all('SELECT id, license_expiry FROM clients')) (c.license_expiry < now ? expiredClients : clients).push(c.id)

  // автомобили
  const carIds: number[] = []
  fleet.forEach(([brand, model, year, class_id]) => {
    s.carsSave(manager, {
      brand, model, year, class_id,
      plate: `${digits(3)} ${letters(3)} ${pick(['01', '02', '02', '02', '05', '09', '15'])}`,
      vin: letters(3) + digits(14),
      color: pick(colors),
      mileage: 8000 + rnd(90000)
    })
  })
  for (const c of all('SELECT id FROM cars ORDER BY id')) carIds.push(c.id)

  // загруженность по датам для генерации истории без пересечений
  const busy: Record<number, [string, string][]> = {}
  const free = (car: number, a: string, b: string) => !(busy[car] ?? []).some(([x, y]) => x <= b && y >= a)
  const take = (car: number, a: string, b: string) => (busy[car] ??= []).push([a, b])

  // история: закрытые договоры
  let made = 0
  for (let i = 0; i < 80 && made < 26; i++) {
    const car = pick(carIds)
    const from = addDays(now, -(12 + rnd(75)))
    const len = 1 + rnd(8)
    const to = addDays(from, len - 1)
    if (!free(car, from, addDays(to, 3))) continue
    take(car, from, addDays(to, 3))
    const client = pick(clients)
    try {
      const code = s.contractsCreate(manager, {
        client_id: client, car_id: car, date_from: from, date_to: to, signed: true, contract_date: from,
        deposit: pick([30000, 50000, 50000, 100000]),
        services: Math.random() < 0.3 ? [pick([1, 2, 3])] : [],
        issue_fuel: pick([FUEL[3], FUEL[4], FUEL[4]]), issue_mileage: undefined
      })
      const k = one('SELECT * FROM contracts WHERE code=?', code)
      s.paymentsRegister(cashier, {
        contract_id: k.id, method_id: pick([1, 2, 3]), accepted: k.rent_sum + k.deposit, paid_at: from, ref_no: 'KSP' + digits(9)
      })
      const late = Math.random() < 0.2 ? 1 + rnd(2) : 0
      const damaged = Math.random() < 0.12
      const ret = addDays(to, late)
      const fuelIdx = FUEL.indexOf(k.issue_fuel as (typeof FUEL)[number])
      s.returnsCreate(manager, {
        contract_id: k.id, return_date: ret, mileage: k.issue_mileage + 80 + rnd(900) * len,
        fuel: Math.random() < 0.15 ? FUEL[Math.max(0, fuelIdx - 1)] : FUEL[fuelIdx],
        damage: damaged ? pick(['Царапина на переднем бампере', 'Скол лобового стекла', 'Вмятина на левой двери']) : '',
        damage_amount: damaged ? pick([15000, 30000, 60000]) : 0
      })
      if (Math.random() < 0.1) s.finesAdd(manager, { contract_id: k.id, type_id: 4, amount: 15000 + rnd(3) * 5000, fined_at: ret })
      s.settlementRun(cashier, { contract_id: k.id, method_id: pick([1, 3]), accepted: 10 ** 8, paid_at: ret, ref_no: 'KSP' + digits(9) })
      s.contractsClose(manager, k.id)
      if (damaged) {
        s.maintenanceCreate(tech, {
          car_id: car, work_type_id: 3, done_at: addDays(ret, 1 + rnd(2)), mileage: 0,
          result: 'Ремонт кузова выполнен, автомобиль проверен', new_status_id: 1
        })
      }
      made++
    } catch {
      /* пропускаем неудачную комбинацию */
    }
  }

  // два договора с актом возврата, по которым кассир ещё не выполнил расчёт
  for (let i = 0; i < 2; i++) {
    const car = carIds.find((id) => free(id, addDays(now, -7), addDays(now, -3)))
    if (!car) break
    const from = addDays(now, -(6 + i))
    const to = addDays(from, 1 + i)
    take(car, from, addDays(to, 3))
    try {
      const code = s.contractsCreate(manager, {
        client_id: pick(clients), car_id: car, date_from: from, date_to: to, signed: true, contract_date: from,
        deposit: 50000, services: [], issue_fuel: FUEL[4]
      })
      const k = one('SELECT * FROM contracts WHERE code=?', code)
      s.paymentsRegister(cashier, { contract_id: k.id, method_id: 1, accepted: k.rent_sum + k.deposit, paid_at: from })
      s.returnsCreate(manager, {
        contract_id: k.id, return_date: addDays(to, i), mileage: k.issue_mileage + 400 + rnd(400), fuel: i ? FUEL[2] : FUEL[4], damage: '', damage_amount: 0
      })
      // второй договор: расчёт сделан, менеджеру осталось его закрыть
      if (i === 1) s.settlementRun(cashier, { contract_id: k.id, method_id: 1, accepted: 10 ** 8, paid_at: addDays(to, i) })
    } catch {
      /* пропускаем */
    }
  }

  // плановое ТО в истории
  for (const car of carIds.slice(0, 6)) {
    try {
      s.maintenanceSend(manager, car)
      s.maintenanceCreate(tech, {
        car_id: car, work_type_id: pick([1, 2, 4, 5]), done_at: addDays(now, -(20 + rnd(40))), mileage: 0,
        result: pick(['Заменено масло и фильтры', 'Плановое ТО выполнено', 'Выполнен технический осмотр']), new_status_id: 1
      })
    } catch {
      /* автомобиль занят */
    }
  }

  // активные договоры (автомобили в аренде), один не оплачен
  const active = carIds.filter((id) => free(id, addDays(now, -3), addDays(now, 9))).sort(() => Math.random() - 0.5).slice(0, 5)
  active.forEach((car, i) => {
    const from = addDays(now, -rnd(4))
    const to = addDays(now, 2 + rnd(7))
    take(car, from, to)
    const code = s.contractsCreate(manager, {
      client_id: pick(clients), car_id: car, date_from: from, date_to: to, signed: true, contract_date: from,
      deposit: 50000, services: i % 2 ? [1] : [], issue_fuel: FUEL[4]
    })
    if (i !== 4) {
      const k = one('SELECT * FROM contracts WHERE code=?', code)
      s.paymentsRegister(cashier, { contract_id: k.id, method_id: pick([1, 2, 3]), accepted: k.rent_sum + k.deposit, paid_at: from, ref_no: 'KSP' + digits(9) })
    }
  })

  // брони на будущее
  const candidates = carIds.filter((id) => !active.includes(id))
  for (let i = 0; i < 5; i++) {
    const car = pick(candidates)
    const from = addDays(now, 3 + rnd(14))
    const to = addDays(from, 1 + rnd(6))
    try {
      s.bookingsCreate(manager, { client_id: pick(clients), car_id: car, date_from: from, date_to: to, note: i === 0 ? 'Нужно детское кресло' : null })
      const b = one('SELECT id FROM bookings ORDER BY id DESC LIMIT 1')
      if (i < 3) s.bookingsConfirm(manager, b.id)
      if (i === 4) s.bookingsCancel(manager, b.id, 'Клиент изменил планы')
    } catch {
      /* пересечение дат */
    }
  }

  // два автомобиля ожидают ТО
  const waiting = all('SELECT id FROM cars WHERE status_id=1 ORDER BY RANDOM() LIMIT 2')
  for (const c of waiting) s.maintenanceSend(manager, c.id)

  // нестандартный остаток: подпись пробега для справки
  // у части автомобилей ТО давно не проводилось, чтобы показать плановое ТО по сроку
  run("UPDATE cars SET last_service=date('now', '-' || (40 + abs(random() % 260)) || ' day', 'localtime') WHERE last_service IS NULL")

  return {
    clients: one('SELECT COUNT(*) n FROM clients')!.n,
    cars: one('SELECT COUNT(*) n FROM cars')!.n,
    bookings: one('SELECT COUNT(*) n FROM bookings')!.n,
    contracts: one('SELECT COUNT(*) n FROM contracts')!.n,
    expiredClients: expiredClients.length
  }
}
