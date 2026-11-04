import { useEffect, useState } from 'react'
import { Badge, Empty, ErrorLine, Field, Modal, ModalActions, PageHeader, Search, useLoad, useRefs, match } from '../components'
import ContractForm from './ContractForm'
import { addDaysIso, cleanError, dateRu, money, todayIso, type Row } from '../types'

export default function Bookings() {
  const [list, reload] = useLoad<Row[]>(() => window.api.bookingsList(), [])
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [issue, setIssue] = useState<Row | null>(null)
  const [notice, setNotice] = useState('')

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
      reload()
    } catch (e) {
      alert(cleanError(e))
    }
  }

  const shown = list.filter((b) => match(b, q))

  return (
    <>
      <PageHeader
        title="Бронирования"
        action={
          <>
            <Search value={q} onChange={setQ} placeholder="Номер, клиент, автомобиль" />
            <button className="btn primary" onClick={() => setOpen(true)}>
              Создать бронь
            </button>
          </>
        }
      >
        <p className="muted">
          Активных: {list.filter((b) => [1, 2].includes(b.status_id)).length} · Всего: {list.length}
        </p>
      </PageHeader>

      {notice && <p className="info">{notice}</p>}

      {shown.length === 0 ? (
        <Empty text="Броней пока нет" />
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Номер</th>
              <th>Клиент</th>
              <th>Автомобиль</th>
              <th>Период</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((b) => (
              <tr key={b.id}>
                <td className="wrap">
                  {b.code}
                  {b.note && <div className="muted small">{b.note}</div>}
                </td>
                <td>
                  {b.client_name}
                  <div className="muted small">{b.phone}</div>
                </td>
                <td>
                  {b.car_name}
                  <div className="muted small">{b.plate}</div>
                </td>
                <td className="dates">
                  {dateRu(b.date_from)} – {dateRu(b.date_to)}
                </td>
                <td>
                  <Badge text={b.status_name} />
                </td>
                <td className="actions">
                  {b.status_id === 1 && (
                    <button className="link" onClick={() => act(() => window.api.bookingsConfirm(b.id))}>
                      Подтвердить
                    </button>
                  )}
                  {[1, 2].includes(b.status_id) && (
                    <>
                      <button className="link" onClick={() => setIssue(b)}>
                        Выдать
                      </button>
                      <button
                        className="link danger"
                        onClick={() => confirm(`Отменить бронь ${b.code}?`) && act(() => window.api.bookingsCancel(b.id))}
                      >
                        Отменить
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {open && (
        <BookingForm
          onClose={() => setOpen(false)}
          onDone={(code) => {
            setOpen(false)
            setNotice(`Бронь ${code} зарегистрирована. Подтвердите её клиенту.`)
            reload()
          }}
        />
      )}
      {issue && (
        <ContractForm
          booking={issue}
          onClose={() => setIssue(null)}
          onDone={(code) => {
            setIssue(null)
            setNotice(`Договор ${code} оформлен, автомобиль выдан. Клиента ждёт оплата у кассира.`)
            reload()
          }}
        />
      )}
    </>
  )
}

function BookingForm(props: { onClose: () => void; onDone: (code: string) => void }) {
  const refs = useRefs()
  const [clients, setClients] = useState<Row[]>([])
  const [cars, setCars] = useState<Row[]>([])
  const [f, setF] = useState({ client_id: 0, car_id: 0, class_id: 0, date_from: addDaysIso(todayIso(), 1), date_to: addDaysIso(todayIso(), 3), note: '' })
  const [error, setError] = useState('')

  useEffect(() => {
    window.api.clientsList().then(setClients)
  }, [])

  useEffect(() => {
    if (f.date_to >= f.date_from) {
      window.api.carsAvailable({ date_from: f.date_from, date_to: f.date_to, class_id: f.class_id || undefined }).then(setCars)
    } else setCars([])
  }, [f.date_from, f.date_to, f.class_id])

  const submit = async () => {
    try {
      props.onDone(await window.api.bookingsCreate(f))
    } catch (e) {
      setError(cleanError(e))
    }
  }

  return (
    <Modal title="Новая бронь" onClose={props.onClose}>
      <div className="grid2">
        <Field label="Дата начала">
          <input type="date" value={f.date_from} onChange={(e) => setF({ ...f, date_from: e.target.value, car_id: 0 })} />
        </Field>
        <Field label="Дата окончания">
          <input type="date" min={f.date_from} value={f.date_to} onChange={(e) => setF({ ...f, date_to: e.target.value, car_id: 0 })} />
        </Field>
      </div>
      <Field label="Класс автомобиля">
        <select value={f.class_id} onChange={(e) => setF({ ...f, class_id: Number(e.target.value), car_id: 0 })}>
          <option value={0}>Любой</option>
          {refs.classes.map((c: Row) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Автомобиль" hint={`Свободно на эти даты: ${cars.length}`}>
        <select value={f.car_id} onChange={(e) => setF({ ...f, car_id: Number(e.target.value) })}>
          <option value={0}>Выберите автомобиль</option>
          {cars.map((c) => (
            <option key={c.id} value={c.id}>
              {c.brand} {c.model} · {c.class_name} · {money(c.price_per_day)}/сут
            </option>
          ))}
        </select>
      </Field>
      <Field label="Клиент">
        <select value={f.client_id} onChange={(e) => setF({ ...f, client_id: Number(e.target.value) })}>
          <option value={0}>Выберите клиента</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name} · {c.iin_bin}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Примечание">
        <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      </Field>
      <ErrorLine text={error} />
      <ModalActions onCancel={props.onClose} onOk={submit} ok="Зарегистрировать" />
    </Modal>
  )
}
