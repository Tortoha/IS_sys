import { useState } from 'react'
import { Empty, Modal, PageHeader, Search, useLoad, match, Badge } from '../components'
import ClientForm from './ClientForm'
import { cleanError, dateRu, money, todayIso, type Row } from '../types'

export default function Clients() {
  const [list, reload] = useLoad<Row[]>(() => window.api.clientsList(), [])
  const [form, setForm] = useState<Row | null>(null)
  const [history, setHistory] = useState<{ client: Row; rows: Row[]; bookings: Row[] } | null>(null)
  const [q, setQ] = useState('')

  const remove = async (c: Row) => {
    if (!confirm(`Удалить клиента ${c.full_name}?`)) return
    try {
      await window.api.clientsDelete(c.id)
      reload()
    } catch (e) {
      alert(cleanError(e))
    }
  }

  const shown = list.filter((c) => match(c, q))

  return (
    <>
      <PageHeader
        title="Клиенты"
        action={
          <>
            <Search value={q} onChange={setQ} placeholder="ФИО, ИИН, телефон" />
            <button className="btn primary" onClick={() => setForm({ type_id: 1, license_expiry: '' })}>
              Добавить клиента
            </button>
          </>
        }
      >
        <p className="muted">Всего клиентов: {list.length}</p>
      </PageHeader>

      {shown.length === 0 ? (
        <Empty text="Клиентов не найдено" />
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Код</th>
              <th>ФИО или наименование</th>
              <th>ИИН / БИН</th>
              <th>Телефон</th>
              <th>Водительское удостоверение</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.id}>
                <td className="muted">{c.code}</td>
                <td>
                  {c.full_name}
                  <div className="muted small">
                    {c.type_name}
                    {c.representative ? ` · ${c.representative}` : ''}
                  </div>
                </td>
                <td>{c.iin_bin}</td>
                <td>{c.phone}</td>
                <td>
                  {c.license_no}
                  <div className={'small ' + (c.license_expiry < todayIso() ? 'danger-text' : 'muted')}>
                    до {dateRu(c.license_expiry)}
                    {c.license_expiry < todayIso() && ' · истёк'}
                  </div>
                </td>
                <td className="actions">
                  <button
                    className="link"
                    onClick={async () => {
                      const h = await window.api.clientHistory(c.id)
                      setHistory({ client: c, rows: h.contracts, bookings: h.bookings })
                    }}
                  >
                    История
                  </button>
                  <button className="link" onClick={() => setForm(c)}>
                    Изменить
                  </button>
                  <button className="link danger" onClick={() => remove(c)}>
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {form && (
        <ClientForm
          initial={form}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null)
            reload()
          }}
        />
      )}

      {history && (
        <Modal title={`История аренд: ${history.client.full_name}`} onClose={() => setHistory(null)} wide>
          {history.rows.length === 0 && history.bookings.length === 0 ? (
            <Empty text="Аренд и броней пока не было" />
          ) : history.rows.length === 0 ? null : (
            <table className="table compact">
              <thead>
                <tr>
                  <th>Договор</th>
                  <th>Автомобиль</th>
                  <th>Период</th>
                  <th>Статус</th>
                  <th>Примечания</th>
                </tr>
              </thead>
              <tbody>
                {history.rows.map((h) => (
                  <tr key={h.id}>
                    <td>{h.code}</td>
                    <td>
                      {h.car_name}
                      <div className="muted small">{h.plate}</div>
                    </td>
                    <td>
                      {dateRu(h.date_from)} – {dateRu(h.date_to)}
                    </td>
                    <td>
                      <Badge text={h.status_name} />
                    </td>
                    <td className="small wrap">
                      {h.overdue ? <div>Просрочка возврата</div> : null}
                      {h.damage ? <div>Повреждения: {h.damage}</div> : null}
                      {h.unpaid_fines > 0 ? <div className="danger-text">Не оплачен штраф {money(h.unpaid_fines)}</div> : null}
                      {!h.overdue && !h.damage && !(h.unpaid_fines > 0) ? <span className="muted">Нарушений нет</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {history.bookings.length > 0 && (
            <>
              <h3>Бронирования</h3>
              <table className="table compact">
                <tbody>
                  {history.bookings.map((b) => (
                    <tr key={b.code}>
                      <td>{b.code}</td>
                      <td>
                        {b.car_name}
                        <div className="muted small">{b.plate}</div>
                      </td>
                      <td>
                        {dateRu(b.date_from)} – {dateRu(b.date_to)}
                      </td>
                      <td>
                        <Badge text={b.status_name} />
                        {b.cancel_reason && <div className="muted small">{b.cancel_reason}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          <div className="modal-actions">
            <button className="btn" onClick={() => setHistory(null)}>
              Закрыть
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
