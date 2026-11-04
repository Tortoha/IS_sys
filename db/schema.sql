-- Схема БД информационной системы «Прокат автомобилей» (SQLite)
-- Основана на СРО 10: 9 информационных объектов и 11 справочников.

PRAGMA foreign_keys = ON;

-- ───────────── Справочники ─────────────
CREATE TABLE IF NOT EXISTS car_classes       (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS car_statuses      (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS booking_statuses  (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS contract_statuses (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS payment_methods   (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS payment_types     (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS work_types        (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS roles             (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS client_types      (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);

CREATE TABLE IF NOT EXISTS tariffs (
  id           INTEGER PRIMARY KEY,
  class_id     INTEGER NOT NULL UNIQUE REFERENCES car_classes(id),
  name         TEXT NOT NULL UNIQUE,
  price_per_day INTEGER NOT NULL CHECK (price_per_day > 0)
);

CREATE TABLE IF NOT EXISTS fine_types (
  id             INTEGER PRIMARY KEY,
  name           TEXT NOT NULL UNIQUE,
  default_amount INTEGER NOT NULL DEFAULT 0   -- 0: размер задаётся по акту или постановлению
);

CREATE TABLE IF NOT EXISTS extra_services (
  id            INTEGER PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  price_per_day INTEGER NOT NULL CHECK (price_per_day >= 0)
);

-- ───────────── Информационные объекты ─────────────
CREATE TABLE IF NOT EXISTS employees (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT NOT NULL UNIQUE,                 -- S-005
  full_name     TEXT NOT NULL,
  role_id       INTEGER NOT NULL REFERENCES roles(id),
  login         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  active        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS cars (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT NOT NULL UNIQUE,                 -- A-0012
  brand         TEXT NOT NULL,
  model         TEXT NOT NULL,
  plate         TEXT NOT NULL UNIQUE,                 -- 123 ABC 02
  vin           TEXT UNIQUE,
  year          INTEGER NOT NULL,
  class_id      INTEGER NOT NULL REFERENCES car_classes(id),
  color         TEXT,
  mileage       INTEGER NOT NULL DEFAULT 0 CHECK (mileage >= 0),
  status_id     INTEGER NOT NULL DEFAULT 1 REFERENCES car_statuses(id),
  last_service  TEXT                                  -- дата последнего ТО
);

CREATE TABLE IF NOT EXISTS clients (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  code           TEXT NOT NULL UNIQUE,                -- K-00458
  type_id        INTEGER NOT NULL DEFAULT 1 REFERENCES client_types(id),
  full_name      TEXT NOT NULL,                       -- ФИО или наименование
  iin_bin        TEXT NOT NULL UNIQUE CHECK (length(iin_bin) = 12),
  phone          TEXT NOT NULL,
  email          TEXT,
  id_doc_no      TEXT,                                -- удостоверение личности
  license_no     TEXT NOT NULL,                       -- водительское удостоверение
  license_expiry TEXT NOT NULL,
  representative TEXT                                -- представитель юридического лица
);

CREATE TABLE IF NOT EXISTS bookings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,                   -- B-2026-0145
  client_id   INTEGER NOT NULL REFERENCES clients(id),
  car_id      INTEGER NOT NULL REFERENCES cars(id),
  date_from   TEXT NOT NULL,
  date_to     TEXT NOT NULL,
  status_id   INTEGER NOT NULL DEFAULT 1 REFERENCES booking_statuses(id),
  created_at  TEXT NOT NULL,
  employee_id INTEGER REFERENCES employees(id),
  note        TEXT,
  cancel_reason TEXT,
  CHECK (date_to >= date_from)
);

CREATE TABLE IF NOT EXISTS contracts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT NOT NULL UNIQUE,                 -- D-2026-0098
  contract_date TEXT NOT NULL,
  booking_id    INTEGER REFERENCES bookings(id),
  client_id     INTEGER NOT NULL REFERENCES clients(id),
  car_id        INTEGER NOT NULL REFERENCES cars(id),
  tariff_id     INTEGER NOT NULL REFERENCES tariffs(id),
  price_per_day INTEGER NOT NULL,                     -- цена тарифа на момент договора
  date_from     TEXT NOT NULL,
  date_to       TEXT NOT NULL,
  rent_sum      INTEGER NOT NULL,                     -- сумма аренды, тенге
  deposit       INTEGER NOT NULL DEFAULT 0,           -- размер залога, тенге
  status_id     INTEGER NOT NULL DEFAULT 1 REFERENCES contract_statuses(id),
  issue_mileage INTEGER NOT NULL,
  issue_fuel    TEXT NOT NULL,
  issue_note    TEXT,
  employee_id   INTEGER REFERENCES employees(id),
  settled       INTEGER NOT NULL DEFAULT 0,           -- расчёт по штрафам и залогу выполнен кассиром
  CHECK (date_to >= date_from)
);

CREATE TABLE IF NOT EXISTS contract_services (
  contract_id   INTEGER NOT NULL REFERENCES contracts(id),
  service_id    INTEGER NOT NULL REFERENCES extra_services(id),
  price_per_day INTEGER NOT NULL,
  PRIMARY KEY (contract_id, service_id)
);

CREATE TABLE IF NOT EXISTS payments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,                   -- P-2026-0311
  contract_id INTEGER NOT NULL REFERENCES contracts(id),
  type_id     INTEGER NOT NULL REFERENCES payment_types(id),
  amount      INTEGER NOT NULL CHECK (amount > 0),
  paid_at     TEXT NOT NULL,
  method_id   INTEGER NOT NULL REFERENCES payment_methods(id),
  ref_no      TEXT,                                   -- подтверждение банка (Kaspi QR)
  cashier_id  INTEGER REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS return_acts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,                   -- A-2026-0087
  contract_id INTEGER NOT NULL UNIQUE REFERENCES contracts(id),
  return_date TEXT NOT NULL,
  mileage     INTEGER NOT NULL,
  fuel        TEXT NOT NULL,
  damage      TEXT,
  employee_id INTEGER REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS fines (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT NOT NULL UNIQUE,                   -- SH-0012
  contract_id INTEGER NOT NULL REFERENCES contracts(id),
  type_id     INTEGER NOT NULL REFERENCES fine_types(id),
  amount      INTEGER NOT NULL CHECK (amount > 0),
  fined_at    TEXT NOT NULL,
  paid        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS maintenance (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT NOT NULL UNIQUE,                 -- TO-0054
  car_id        INTEGER NOT NULL REFERENCES cars(id),
  work_type_id  INTEGER NOT NULL REFERENCES work_types(id),
  done_at       TEXT NOT NULL,
  mileage       INTEGER NOT NULL,
  result        TEXT NOT NULL,
  specialist_id INTEGER REFERENCES employees(id),
  new_status_id INTEGER NOT NULL REFERENCES car_statuses(id)
);

CREATE INDEX IF NOT EXISTS idx_bookings_car   ON bookings(car_id, status_id);
CREATE INDEX IF NOT EXISTS idx_contracts_car  ON contracts(car_id, status_id);
CREATE INDEX IF NOT EXISTS idx_contracts_cl   ON contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_ctr   ON payments(contract_id);
CREATE INDEX IF NOT EXISTS idx_fines_ctr      ON fines(contract_id);
