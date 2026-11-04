import { useEffect, useMemo, useState } from 'react'
import { Empty, Field, Modal, PageHeader } from '../components'
import { dateRu, money, rentalStatus, type Car, type Client, type Rental } from '../types'

const today = () => new Date().toISOString().slice(0, 10)
const clean = (e: unknown) => (e as Error).message.replace(/^Error invoking remote method '.*?': Error: /, '')

export default function Rentals() {
  const [list, setList] = useState<Rental[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [cars, setCars] = useState<Car[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ client_id: 0, car_id: 0, date_from: today(), date_to: today() })
  const [error, setError] = useState('')

  const load = async () => {
    setList(await window.api.rentalsList())
    setClients(await window.api.clientsList())
    setCars(await window.api.carsList())
  }
  useEffect(() => {
    load()
  }, [])

  const freeCars = cars.filter((c) => c.status === 'free')
  const selected = cars.find((c) => c.id === form.car_id)
  const total = useMemo(() => {
    if (!selected || form.date_to < form.date_from) return 0
    const d = Math.round((+new Date(form.date_to) - +new Date(form.date_from)) / 86400000) + 1
    return d * selected.daily_price
  }, [selected, form.date_from, form.date_to])

  const create = async () => {
    if (!form.client_id || !form.car_id) return setError('Выберите клиента и автомобиль')
    try {
      await window.api.rentalsCreate(form)
      setOpen(false)
      setError('')
      load()
    } catch (e) {
      setError(clean(e))
    }
  }

  const finish = async (r: Rental, status: 'closed' | 'cancelled') => {
    const text = status === 'closed' ? 'Закрыть договор (автомобиль возвращён)?' : 'Отменить договор?'
    if (!confirm(text)) return
    await window.api.rentalsFinish(r.id, status)
    load()
  }

  return (
    <>
      <PageHeader
        title="Договоры проката"
        action={
          <button
            className="btn primary"
            onClick={() => {
              setForm({ client_id: 0, car_id: 0, date_from: today(), date_to: today() })
              setError('')
              setOpen(true)
            }}
          >
            Оформить прокат
          </button>
        }
      >
        <p className="muted">
          Активных: {list.filter((r) => r.status === 'active').length} · Свободных автомобилей:{' '}
          {freeCars.length}
        </p>
      </PageHeader>

      {list.length === 0 ? (
        <Empty text="Договоров пока нет" />
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>№</th>
              <th>Клиент</th>
              <th>Автомобиль</th>
              <th>Период</th>
              <th>Сумма</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.client_name}</td>
                <td>
                  {r.car_name}
                  <div className="muted small">{r.plate}</div>
                </td>
                <td>
                  {dateRu(r.date_from)} – {dateRu(r.date_to)}
                </td>
                <td>{money(r.total)}</td>
                <td>
                  <span className={'badge r-' + r.status}>{rentalStatus[r.status]}</span>
                </td>
                <td className="actions">
                  {r.status === 'active' && (
                    <>
                      <button className="link" onClick={() => finish(r, 'closed')}>
                        Закрыть
                      </button>
                      <button className="link danger" onClick={() => finish(r, 'cancelled')}>
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
        <Modal title="Новый договор проката" onClose={() => setOpen(false)}>
          <Field label="Клиент">
            <select
              value={form.client_id}
              onChange={(e) => setForm({ ...form, client_id: Number(e.target.value) })}
            >
              <option value={0}>Выберите клиента</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Автомобиль">
            <select
              value={form.car_id}
              onChange={(e) => setForm({ ...form, car_id: Number(e.target.value) })}
            >
              <option value={0}>Выберите автомобиль</option>
              {freeCars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.brand} {c.model} · {c.plate} · {money(c.daily_price)}/сут
                </option>
              ))}
            </select>
          </Field>
          <div className="grid2">
            <Field label="Дата выдачи">
              <input
                type="date"
                value={form.date_from}
                onChange={(e) => setForm({ ...form, date_from: e.target.value })}
              />
            </Field>
            <Field label="Дата возврата">
              <input
                type="date"
                value={form.date_to}
                min={form.date_from}
                onChange={(e) => setForm({ ...form, date_to: e.target.value })}
              />
            </Field>
          </div>
          <div className="total">
            <span>Итого</span>
            <strong>{money(total)}</strong>
          </div>
          {error && <p className="error">{error}</p>}
          <div className="modal-actions">
            <button className="btn" onClick={() => setOpen(false)}>
              Отмена
            </button>
            <button className="btn primary" onClick={create}>
              Оформить
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
