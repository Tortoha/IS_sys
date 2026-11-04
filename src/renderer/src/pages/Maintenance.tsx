import { useState } from 'react'
import { Empty, ErrorLine, Field, Modal, ModalActions, PageHeader, useLoad, useRefs } from '../components'
import { addDaysIso, cleanError, dateRu, todayIso, type Row } from '../types'

const TO_DAYS = 180

export default function Maintenance() {
  const refs = useRefs()
  const [queue, reloadQ] = useLoad<Row[]>(() => window.api.maintenanceQueue(), [])
  const [history, reloadH] = useLoad<Row[]>(() => window.api.maintenanceList(), [])
  const [cars, reloadC] = useLoad<Row[]>(() => window.api.carsList(), [])
  const [form, setForm] = useState<Row | null>(null)
  const [send, setSend] = useState<number | null>(null)
  const [error, setError] = useState('')

  const reload = () => (reloadQ(), reloadH(), reloadC())
  const freeCars = cars.filter((c) => [1, 2].includes(c.status_id))
  const limit = addDaysIso(todayIso(), -TO_DAYS)
  const due = freeCars.filter((c) => !c.last_service || c.last_service < limit)

  const save = async () => {
    try {
      await window.api.maintenanceCreate(form)
      setForm(null)
      reload()
    } catch (e) {
      setError(cleanError(e))
    }
  }

  const doSend = async () => {
    try {
      await window.api.maintenanceSend(send)
      setSend(null)
      reload()
    } catch (e) {
      setError(cleanError(e))
    }
  }

  return (
    <>
      <PageHeader
        title="Техническое обслуживание"
        action={
          <button className="btn" onClick={() => (setSend(0), setError(''))}>
            Отправить автомобиль на ТО
          </button>
        }
      >
        <p className="muted">Ожидают ТО: {queue.length} · Выполнено работ: {history.length}</p>
      </PageHeader>

      <h3>Ожидают обслуживания</h3>
      {queue.length === 0 ? (
        <Empty text="Нет автомобилей на обслуживании" />
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Автомобиль</th>
              <th>Пробег</th>
              <th>Повреждения по акту возврата</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {queue.map((c) => (
              <tr key={c.id}>
                <td>
                  {c.brand} {c.model}
                  <div className="muted small">{c.plate}</div>
                </td>
                <td>{c.mileage.toLocaleString('ru-RU')} км</td>
                <td className="wrap">{c.damage || <span className="muted">нет сведений</span>}</td>
                <td className="actions">
                  <button
                    className="link"
                    onClick={() => (
                      setForm({ car_id: c.id, work_type_id: 1, done_at: todayIso(), mileage: c.mileage, result: '', new_status_id: 1, car: c }),
                      setError('')
                    )}
                  >
                    Записать результат
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {due.length > 0 && (
        <>
          <h3 className="section">Плановое ТО по сроку</h3>
          <p className="muted small">ТО не проводилось более {TO_DAYS} дней. Отправьте автомобиль на обслуживание, когда он свободен.</p>
          <table className="table">
            <tbody>
              {due.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.brand} {c.model}
                    <div className="muted small">{c.plate}</div>
                  </td>
                  <td>последнее ТО: {c.last_service ? dateRu(c.last_service) : 'не проводилось'}</td>
                  <td className="actions">
                    <button
                      className="link"
                      onClick={async () => {
                        try {
                          await window.api.maintenanceSend(c.id)
                          reload()
                        } catch (e) {
                          alert(cleanError(e))
                        }
                      }}
                    >
                      Отправить на ТО
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h3 className="section">История работ</h3>
      {history.length === 0 ? (
        <Empty text="Записей о ТО пока нет" />
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Запись</th>
              <th>Автомобиль</th>
              <th>Вид работ</th>
              <th>Дата</th>
              <th>Результат</th>
              <th>Новый статус</th>
            </tr>
          </thead>
          <tbody>
            {history.map((m) => (
              <tr key={m.id}>
                <td>{m.code}</td>
                <td>
                  {m.car_name}
                  <div className="muted small">{m.plate}</div>
                </td>
                <td>{m.work_name}</td>
                <td>{dateRu(m.done_at)}</td>
                <td className="wrap">{m.result}</td>
                <td>{m.new_status_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {form && (
        <Modal title={`ТО: ${form.car.brand} ${form.car.model}, ${form.car.plate}`} onClose={() => setForm(null)}>
          {form.car.damage && <p className="warn">Повреждения по акту: {form.car.damage}</p>}
          <div className="grid2">
            <Field label="Вид работ">
              <select value={form.work_type_id} onChange={(e) => setForm({ ...form, work_type_id: Number(e.target.value) })}>
                {refs.workTypes.map((w: Row) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Дата">
              <input type="date" value={form.done_at} onChange={(e) => setForm({ ...form, done_at: e.target.value })} />
            </Field>
            <Field label="Пробег, км">
              <input type="number" value={form.mileage} onChange={(e) => setForm({ ...form, mileage: e.target.value })} />
            </Field>
            <Field label="Новый статус автомобиля">
              <select value={form.new_status_id} onChange={(e) => setForm({ ...form, new_status_id: Number(e.target.value) })}>
                <option value={1}>Свободен</option>
                <option value={4}>Остаётся на ТО</option>
                <option value={5}>Недоступен</option>
              </select>
            </Field>
          </div>
          <Field label="Результат работ">
            <input
              placeholder="Например: заменено масло и фильтры"
              value={form.result}
              onChange={(e) => setForm({ ...form, result: e.target.value })}
            />
          </Field>
          <ErrorLine text={error} />
          <ModalActions onCancel={() => setForm(null)} onOk={save} ok="Сохранить" />
        </Modal>
      )}

      {send !== null && (
        <Modal title="Отправить автомобиль на ТО" onClose={() => setSend(null)}>
          <Field label="Автомобиль" hint="Только свободные автомобили. На время ТО он не будет выдаваться и бронироваться">
            <select value={send} onChange={(e) => setSend(Number(e.target.value))}>
              <option value={0}>Выберите автомобиль</option>
              {freeCars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.brand} {c.model} · {c.plate}
                </option>
              ))}
            </select>
          </Field>
          <ErrorLine text={error} />
          <ModalActions onCancel={() => setSend(null)} onOk={doSend} ok="Отправить" disabled={!send} />
        </Modal>
      )}
    </>
  )
}
