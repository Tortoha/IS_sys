import { useEffect, useState } from 'react'
import { Badge, Empty, ErrorLine, Field, KV, Modal, ModalActions, Tabs } from '../components'
import { addDaysIso, cleanError, daysCount, dateRu, money, todayIso, type Row } from '../types'

/**
 * Клиентский режим (СРО 8, таблица 1): клиент-арендатор без входа в систему
 * ищет свободный автомобиль, подаёт заявку на бронирование и смотрит статус брони.
 */
export default function ClientPortal({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState('search')
  return (
    <div className="portal">
      <header className="portal-head">
        <div>
          <h1>Прокат автомобилей</h1>
          <p className="muted">Подбор автомобиля и бронирование</p>
        </div>
        <button className="btn" onClick={onBack}>
          Вход для сотрудников
        </button>
      </header>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          ['search', 'Найти автомобиль'],
          ['status', 'Статус бронирования']
        ]}
      />
      <div className="portal-body">{tab === 'search' ? <Search /> : <Status />}</div>
    </div>
  )
}

function Search() {
  const [classes, setClasses] = useState<Row[]>([])
  const [f, setF] = useState({ date_from: addDaysIso(todayIso(), 1), date_to: addDaysIso(todayIso(), 3), class_id: 0 })
  const [cars, setCars] = useState<Row[] | null>(null)
  const [error, setError] = useState('')
  const [pick, setPick] = useState<Row | null>(null)
  const [done, setDone] = useState<Row | null>(null)

  const search = async () => {
    try {
      setCars(await window.api.publicCars({ ...f, class_id: f.class_id || undefined }))
      setError('')
    } catch (e) {
      setError(cleanError(e))
      setCars(null)
    }
  }

  useEffect(() => {
    window.api.publicClasses().then(setClasses)
    search()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const days = daysCount(f.date_from, f.date_to)

  return (
    <>
      <div className="period">
        <Field label="Дата начала">
          <input type="date" min={todayIso()} value={f.date_from} onChange={(e) => setF({ ...f, date_from: e.target.value })} />
        </Field>
        <Field label="Дата окончания">
          <input type="date" min={f.date_from} value={f.date_to} onChange={(e) => setF({ ...f, date_to: e.target.value })} />
        </Field>
        <Field label="Класс">
          <select value={f.class_id} onChange={(e) => setF({ ...f, class_id: Number(e.target.value) })}>
            <option value={0}>Любой</option>
            {classes.map((c: Row) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <button className="btn primary" onClick={search}>
          Найти
        </button>
      </div>
      <ErrorLine text={error} />

      {cars && cars.length === 0 && <Empty text="На эти даты свободных автомобилей нет. Измените даты или класс" />}
      {cars && cars.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Автомобиль</th>
              <th>Класс</th>
              <th>Цена в сутки</th>
              <th>Стоимость за {days} сут.</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {cars.map((c) => (
              <tr key={c.id}>
                <td>
                  {c.brand} {c.model}
                  <div className="muted small">
                    {c.year}
                    {c.color ? ` · ${c.color}` : ''}
                  </div>
                </td>
                <td>{c.class_name}</td>
                <td>{money(c.price_per_day)}</td>
                <td>{money(c.price_per_day * days)}</td>
                <td className="actions">
                  <button className="btn primary" onClick={() => setPick(c)}>
                    Забронировать
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {pick && <Request car={pick} dates={f} onClose={() => setPick(null)} onDone={(r) => (setPick(null), setDone(r), search())} />}
      {done && (
        <Modal title="Заявка принята" onClose={() => setDone(null)}>
          <KV items={[['Номер брони', <strong key="c">{done.code}</strong>], ['Статус', 'Создано']]} />
          <p className="muted">
            Сохраните номер брони и ИИН: по ним можно узнать статус. Менеджер подтвердит бронь и свяжется с вами по телефону.
          </p>
          <div className="modal-actions">
            <button className="btn primary" onClick={() => setDone(null)}>
              Готово
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

function Request(props: { car: Row; dates: Row; onClose: () => void; onDone: (r: Row) => void }) {
  const [f, setF] = useState<Row>({ full_name: '', iin_bin: '', phone: '', id_doc_no: '', license_no: '', license_expiry: '' })
  const [error, setError] = useState('')
  const set = (k: string, v: string) => setF((x: Row) => ({ ...x, [k]: v }))

  const submit = async () => {
    try {
      props.onDone(await window.api.publicRequest({ ...f, car_id: props.car.id, date_from: props.dates.date_from, date_to: props.dates.date_to }))
    } catch (e) {
      setError(cleanError(e))
    }
  }

  return (
    <Modal title={`Заявка: ${props.car.brand} ${props.car.model}`} onClose={props.onClose}>
      <p className="muted">
        {dateRu(props.dates.date_from)} – {dateRu(props.dates.date_to)}, {money(props.car.price_per_day * daysCount(props.dates.date_from, props.dates.date_to))}
      </p>
      <Field label="ФИО">
        <input value={f.full_name} onChange={(e) => set('full_name', e.target.value)} />
      </Field>
      <div className="grid2">
        <Field label="ИИН">
          <input maxLength={12} value={f.iin_bin} onChange={(e) => set('iin_bin', e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field label="Телефон">
          <input placeholder="+7 700 000 00 00" value={f.phone} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label="Номер удостоверения личности">
          <input value={f.id_doc_no} onChange={(e) => set('id_doc_no', e.target.value)} />
        </Field>
        <Field label="Водительское удостоверение">
          <input value={f.license_no} onChange={(e) => set('license_no', e.target.value)} />
        </Field>
        <Field label="Действует до">
          <input type="date" value={f.license_expiry} onChange={(e) => set('license_expiry', e.target.value)} />
        </Field>
      </div>
      <p className="muted small">Если вы уже наш клиент, достаточно ИИН: остальные данные берутся из базы.</p>
      <ErrorLine text={error} />
      <ModalActions onCancel={props.onClose} onOk={submit} ok="Отправить заявку" />
    </Modal>
  )
}

function Status() {
  const [f, setF] = useState({ code: '', iin_bin: '' })
  const [res, setRes] = useState<Row | null>(null)
  const [error, setError] = useState('')

  const check = async () => {
    try {
      setRes(await window.api.publicStatus(f))
      setError('')
    } catch (e) {
      setRes(null)
      setError(cleanError(e))
    }
  }

  return (
    <div className="panel">
      <div className="grid2">
        <Field label="Номер брони">
          <input placeholder="B-2026-0001" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
        </Field>
        <Field label="ИИН">
          <input maxLength={12} value={f.iin_bin} onChange={(e) => setF({ ...f, iin_bin: e.target.value.replace(/\D/g, '') })} />
        </Field>
      </div>
      <ErrorLine text={error} />
      <button className="btn primary" onClick={check}>
        Узнать статус
      </button>
      {res && (
        <div style={{ marginTop: 24 }}>
          <KV
            items={[
              ['Бронь', res.code],
              ['Статус', <Badge key="s" text={res.status_name} />],
              ['Автомобиль', res.car_name],
              ['Даты', `${dateRu(res.date_from)} – ${dateRu(res.date_to)}`],
              ...(res.cancel_reason ? ([['Причина отмены', res.cancel_reason]] as [string, string][]) : [])
            ]}
          />
        </div>
      )}
    </div>
  )
}
