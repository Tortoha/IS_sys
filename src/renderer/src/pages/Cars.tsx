import { useState } from 'react'
import { Badge, Empty, ErrorLine, Field, Modal, ModalActions, PageHeader, Search, useLoad, useRefs, match } from '../components'
import { ROLE, cleanError, dateRu, money, type Row, type User } from '../types'

export default function Cars({ user }: { user: User }) {
  const [list, reload] = useLoad<Row[]>(() => window.api.carsList(), [])
  const refs = useRefs()
  const [form, setForm] = useState<Row | null>(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const canEdit = user.role_id === ROLE.manager || user.role_id === ROLE.boss

  const set = (k: string, v: string | number) => setForm((f: Row) => ({ ...f, [k]: v }))

  const save = async () => {
    try {
      await window.api.carsSave(form)
      setForm(null)
      reload()
    } catch (e) {
      setError(cleanError(e))
    }
  }

  const remove = async (c: Row) => {
    if (!confirm(`Удалить автомобиль ${c.brand} ${c.model}?`)) return
    try {
      await window.api.carsDelete(c.id)
      reload()
    } catch (e) {
      alert(cleanError(e))
    }
  }

  const shown = list.filter((c) => match(c, q))

  return (
    <>
      <PageHeader
        title="Автомобили"
        action={
          <>
            <Search value={q} onChange={setQ} placeholder="Марка, госномер, статус" />
            {canEdit && (
              <button
                className="btn primary"
                onClick={() => (setForm({ class_id: 1, year: new Date().getFullYear(), mileage: 0, status_id: 1 }), setError(''))}
              >
                Добавить автомобиль
              </button>
            )}
          </>
        }
      >
        <p className="muted">
          Всего: {list.length} · Свободно: {list.filter((c) => c.status_id === 1).length} · В аренде:{' '}
          {list.filter((c) => c.status_id === 3).length} · На ТО: {list.filter((c) => c.status_id === 4).length}
        </p>
      </PageHeader>

      {shown.length === 0 ? (
        <Empty text="Автомобилей не найдено" />
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Код</th>
              <th>Автомобиль</th>
              <th>Госномер</th>
              <th>Класс</th>
              <th>Пробег</th>
              <th>Последнее ТО</th>
              <th>Цена в сутки</th>
              <th>Статус</th>
              {canEdit && <th />}
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.id}>
                <td className="muted">{c.code}</td>
                <td>
                  {c.brand} {c.model}
                  <div className="muted small">
                    {c.year}
                    {c.color ? ` · ${c.color}` : ''}
                  </div>
                </td>
                <td>{c.plate}</td>
                <td>{c.class_name}</td>
                <td>{c.mileage.toLocaleString('ru-RU')} км</td>
                <td>{c.last_service ? dateRu(c.last_service) : '—'}</td>
                <td>{money(c.price_per_day)}</td>
                <td>
                  <Badge text={c.status_name} />
                </td>
                {canEdit && (
                  <td className="actions">
                    <button className="link" onClick={() => (setForm(c), setError(''))}>
                      Изменить
                    </button>
                    {user.role_id === ROLE.boss && (
                      <button className="link danger" onClick={() => remove(c)}>
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

      {form && (
        <Modal title={form.id ? 'Редактирование автомобиля' : 'Новый автомобиль'} onClose={() => setForm(null)}>
          <div className="grid2">
            <Field label="Марка">
              <input value={form.brand ?? ''} onChange={(e) => set('brand', e.target.value)} />
            </Field>
            <Field label="Модель">
              <input value={form.model ?? ''} onChange={(e) => set('model', e.target.value)} />
            </Field>
            <Field label="Госномер">
              <input placeholder="123 ABC 02" value={form.plate ?? ''} onChange={(e) => set('plate', e.target.value)} />
            </Field>
            <Field label="VIN">
              <input value={form.vin ?? ''} onChange={(e) => set('vin', e.target.value)} />
            </Field>
            <Field label="Год выпуска">
              <input type="number" value={form.year ?? ''} onChange={(e) => set('year', e.target.value)} />
            </Field>
            <Field label="Класс">
              <select value={form.class_id} onChange={(e) => set('class_id', Number(e.target.value))}>
                {refs.classes.map((c: Row) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Цвет">
              <input value={form.color ?? ''} onChange={(e) => set('color', e.target.value)} />
            </Field>
            <Field label="Пробег, км">
              <input type="number" value={form.mileage ?? 0} onChange={(e) => set('mileage', e.target.value)} />
            </Field>
          </div>
          {form.id && [1, 2, 5].includes(form.status_id) && (
            <Field label="Статус" hint="Остальные статусы система меняет сама: при брони, выдаче, возврате и ТО">
              <select value={form.status_id === 2 ? 1 : form.status_id} onChange={(e) => set('status_id', Number(e.target.value))}>
                <option value={1}>Свободен</option>
                <option value={5}>Недоступен</option>
              </select>
            </Field>
          )}
          <ErrorLine text={error} />
          <ModalActions onCancel={() => setForm(null)} onOk={save} ok="Сохранить" />
        </Modal>
      )}
    </>
  )
}
