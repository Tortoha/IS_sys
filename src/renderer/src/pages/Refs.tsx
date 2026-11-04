import { useEffect, useState } from 'react'
import { Empty, ErrorLine, Field, Modal, ModalActions, PageHeader } from '../components'
import { cleanError, money, type Row } from '../types'

const extraTitle: Record<string, string> = { price_per_day: 'Цена за сутки, ₸', default_amount: 'Размер по умолчанию, ₸' }

export default function Refs() {
  const [meta, setMeta] = useState<Row[]>([])
  const [table, setTable] = useState('car_classes')
  const [rows, setRows] = useState<Row[]>([])
  const [form, setForm] = useState<Row | null>(null)
  const [error, setError] = useState('')

  const cur = meta.find((m) => m.table === table)
  const load = () => window.api.refList(table).then(setRows)

  useEffect(() => {
    window.api.refMeta().then(setMeta)
  }, [])
  useEffect(() => {
    load()
  }, [table]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    try {
      await window.api.refSave(table, form)
      setForm(null)
      load()
    } catch (e) {
      setError(cleanError(e))
    }
  }

  const remove = async (r: Row) => {
    if (!confirm(`Удалить «${r.name}»?`)) return
    try {
      await window.api.refDelete(table, r.id)
      load()
    } catch (e) {
      alert(cleanError(e))
    }
  }

  return (
    <>
      <PageHeader
        title="Справочники"
        action={
          cur?.editable &&
          table !== 'tariffs' && (
            <button className="btn primary" onClick={() => (setForm({ name: '' }), setError(''))}>
              Добавить значение
            </button>
          )
        }
      >
        <p className="muted">Значения, из которых выбираются данные в системе</p>
      </PageHeader>

      <div className="split">
        <div className="list">
          {meta.map((m) => (
            <button key={m.table} className={'list-item' + (m.table === table ? ' active' : '')} onClick={() => setTable(m.table)}>
              {m.title}
            </button>
          ))}
        </div>
        <div>
          {cur && !cur.editable && <p className="muted small">Значения этого справочника зафиксированы: от них зависит логика системы.</p>}
          {rows.length === 0 ? (
            <Empty text="Значений нет" />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>Код</th>
                  <th>Название</th>
                  {cur?.extra && <th className="num">{extraTitle[cur.extra]}</th>}
                  {cur?.editable && <th />}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="muted">{r.id}</td>
                    <td>{r.name}</td>
                    {cur?.extra && (
                      <td className="num">{r[cur.extra] ? money(r[cur.extra]) : cur.extra === 'default_amount' ? 'по акту' : '—'}</td>
                    )}
                    {cur?.editable && (
                      <td className="actions">
                        <button className="link" onClick={() => (setForm(r), setError(''))}>
                          Изменить
                        </button>
                        {table !== 'tariffs' && (
                          <button className="link danger" onClick={() => remove(r)}>
                            Удалить
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {form && cur && (
        <Modal title={form.id ? 'Изменение значения' : 'Новое значение'} onClose={() => setForm(null)}>
          <Field label="Название">
            <input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          {cur.extra && (
            <Field label={extraTitle[cur.extra]}>
              <input
                type="number"
                value={form[cur.extra] ?? ''}
                onChange={(e) => setForm({ ...form, [cur.extra]: e.target.value })}
              />
            </Field>
          )}
          <ErrorLine text={error} />
          <ModalActions onCancel={() => setForm(null)} onOk={save} ok="Сохранить" />
        </Modal>
      )}
    </>
  )
}
