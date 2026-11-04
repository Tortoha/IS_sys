import {
  FUEL,
  ROLE,
  addDays,
  all,
  daysBetween,
  fail,
  getDb,
  hashPassword,
  nextCode,
  one,
  run,
  today,
  type Row,
  type User
} from './db'

// Статусы (коды из справочников, СРО 10)
const CAR = { free: 1, booked: 2, rented: 3, service: 4, unavailable: 5 }
const BOOK = { created: 1, confirmed: 2, cancelled: 3, issued: 4, done: 5 }
const CTR = { created: 1, paid: 2, closed: 3, terminated: 4 }
const PAY = { rent: 1, deposit: 2, refund: 3, fine: 4 }
const FINE = { overdue: 1, damage: 2, fuel: 3, traffic: 4 }
const METHOD_KASPI = 3

const tx = <T>(fn: () => T): T => getDb().transaction(fn)()
const year = (date: string) => date.slice(0, 4)
const num = (v: unknown) => Number(v) || 0
const str = (v: unknown) => String(v ?? '').trim()

// ───────────── Справочники ─────────────
const REF_TABLES: Record<string, { title: string; editable: boolean; extra?: string }> = {
  car_classes: { title: 'Класс автомобиля', editable: true },
  car_statuses: { title: 'Статус автомобиля', editable: false },
  booking_statuses: { title: 'Статус бронирования', editable: false },
  contract_statuses: { title: 'Статус договора', editable: false },
  tariffs: { title: 'Тариф', editable: true, extra: 'price_per_day' },
  payment_methods: { title: 'Способ оплаты', editable: true },
  payment_types: { title: 'Вид платежа', editable: false },
  fine_types: { title: 'Вид штрафа', editable: true, extra: 'default_amount' },
  work_types: { title: 'Вид работ ТО', editable: true },
  roles: { title: 'Роль сотрудника', editable: false },
  client_types: { title: 'Тип клиента', editable: false },
  extra_services: { title: 'Дополнительные услуги', editable: true, extra: 'price_per_day' }
}

function refCheck(table: string) {
  const t = REF_TABLES[table]
  if (!t) fail('Неизвестный справочник')
  return t
}

// ───────────── Доступность автомобиля ─────────────
function carBusy(carId: number, from: string, to: string, exceptBooking = 0, exceptContract = 0): boolean {
  const b = one(
    `SELECT 1 FROM bookings WHERE car_id=? AND status_id IN (1,2) AND date_from<=? AND date_to>=? AND id<>? LIMIT 1`,
    carId, to, from, exceptBooking
  )
  const c = one(
    `SELECT 1 FROM contracts k WHERE car_id=? AND status_id IN (1,2) AND date_from<=? AND date_to>=? AND id<>?
       AND NOT EXISTS (SELECT 1 FROM return_acts r WHERE r.contract_id=k.id) LIMIT 1`,
    carId, to, from, exceptContract
  )
  return !!(b || c)
}

/**
 * «Забронирован» — автомобиль, у которого есть действующая бронь на сегодняшний день.
 * Автомобиль с бронью на будущие даты остаётся «Свободен»: его защищает проверка пересечений по датам.
 */
function refreshBooked(carId: number): void {
  const car = one('SELECT status_id FROM cars WHERE id=?', carId)
  if (!car || ![CAR.free, CAR.booked].includes(car.status_id)) return
  const t = today()
  const has = one(
    'SELECT 1 FROM bookings WHERE car_id=? AND status_id IN (1,2) AND date_from<=? AND date_to>=? LIMIT 1', carId, t, t
  )
  run('UPDATE cars SET status_id=? WHERE id=?', has ? CAR.booked : CAR.free, carId)
}

function refreshAllBooked(): void {
  for (const c of all('SELECT id FROM cars WHERE status_id IN (1,2)')) refreshBooked(c.id)
}

function contractDue(id: number) {
  const k = one('SELECT rent_sum, deposit FROM contracts WHERE id=?', id)
  const paid = (t: number) => num(one('SELECT SUM(amount) s FROM payments WHERE contract_id=? AND type_id=?', id, t)?.s)
  const rentDue = Math.max(0, k.rent_sum - paid(PAY.rent))
  const depositDue = Math.max(0, k.deposit - paid(PAY.deposit))
  return { rentDue, depositDue, due: rentDue + depositDue }
}

function contractSelect(where = '1=1', ...p: unknown[]): Row[] {
  return all(
    `SELECT k.*, cl.full_name AS client_name, cl.iin_bin, cl.code AS client_code,
            c.brand || ' ' || c.model AS car_name, c.plate, c.code AS car_code,
            s.name AS status_name, t.name AS tariff_name,
            (SELECT 1 FROM return_acts r WHERE r.contract_id=k.id) AS has_act
       FROM contracts k
       JOIN clients cl ON cl.id=k.client_id
       JOIN cars c ON c.id=k.car_id
       JOIN contract_statuses s ON s.id=k.status_id
       JOIN tariffs t ON t.id=k.tariff_id
      WHERE ${where}
      ORDER BY k.id DESC`,
    ...p
  )
}

function availableCars(p: Row): Row[] {
  if (!p.date_from || !p.date_to || p.date_to < p.date_from) fail('Укажите корректные даты аренды')
  refreshAllBooked()
  const cars = all(
    `SELECT c.*, cl.name AS class_name, s.name AS status_name, t.price_per_day
       FROM cars c JOIN car_classes cl ON cl.id=c.class_id
       JOIN car_statuses s ON s.id=c.status_id
       JOIN tariffs t ON t.class_id=c.class_id
      WHERE c.status_id = 1 ${p.class_id ? 'AND c.class_id=' + num(p.class_id) : ''}
      ORDER BY c.brand, c.model`
  )
  return cars.filter((c) => !carBusy(c.id, p.date_from, p.date_to))
}

// ───────────── Публичный API (первый аргумент — пользователь) ─────────────
export const services = {
  // Справочники
  refs: (_u: User): Row => ({
    classes: all('SELECT * FROM car_classes ORDER BY id'),
    carStatuses: all('SELECT * FROM car_statuses ORDER BY id'),
    bookingStatuses: all('SELECT * FROM booking_statuses ORDER BY id'),
    contractStatuses: all('SELECT * FROM contract_statuses ORDER BY id'),
    tariffs: all('SELECT * FROM tariffs ORDER BY id'),
    methods: all('SELECT * FROM payment_methods ORDER BY id'),
    paymentTypes: all('SELECT * FROM payment_types ORDER BY id'),
    fineTypes: all('SELECT * FROM fine_types ORDER BY id'),
    workTypes: all('SELECT * FROM work_types ORDER BY id'),
    roles: all('SELECT * FROM roles ORDER BY id'),
    clientTypes: all('SELECT * FROM client_types ORDER BY id'),
    services: all('SELECT * FROM extra_services ORDER BY id'),
    fuel: [...FUEL]
  }),

  refMeta: (_u: User): Row =>
    Object.entries(REF_TABLES).map(([table, t]) => ({ table, ...t })),

  refList: (_u: User, table: string): Row[] => {
    refCheck(table)
    return all(`SELECT * FROM ${table} ORDER BY id`)
  },

  refSave: (_u: User, table: string, r: Row): void => {
    const t = refCheck(table)
    if (!t.editable) fail('Этот справочник нельзя изменять: от его значений зависит логика системы')
    const name = str(r.name)
    if (!name) fail('Введите название')
    if (table === 'tariffs') {
      const price = num(r.price_per_day)
      if (price <= 0) fail('Цена за сутки должна быть больше нуля')
      run('UPDATE tariffs SET name=?, price_per_day=? WHERE id=?', name, price, r.id)
      return
    }
    if (t.extra) {
      const v = num(r[t.extra])
      if (v < 0) fail('Сумма не может быть отрицательной')
      if (r.id) run(`UPDATE ${table} SET name=?, ${t.extra}=? WHERE id=?`, name, v, r.id)
      else run(`INSERT INTO ${table} (name, ${t.extra}) VALUES (?,?)`, name, v)
      return
    }
    if (r.id) run(`UPDATE ${table} SET name=? WHERE id=?`, name, r.id)
    else run(`INSERT INTO ${table} (name) VALUES (?)`, name)
  },

  refDelete: (_u: User, table: string, id: number): void => {
    const t = refCheck(table)
    if (!t.editable || table === 'tariffs') fail('Эту запись нельзя удалить')
    run(`DELETE FROM ${table} WHERE id=?`, id)
  },

  // ───────────── Сотрудники ─────────────
  employeesList: (_u: User): Row[] =>
    all(`SELECT e.id, e.code, e.full_name, e.role_id, e.login, e.active, r.name AS role_name
           FROM employees e JOIN roles r ON r.id=e.role_id ORDER BY e.id`),

  employeesSave: (u: User, e: Row): void => {
    const full_name = str(e.full_name)
    const login = str(e.login)
    if (!full_name || !login) fail('Заполните ФИО и логин')
    if (e.id) {
      if (e.id === u.id && (!e.active || e.role_id !== ROLE.boss))
        fail('Нельзя отключить или понизить собственную учётную запись')
      run('UPDATE employees SET full_name=?, role_id=?, login=?, active=? WHERE id=?',
        full_name, e.role_id, login, e.active ? 1 : 0, e.id)
      if (str(e.password)) run('UPDATE employees SET password_hash=? WHERE id=?', hashPassword(str(e.password)), e.id)
    } else {
      if (str(e.password).length < 4) fail('Пароль должен содержать не менее 4 символов')
      run('INSERT INTO employees (code, full_name, role_id, login, password_hash) VALUES (?,?,?,?,?)',
        nextCode('employees', 'S-', 3), full_name, e.role_id, login, hashPassword(str(e.password)))
    }
  },

  // ───────────── Клиенты ─────────────
  clientsList: (_u: User): Row[] =>
    all(`SELECT c.*, t.name AS type_name,
                (SELECT COUNT(*) FROM contracts k WHERE k.client_id=c.id) AS contracts_count,
                (SELECT COALESCE(SUM(f.amount),0) FROM fines f JOIN contracts k ON k.id=f.contract_id
                  WHERE k.client_id=c.id AND f.paid=0) AS unpaid_fines
           FROM clients c JOIN client_types t ON t.id=c.type_id ORDER BY c.full_name`),

  clientsSave: (_u: User, c: Row): number => {
    const iin = str(c.iin_bin)
    if (!/^\d{12}$/.test(iin)) fail(c.type_id === 2 ? 'БИН должен содержать 12 цифр' : 'ИИН должен содержать 12 цифр')
    const f = [str(c.full_name), str(c.phone), str(c.license_no), str(c.license_expiry)]
    if (f.some((x) => !x)) fail('Заполните ФИО, телефон и данные водительского удостоверения')
    if (c.type_id === 2 && !str(c.representative)) fail('Укажите представителя организации')
    const rep = c.type_id === 2 ? str(c.representative) : null
    if (c.id) {
      run(`UPDATE clients SET type_id=?, full_name=?, iin_bin=?, phone=?, email=?, id_doc_no=?, license_no=?, license_expiry=?, representative=? WHERE id=?`,
        c.type_id, f[0], iin, f[1], str(c.email) || null, str(c.id_doc_no) || null, f[2], f[3], rep, c.id)
      return c.id
    }
    return Number(
      run(`INSERT INTO clients (code, type_id, full_name, iin_bin, phone, email, id_doc_no, license_no, license_expiry, representative)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
        nextCode('clients', 'K-', 5), c.type_id, f[0], iin, f[1], str(c.email) || null, str(c.id_doc_no) || null, f[2], f[3], rep).lastInsertRowid
    )
  },

  clientsDelete: (_u: User, id: number): void => {
    run('DELETE FROM clients WHERE id=?', id)
  },

  /** История аренд клиента: факты просрочки, повреждений и неоплаченные штрафы (R5). */
  clientHistory: (_u: User, id: number): Row =>
    ({
      bookings: all(
        `SELECT b.code, b.date_from, b.date_to, s.name AS status_name, b.cancel_reason,
                c.brand || ' ' || c.model AS car_name, c.plate
           FROM bookings b JOIN cars c ON c.id=b.car_id JOIN booking_statuses s ON s.id=b.status_id
          WHERE b.client_id=? ORDER BY b.id DESC`, id),
      contracts: all(
      `SELECT k.id, k.code, k.date_from, k.date_to, k.rent_sum, s.name AS status_name,
              c.brand || ' ' || c.model AS car_name, c.plate,
              r.return_date, r.damage,
              CASE WHEN r.return_date IS NOT NULL AND r.return_date > k.date_to THEN 1 ELSE 0 END AS overdue,
              (SELECT COALESCE(SUM(f.amount),0) FROM fines f WHERE f.contract_id=k.id AND f.paid=0) AS unpaid_fines
         FROM contracts k
         JOIN cars c ON c.id=k.car_id
         JOIN contract_statuses s ON s.id=k.status_id
         LEFT JOIN return_acts r ON r.contract_id=k.id
        WHERE k.client_id=? ORDER BY k.id DESC`,
      id
    )}),

  // ───────────── Автомобили ─────────────
  carsList: (_u: User): Row[] => {
    refreshAllBooked()
    return all(`SELECT c.*, cl.name AS class_name, s.name AS status_name, t.price_per_day
           FROM cars c
           JOIN car_classes cl ON cl.id=c.class_id
           JOIN car_statuses s ON s.id=c.status_id
           LEFT JOIN tariffs t ON t.class_id=c.class_id
          ORDER BY c.code`)
  },

  carsSave: (_u: User, c: Row): void => {
    const brand = str(c.brand), model = str(c.model), plate = str(c.plate).toUpperCase()
    if (!brand || !model || !plate) fail('Заполните марку, модель и госномер')
    const year = num(c.year)
    if (year < 1990 || year > new Date().getFullYear() + 1) fail('Проверьте год выпуска')
    if (num(c.mileage) < 0) fail('Пробег не может быть отрицательным')
    if (c.id) {
      const cur = one('SELECT status_id FROM cars WHERE id=?', c.id)
      let st = cur.status_id
      if ([CAR.free, CAR.unavailable].includes(num(c.status_id)) && [CAR.free, CAR.booked, CAR.unavailable].includes(cur.status_id))
        st = num(c.status_id)
      run(`UPDATE cars SET brand=?, model=?, plate=?, vin=?, year=?, class_id=?, color=?, mileage=?, status_id=? WHERE id=?`,
        brand, model, plate, str(c.vin).toUpperCase() || null, year, c.class_id, str(c.color) || null, num(c.mileage), st, c.id)
      refreshBooked(c.id)
    } else {
      run(`INSERT INTO cars (code, brand, model, plate, vin, year, class_id, color, mileage) VALUES (?,?,?,?,?,?,?,?,?)`,
        nextCode('cars', 'A-', 4), brand, model, plate, str(c.vin).toUpperCase() || null, year, c.class_id, str(c.color) || null, num(c.mileage))
    }
  },

  carsDelete: (_u: User, id: number): void => {
    run('DELETE FROM cars WHERE id=?', id)
  },

  /** Доступны: статус «Свободен», автомобиль не на ТО и нет пересекающихся броней и договоров (СРО 9, шаг 4; R1, R14). */
  carsAvailable: (_u: User, p: Row): Row[] => availableCars(p),

  // ───────────── Бронирование ─────────────
  bookingsList: (_u: User): Row[] =>
    all(`SELECT b.*, cl.full_name AS client_name, cl.phone, c.brand || ' ' || c.model AS car_name, c.plate,
                s.name AS status_name, e.full_name AS employee_name
           FROM bookings b
           JOIN clients cl ON cl.id=b.client_id
           JOIN cars c ON c.id=b.car_id
           JOIN booking_statuses s ON s.id=b.status_id
           LEFT JOIN employees e ON e.id=b.employee_id
          ORDER BY b.id DESC`),

  bookingsCreate: (u: User, b: Row): string =>
    tx(() => {
      if (!b.client_id || !b.car_id) fail('Выберите клиента и автомобиль')
      if (!b.date_from || !b.date_to || b.date_to < b.date_from) fail('Дата окончания раньше даты начала')
      if (b.date_from < (b.created_at ?? today())) fail('Дата начала аренды не может быть в прошлом')
      const client = one('SELECT * FROM clients WHERE id=?', b.client_id)
      if (!client) fail('Клиент не найден')
      if (client.license_expiry < b.date_to)
        fail(`Бронирование невозможно: водительское удостоверение клиента действует до ${client.license_expiry}, раньше окончания аренды`)
      const car = one('SELECT * FROM cars WHERE id=?', b.car_id)
      if (!car) fail('Автомобиль не найден')
      refreshBooked(car.id)
      const st = one('SELECT status_id FROM cars WHERE id=?', car.id).status_id
      if ([CAR.service, CAR.unavailable].includes(st)) fail('Автомобиль на ТО или недоступен: бронь невозможна')
      if (carBusy(b.car_id, b.date_from, b.date_to)) fail('На эти даты автомобиль уже забронирован или находится в аренде')
      if (st !== CAR.free) fail('Автомобиль сейчас не свободен (в аренде или забронирован): бронь невозможна')
      const code = nextCode('bookings', 'B', 4, year(b.date_from))
      run(`INSERT INTO bookings (code, client_id, car_id, date_from, date_to, status_id, created_at, employee_id, note)
           VALUES (?,?,?,?,?,?,?,?,?)`,
        code, b.client_id, b.car_id, b.date_from, b.date_to, BOOK.created, b.created_at ?? today(), u.id || null, str(b.note) || null)
      refreshBooked(b.car_id)
      return code
    }),

  bookingsConfirm: (_u: User, id: number): void => {
    const b = one('SELECT status_id FROM bookings WHERE id=?', id)
    if (!b || b.status_id !== BOOK.created) fail('Подтвердить можно только бронь со статусом «Создано»')
    run('UPDATE bookings SET status_id=? WHERE id=?', BOOK.confirmed, id)
  },

  bookingsCancel: (_u: User, id: number, reason: string): void =>
    tx(() => {
      if (!str(reason)) fail('Укажите причину отмены бронирования')
      const b = one('SELECT * FROM bookings WHERE id=?', id)
      if (!b || ![BOOK.created, BOOK.confirmed].includes(b.status_id)) fail('Отменить можно только созданную или подтверждённую бронь')
      run('UPDATE bookings SET status_id=?, cancel_reason=? WHERE id=?', BOOK.cancelled, str(reason), id)
      refreshBooked(b.car_id)
    }),

  // ───────────── Договоры ─────────────
  contractsList: (_u: User): Row[] => contractSelect(),

  contractsOpen: (_u: User): Row[] =>
    contractSelect('k.status_id IN (1,2) AND NOT EXISTS (SELECT 1 FROM return_acts r WHERE r.contract_id=k.id)'),

  contractGet: (_u: User, id: number): Row => {
    const k = contractSelect('k.id=?', id)[0]
    if (!k) fail('Договор не найден')
    return {
      ...k,
      services: all(`SELECT s.name, cs.price_per_day FROM contract_services cs
                      JOIN extra_services s ON s.id=cs.service_id WHERE cs.contract_id=?`, id),
      payments: all(`SELECT p.*, t.name AS type_name, m.name AS method_name, e.full_name AS cashier_name
                       FROM payments p JOIN payment_types t ON t.id=p.type_id
                       JOIN payment_methods m ON m.id=p.method_id
                       LEFT JOIN employees e ON e.id=p.cashier_id
                      WHERE p.contract_id=? ORDER BY p.id`, id),
      fines: all(`SELECT f.*, t.name AS type_name FROM fines f JOIN fine_types t ON t.id=f.type_id
                   WHERE f.contract_id=? ORDER BY f.id`, id),
      act: one('SELECT * FROM return_acts WHERE contract_id=?', id) ?? null,
      ...contractDue(id)
    }
  },

  contractsCreate: (u: User, p: Row): string =>
    tx(() => {
      const booking = p.booking_id ? one('SELECT * FROM bookings WHERE id=?', p.booking_id) : null
      if (p.booking_id && (!booking || ![BOOK.created, BOOK.confirmed].includes(booking.status_id)))
        fail('Бронь не найдена или уже не действует')
      const client_id = booking ? booking.client_id : p.client_id
      const car_id = booking ? booking.car_id : p.car_id
      const date_from = booking ? booking.date_from : p.date_from
      const date_to = booking ? booking.date_to : p.date_to
      if (!client_id || !car_id) fail('Выберите клиента и автомобиль')
      if (!date_from || !date_to || date_to < date_from) fail('Дата возврата раньше даты выдачи')
      if (!p.signed) fail('Выдача возможна только по подписанному договору: отметьте подпись клиента')

      const client = one('SELECT * FROM clients WHERE id=?', client_id)
      if (client.license_expiry < date_to)
        fail(`Срок действия водительского удостоверения (${client.license_expiry}) истекает до окончания аренды`)

      const car = one('SELECT * FROM cars WHERE id=?', car_id)
      if (![CAR.free, CAR.booked].includes(car.status_id))
        fail('Автомобиль сейчас нельзя выдать (в аренде, на ТО или недоступен)')
      if (carBusy(car_id, date_from, date_to, booking?.id ?? 0)) fail('На эти даты автомобиль уже занят')

      const tariff = one('SELECT * FROM tariffs WHERE class_id=?', car.class_id)
      if (!tariff) fail('Для класса автомобиля не задан тариф')
      const svc: Row[] = (p.services ?? []).map((id: number) => one('SELECT * FROM extra_services WHERE id=?', id)).filter(Boolean)
      const perDay = tariff.price_per_day + svc.reduce((s, x) => s + x.price_per_day, 0)
      const days = daysBetween(date_from, date_to)
      const deposit = num(p.deposit)
      if (deposit < 0) fail('Залог не может быть отрицательным')
      const date = p.contract_date ?? today()
      const code = nextCode('contracts', 'D', 4, year(date))
      const fuel = p.issue_fuel && FUEL.includes(p.issue_fuel) ? p.issue_fuel : FUEL[4]

      const id = Number(
        run(
          `INSERT INTO contracts (code, contract_date, booking_id, client_id, car_id, tariff_id, price_per_day, date_from, date_to,
                                  rent_sum, deposit, status_id, issue_mileage, issue_fuel, issue_note, employee_id)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          code, date, booking?.id ?? null, client_id, car_id, tariff.id, tariff.price_per_day, date_from, date_to,
          days * perDay, deposit, CTR.created, num(p.issue_mileage) || car.mileage, fuel, str(p.issue_note) || null, u.id
        ).lastInsertRowid
      )
      for (const s of svc)
        run('INSERT INTO contract_services (contract_id, service_id, price_per_day) VALUES (?,?,?)', id, s.id, s.price_per_day)
      run('UPDATE cars SET status_id=? WHERE id=?', CAR.rented, car_id)
      if (booking) run('UPDATE bookings SET status_id=? WHERE id=?', BOOK.issued, booking.id)
      return code
    }),

  /** Продление срока: стоимость пересчитывается (R6.2). */
  contractsExtend: (_u: User, id: number, newTo: string): void =>
    tx(() => {
      const k = one('SELECT * FROM contracts WHERE id=?', id)
      if (!k || ![CTR.created, CTR.paid].includes(k.status_id) || one('SELECT 1 FROM return_acts WHERE contract_id=?', id))
        fail('Продлить можно только действующий договор')
      if (newTo <= k.date_to) fail('Новая дата должна быть позже текущей даты возврата')
      const client = one('SELECT license_expiry FROM clients WHERE id=?', k.client_id)
      if (client.license_expiry < newTo) fail('Срок водительского удостоверения истекает до новой даты возврата')
      if (carBusy(k.car_id, addDays(k.date_to, 1), newTo, 0, id)) fail('На продлённый срок автомобиль уже забронирован')
      const svc = num(one('SELECT SUM(price_per_day) s FROM contract_services WHERE contract_id=?', id)?.s)
      const rent = daysBetween(k.date_from, newTo) * (k.price_per_day + svc)
      run('UPDATE contracts SET date_to=?, rent_sum=?, status_id=? WHERE id=?', newTo, rent, CTR.created, id)
      // если аренда уже была оплачена полностью, а сумма выросла — требуется доплата
      const due = contractDue(id)
      if (due.due === 0) run('UPDATE contracts SET status_id=? WHERE id=?', CTR.paid, id)
    }),

  contractsTerminate: (_u: User, id: number): void =>
    tx(() => {
      const k = one('SELECT * FROM contracts WHERE id=?', id)
      if (!k || ![CTR.created, CTR.paid].includes(k.status_id) || one('SELECT 1 FROM return_acts WHERE contract_id=?', id))
        fail('Расторгнуть можно только действующий договор до возврата автомобиля')
      if (one('SELECT 1 FROM payments WHERE contract_id=?', id))
        fail('По договору есть платежи. Оформите возврат автомобиля и расчёт, чтобы вернуть залог')
      run('UPDATE contracts SET status_id=? WHERE id=?', CTR.terminated, id)
      run('UPDATE cars SET status_id=? WHERE id=?', CAR.free, k.car_id)
      if (k.booking_id) run('UPDATE bookings SET status_id=? WHERE id=?', BOOK.cancelled, k.booking_id)
      refreshBooked(k.car_id)
    }),

  finesAdd: (_u: User, p: Row): void => {
    const k = one('SELECT status_id FROM contracts WHERE id=?', p.contract_id)
    if (!k || [CTR.closed, CTR.terminated].includes(k.status_id)) fail('Штраф можно начислить только по действующему договору')
    const type = one('SELECT * FROM fine_types WHERE id=?', p.type_id)
    const amount = num(p.amount) || type.default_amount
    if (amount <= 0) fail('Укажите сумму штрафа')
    run('INSERT INTO fines (code, contract_id, type_id, amount, fined_at) VALUES (?,?,?,?,?)',
      nextCode('fines', 'SH-', 4), p.contract_id, p.type_id, amount, p.fined_at ?? today())
  },

  // ───────────── Платежи ─────────────
  paymentsList: (_u: User): Row[] =>
    all(`SELECT p.*, k.code AS contract_code, t.name AS type_name, m.name AS method_name,
                cl.full_name AS client_name, e.full_name AS cashier_name
           FROM payments p
           JOIN contracts k ON k.id=p.contract_id
           JOIN clients cl ON cl.id=k.client_id
           JOIN payment_types t ON t.id=p.type_id
           JOIN payment_methods m ON m.id=p.method_id
           LEFT JOIN employees e ON e.id=p.cashier_id
          ORDER BY p.id DESC`),

  /** Поиск договора по номеру или ИИН клиента (шаг 3 сценария ПР 4). */
  contractFind: (_u: User, q: string): Row[] => {
    const s = str(q)
    if (!s) fail('Введите номер договора или ИИН клиента')
    return contractSelect('(k.code LIKE ? OR cl.iin_bin = ?) ', '%' + s + '%', s).map((k) => ({
      ...k,
      ...contractDue(k.id),
      services_sum: num(one('SELECT SUM(price_per_day) s FROM contract_services WHERE contract_id=?', k.id)?.s),
      fines_sum: num(one('SELECT SUM(amount) s FROM fines WHERE contract_id=? AND paid=0', k.id)?.s)
    }))
  },

  /** Регистрация оплаты аренды и залога (ПР 4). */
  paymentsRegister: (u: User, p: Row): Row =>
    tx(() => {
      const k = one('SELECT * FROM contracts WHERE id=?', p.contract_id)
      if (!k) fail('Договор не найден')
      if (![CTR.created, CTR.paid].includes(k.status_id) || one('SELECT 1 FROM return_acts WHERE contract_id=?', k.id))
        fail('Оплата принимается только по действующему договору')
      const d = contractDue(k.id)
      if (d.due === 0) fail('По договору нечего оплачивать: аренда и залог уже внесены')
      if (!p.method_id) fail('Выберите способ оплаты')
      const accepted = num(p.accepted)
      if (accepted < d.due) fail(`Принятая сумма меньше требуемой: нужно не менее ${d.due.toLocaleString('ru-RU')} ₸`)
      const ref = str(p.ref_no)
      if (p.method_id === METHOD_KASPI && !ref) fail('Для Kaspi QR укажите номер операции из подтверждения банка')
      const date = p.paid_at ?? today()
      const codes: string[] = []
      const add = (type: number, amount: number) => {
        if (amount <= 0) return
        const code = nextCode('payments', 'P', 4, year(date))
        run(`INSERT INTO payments (code, contract_id, type_id, amount, paid_at, method_id, ref_no, cashier_id)
             VALUES (?,?,?,?,?,?,?,?)`, code, k.id, type, amount, date, p.method_id, ref || null, u.id)
        codes.push(code)
      }
      add(PAY.rent, d.rentDue)
      add(PAY.deposit, d.depositDue)
      run('UPDATE contracts SET status_id=? WHERE id=?', CTR.paid, k.id)
      return { codes, contract: k.code, rent: d.rentDue, deposit: d.depositDue, total: d.due, accepted, change: accepted - d.due, date }
    }),

  /** Договоры, по которым составлен акт возврата и нужен итоговый расчёт. */
  settlementsList: (_u: User): Row[] =>
    contractSelect('k.status_id IN (1,2) AND k.settled=0 AND EXISTS (SELECT 1 FROM return_acts r WHERE r.contract_id=k.id)').map((k) =>
      ({ ...k, ...settlementCalc(k.id) })),

  /** Договоры, по которым расчёт выполнен и менеджеру осталось закрыть договор (ПР 3, процесс 4, шаг 5). */
  contractsToClose: (_u: User): Row[] =>
    contractSelect('k.status_id IN (1,2) AND k.settled=1'),

  contractsClose: (_u: User, id: number): void => {
    const k = one('SELECT status_id, settled FROM contracts WHERE id=?', id)
    if (!k || ![CTR.created, CTR.paid].includes(k.status_id)) fail('Договор не найден или уже закрыт')
    if (!k.settled) fail('Договор можно закрыть только после расчёта кассира по штрафам и залогу')
    run('UPDATE contracts SET status_id=? WHERE id=?', CTR.closed, id)
  },

  settlementRun: (u: User, p: Row): Row =>
    tx(() => {
      const k = one('SELECT * FROM contracts WHERE id=?', p.contract_id)
      if (!k || ![CTR.created, CTR.paid].includes(k.status_id) || k.settled || !one('SELECT 1 FROM return_acts WHERE contract_id=?', k.id))
        fail('Расчёт возможен только после оформления акта возврата и только один раз')
      const s = settlementCalc(k.id)
      if (s.rentDue > 0) fail('По договору есть неоплаченная аренда. Сначала примите оплату')
      if ((s.extra > 0 || s.refund > 0) && !p.method_id) fail('Выберите способ оплаты')
      const ref = str(p.ref_no)
      if (s.extra > 0) {
        if (num(p.accepted) < s.extra) fail(`Клиент должен доплатить ${s.extra.toLocaleString('ru-RU')} ₸ по штрафам`)
        if (p.method_id === METHOD_KASPI && !ref) fail('Для Kaspi QR укажите номер операции из подтверждения банка')
      }
      const date = p.paid_at ?? today()
      const add = (type: number, amount: number) => {
        run(`INSERT INTO payments (code, contract_id, type_id, amount, paid_at, method_id, ref_no, cashier_id)
             VALUES (?,?,?,?,?,?,?,?)`, nextCode('payments', 'P', 4, year(date)), k.id, type, amount, date, p.method_id, ref || null, u.id)
      }
      if (s.extra > 0) add(PAY.fine, s.extra)
      if (s.refund > 0) add(PAY.refund, s.refund)
      run('UPDATE fines SET paid=1 WHERE contract_id=?', k.id)
      run('UPDATE contracts SET settled=1 WHERE id=?', k.id)
      return { contract: k.code, ...s }
    }),

  // ───────────── Возврат автомобиля ─────────────
  returnsList: (_u: User): Row[] =>
    all(`SELECT r.*, k.code AS contract_code, cl.full_name AS client_name, c.brand || ' ' || c.model AS car_name, c.plate,
                k.date_to, e.full_name AS employee_name,
                (SELECT COALESCE(SUM(f.amount),0) FROM fines f WHERE f.contract_id=k.id) AS fines_sum
           FROM return_acts r
           JOIN contracts k ON k.id=r.contract_id
           JOIN clients cl ON cl.id=k.client_id
           JOIN cars c ON c.id=k.car_id
           LEFT JOIN employees e ON e.id=r.employee_id
          ORDER BY r.id DESC`),

  returnsCreate: (u: User, p: Row): Row =>
    tx(() => {
      const k = one('SELECT * FROM contracts WHERE id=?', p.contract_id)
      if (!k || ![CTR.created, CTR.paid].includes(k.status_id)) fail('Договор не найден или уже закрыт')
      if (one('SELECT 1 FROM return_acts WHERE contract_id=?', k.id)) fail('Акт возврата по договору уже составлен')
      const date = p.return_date ?? today()
      if (date < k.date_from) fail('Дата возврата раньше даты выдачи')
      const mileage = num(p.mileage)
      if (mileage < k.issue_mileage) fail(`Пробег при возврате не может быть меньше пробега при выдаче (${k.issue_mileage} км)`)
      if (!FUEL.includes(p.fuel)) fail('Выберите уровень топлива')
      const damage = str(p.damage)
      const damageAmount = num(p.damage_amount)
      if (damage && damageAmount <= 0) fail('Укажите сумму штрафа за повреждения по акту')

      const code = nextCode('return_acts', 'A', 4, year(date))
      run(`INSERT INTO return_acts (code, contract_id, return_date, mileage, fuel, damage, employee_id) VALUES (?,?,?,?,?,?,?)`,
        code, k.id, date, mileage, p.fuel, damage || null, u.id)

      const fine = (type: number, amount: number) =>
        run('INSERT INTO fines (code, contract_id, type_id, amount, fined_at) VALUES (?,?,?,?,?)',
          nextCode('fines', 'SH-', 4), k.id, type, amount, date)
      const fineDefault = (type: number) => one('SELECT default_amount a FROM fine_types WHERE id=?', type)!.a
      const created: string[] = []
      if (date > k.date_to) { fine(FINE.overdue, fineDefault(FINE.overdue)); created.push('просрочка возврата') }
      if (FUEL.indexOf(p.fuel) < FUEL.indexOf(k.issue_fuel)) { fine(FINE.fuel, fineDefault(FINE.fuel)); created.push('возврат без топлива') }
      if (damage) { fine(FINE.damage, damageAmount); created.push('повреждение автомобиля') }

      run('UPDATE cars SET mileage=?, status_id=? WHERE id=?', mileage, damage ? CAR.service : CAR.free, k.car_id)
      refreshBooked(k.car_id)
      if (k.booking_id) run('UPDATE bookings SET status_id=? WHERE id=?', BOOK.done, k.booking_id)
      return { code, fines: created, toService: !!damage }
    }),

  // ───────────── ТО ─────────────
  maintenanceList: (_u: User): Row[] =>
    all(`SELECT m.*, c.brand || ' ' || c.model AS car_name, c.plate, w.name AS work_name,
                s.name AS new_status_name, e.full_name AS specialist_name
           FROM maintenance m
           JOIN cars c ON c.id=m.car_id
           JOIN work_types w ON w.id=m.work_type_id
           JOIN car_statuses s ON s.id=m.new_status_id
           LEFT JOIN employees e ON e.id=m.specialist_id
          ORDER BY m.id DESC`),

  /** Автомобили, ожидающие ТО, со сведениями из последнего акта возврата. */
  maintenanceQueue: (_u: User): Row[] =>
    all(`SELECT c.*, cl.name AS class_name,
                (SELECT r.damage FROM return_acts r JOIN contracts k ON k.id=r.contract_id
                  WHERE k.car_id=c.id ORDER BY r.id DESC LIMIT 1) AS damage
           FROM cars c JOIN car_classes cl ON cl.id=c.class_id
          WHERE c.status_id=4 ORDER BY c.code`),

  maintenanceSend: (_u: User, carId: number): void => {
    const c = one('SELECT status_id FROM cars WHERE id=?', carId)
    if (!c || ![CAR.free, CAR.booked].includes(c.status_id)) fail('Отправить на ТО можно только свободный автомобиль')
    run('UPDATE cars SET status_id=? WHERE id=?', CAR.service, carId)
  },

  maintenanceCreate: (u: User, p: Row): string =>
    tx(() => {
      const c = one('SELECT * FROM cars WHERE id=?', p.car_id)
      if (!c) fail('Автомобиль не найден')
      if (c.status_id === CAR.rented) fail('Автомобиль в аренде: ТО невозможно')
      if (!str(p.result)) fail('Опишите результат работ')
      if (![CAR.free, CAR.unavailable, CAR.service].includes(num(p.new_status_id))) fail('Выберите новый статус автомобиля')
      const mileage = num(p.mileage) || c.mileage
      if (mileage < c.mileage) fail(`Пробег не может быть меньше текущего (${c.mileage} км)`)
      const date = p.done_at ?? today()
      const code = nextCode('maintenance', 'TO-', 4)
      run(`INSERT INTO maintenance (code, car_id, work_type_id, done_at, mileage, result, specialist_id, new_status_id)
           VALUES (?,?,?,?,?,?,?,?)`, code, c.id, p.work_type_id, date, mileage, str(p.result), u.id, p.new_status_id)
      run('UPDATE cars SET status_id=?, mileage=?, last_service=? WHERE id=?', p.new_status_id, mileage, date, c.id)
      refreshBooked(c.id)
      return code
    }),

  // ───────────── Отчёт ─────────────
  report: (_u: User, p: Row): Row => {
    const { from, to } = p
    if (!from || !to || to < from) fail('Укажите корректный период')
    const periodDays = daysBetween(from, to)
    const contracts = num(one('SELECT COUNT(*) n FROM contracts WHERE contract_date BETWEEN ? AND ? AND status_id<>4', from, to)?.n)
    const bookings = num(one('SELECT COUNT(*) n FROM bookings WHERE created_at BETWEEN ? AND ?', from, to)?.n)
    const byType = all(
      `SELECT t.id, t.name, COALESCE(SUM(p.amount),0) AS sum, COUNT(p.id) AS cnt
         FROM payment_types t LEFT JOIN payments p ON p.type_id=t.id AND p.paid_at BETWEEN ? AND ?
        GROUP BY t.id ORDER BY t.id`, from, to)
    const sum = (id: number) => num(byType.find((t) => t.id === id)?.sum)
    const income = sum(PAY.rent) + sum(PAY.deposit) + sum(PAY.fine)
    const cars = all(`SELECT c.id, c.code, c.brand || ' ' || c.model AS name, c.plate FROM cars c ORDER BY c.code`).map((c) => {
      const rows = all(
        `SELECT date_from, date_to, rent_sum FROM contracts WHERE car_id=? AND status_id<>4 AND date_from<=? AND date_to>=?`,
        c.id, to, from
      )
      let days = 0
      for (const r of rows) {
        const a = r.date_from > from ? r.date_from : from
        const b = r.date_to < to ? r.date_to : to
        days += daysBetween(a, b)
      }
      return { ...c, contracts: rows.length, days, percent: Math.min(100, Math.round((days / periodDays) * 100)) }
    })
    return {
      from, to, periodDays, contracts, bookings, byType,
      income, refunds: sum(PAY.refund), net: income - sum(PAY.refund),
      cars, avgLoad: cars.length ? Math.round(cars.reduce((s, c) => s + c.percent, 0) / cars.length) : 0
    }
  }
}

function settlementCalc(contractId: number) {
  const { rentDue } = contractDue(contractId)
  const paidDeposit = num(one('SELECT SUM(amount) s FROM payments WHERE contract_id=? AND type_id=?', contractId, PAY.deposit)?.s)
  const refunded = num(one('SELECT SUM(amount) s FROM payments WHERE contract_id=? AND type_id=?', contractId, PAY.refund)?.s)
  const held = paidDeposit - refunded
  const fines = num(one('SELECT SUM(amount) s FROM fines WHERE contract_id=? AND paid=0', contractId)?.s)
  return { rentDue, held, fines, refund: Math.max(0, held - fines), extra: Math.max(0, fines - held) }
}

export type Services = typeof services

/** Клиентский режим без входа в систему (СРО 8, таблица 1, сценарии 1–3). */
export const publicApi = {
  publicClasses: (): Row[] => all('SELECT * FROM car_classes ORDER BY id'),

  /** Сценарий 1: поиск свободного автомобиля на даты. Показывает только сведения, нужные клиенту. */
  publicCars: (p: Row): Row[] =>
    availableCars(p).map((c) => ({
      id: c.id, brand: c.brand, model: c.model, year: c.year, color: c.color,
      class_name: c.class_name, price_per_day: c.price_per_day
    })),

  /** Сценарий 2: заявка на бронирование. Бронь создаётся со статусом «Создано», подтверждает её менеджер. */
  publicRequest: (p: Row): Row =>
    tx(() => {
      const iin = str(p.iin_bin)
      if (!/^\d{12}$/.test(iin)) fail('ИИН должен содержать 12 цифр')
      let client = one('SELECT * FROM clients WHERE iin_bin=?', iin)
      if (!client) {
        const id = services.clientsSave({} as User, {
          type_id: 1, full_name: p.full_name, iin_bin: iin, phone: p.phone, email: p.email,
          id_doc_no: p.id_doc_no, license_no: p.license_no, license_expiry: p.license_expiry
        })
        client = one('SELECT * FROM clients WHERE id=?', id)
      }
      const code = services.bookingsCreate({ id: 0 } as User, {
        client_id: client.id, car_id: p.car_id, date_from: p.date_from, date_to: p.date_to,
        note: 'Заявка клиента'
      })
      return { code, status: 'Создано' }
    }),

  /** Сценарий 3: статус бронирования по номеру брони и ИИН. */
  publicStatus: (p: Row): Row => {
    const r = one(
      `SELECT b.code, b.date_from, b.date_to, b.cancel_reason, s.name AS status_name,
              c.brand || ' ' || c.model AS car_name
         FROM bookings b JOIN clients cl ON cl.id=b.client_id
         JOIN cars c ON c.id=b.car_id JOIN booking_statuses s ON s.id=b.status_id
        WHERE b.code=? AND cl.iin_bin=?`,
      str(p.code).toUpperCase(), str(p.iin_bin)
    )
    if (!r) fail('Бронь не найдена. Проверьте номер брони и ИИН')
    return r
  }
}
