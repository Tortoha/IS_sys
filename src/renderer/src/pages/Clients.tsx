import { useState } from 'react'
import { Empty, ErrorLine, Field, Modal, ModalActions, PageHeader, Search, useLoad, useRefs, match, Badge } from '../components'
import { cleanError, dateRu, money, todayIso, type Row } from '../types'

export default function Clients() {
  const [list, reload] = useLoad<Row[]>(() => window.api.clientsList(), [])
  const refs = useRefs()
  const [form, setForm] = useState<Row | null>(null)
  const [history, setHistory] = useState<{ client: Row; rows: Row[] } | null>(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')

  const set = (k: string, v: string | number) => setForm((f: Row) => ({ ...f, [k]: v }))
  const legal = form?.type_id === 2

  const save = async () => {
    try {
      await window.api.clientsSave(form)
      setForm(null)
      reload()
    } catch (e) {
      setError(cleanError(e))
    }
  }

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
            <button className="btn primary" onClick={() => (setForm({ type_id: 1, license_expiry: '' }), setError(''))}>
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
                  <div className="muted small">{c.type_name}</div>
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
                    onClick={async () => setHistory({ client: c, rows: await window.api.clientHistory(c.id) })}
                  >
                    История
                  </button>
                  <button className="link" onClick={() => (setForm(c), setError(''))}>
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
        <Modal title={form.id ? 'Редактирование клиента' : 'Новый клиент'} onClose={() => setForm(null)}>
          <Field label="Тип клиента">
            <select value={form.type_id} onChange={(e) => set('type_id', Number(e.target.value))}>
              {refs.clientTypes.map((t: Row) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={legal ? 'Наименование' : 'ФИО'}>
            <input value={form.full_name ?? ''} onChange={(e) => set('full_name', e.target.value)} />
          </Field>
          <div className="grid2">
            <Field label={legal ? 'БИН' : 'ИИН'}>
              <input
                maxLength={12}
                value={form.iin_bin ?? ''}
                onChange={(e) => set('iin_bin', e.target.value.replace(/\D/g, ''))}
              />
            </Field>
            <Field label="Телефон">
              <input placeholder="+7 700 000 00 00" value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
            </Field>
            <Field label="Электронная почта">
              <input value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
            </Field>
            <Field label="Номер удостоверения личности">
              <input value={form.id_doc_no ?? ''} onChange={(e) => set('id_doc_no', e.target.value)} />
            </Field>
            <Field label="Водительское удостоверение">
              <input value={form.license_no ?? ''} onChange={(e) => set('license_no', e.target.value)} />
            </Field>
            <Field label="Действует до">
              <input type="date" value={form.license_expiry ?? ''} onChange={(e) => set('license_expiry', e.target.value)} />
            </Field>
          </div>
          <ErrorLine text={error} />
          <ModalActions onCancel={() => setForm(null)} onOk={save} ok="Сохранить" />
        </Modal>
      )}

      {history && (
        <Modal title={`История аренд: ${history.client.full_name}`} onClose={() => setHistory(null)} wide>
          {history.rows.length === 0 ? (
            <Empty text="Аренд пока не было" />
          ) : (
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
