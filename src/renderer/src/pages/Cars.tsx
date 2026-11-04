import { useState } from 'react'
import { Badge, Empty, ErrorLine, Field, KV, Modal, ModalActions, PageHeader, Search, useLoad, useRefs, match } from '../components'
import { ROLE, cleanError, dateRu, money, todayIso, type Row, type User } from '../types'

export default function Cars({ user }: { user: User }) {
  const [list, reload] = useLoad<Row[]>(() => window.api.carsList(), [])
  const refs = useRefs()
  const [form, setForm] = useState<Row | null>(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [hist, setHist] = useState<Row | null>(null)
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
              <th />
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
                <td className="actions">
                  <button className="link" onClick={async () => setHist(await window.api.carHistory(c.id))}>
                    История
                  </button>
                  {canEdit && (
                    <button className="link" onClick={() => (setForm(c), setError(''))}>
                      Изменить
                    </button>
                  )}
                  {user.role_id === ROLE.boss && (
                    <button className="link danger" onClick={() => remove(c)}>
                      Удалить
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {hist && <CarHistory h={hist} onClose={() => setHist(null)} />}

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
            <Field label="Полис ОС ГПО ВТС">
              <input value={form.osgpo_policy ?? ''} onChange={(e) => set('osgpo_policy', e.target.value)} />
            </Field>
            <Field label="ОС ГПО действует до">
              <input type="date" value={form.osgpo_until ?? ''} onChange={(e) => set('osgpo_until', e.target.value)} />
            </Field>
            <Field label="Полис КАСКО">
              <input value={form.kasko_policy ?? ''} onChange={(e) => set('kasko_policy', e.target.value)} />
            </Field>
            <Field label="КАСКО действует до">
              <input type="date" value={form.kasko_until ?? ''} onChange={(e) => set('kasko_until', e.target.value)} />
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

const policy = (num: string | null, until: string | null) => {
  if (!until) return <span className="muted">не указан</span>
  const expired = until < todayIso()
  return (
    <>
      {num ? `${num}, ` : ''}до {dateRu(until)}
      {expired && <span className="danger-text"> · истёк</span>}
    </>
  )
}

/** Карточка автомобиля: страхование, история ТО и технического осмотра, повреждения и страховые случаи. */
function CarHistory({ h, onClose }: { h: Row; onClose: () => void }) {
  const c = h.car
  return (
    <Modal title={`${c.brand} ${c.model} · ${c.plate}`} onClose={onClose} wide>
      <KV
        items={[
          ['Код / VIN', `${c.code}${c.vin ? ' · ' + c.vin : ''}`],
          ['Класс, год', `${c.class_name}, ${c.year}`],
          ['Пробег', `${c.mileage.toLocaleString('ru-RU')} км`],
          ['Последнее ТО', c.last_service ? dateRu(c.last_service) : 'не проводилось'],
          ['ОС ГПО ВТС', policy(c.osgpo_policy, c.osgpo_until)],
          ['КАСКО', policy(c.kasko_policy, c.kasko_until)]
        ]}
      />

      <h3>История ТО и технического осмотра</h3>
      {h.maintenance.length === 0 ? (
        <p className="muted">Записей нет</p>
      ) : (
        <table className="table compact">
          <tbody>
            {h.maintenance.map((m: Row) => (
              <tr key={m.code}>
                <td>{m.code}</td>
                <td>{dateRu(m.done_at)}</td>
                <td>{m.work_name}</td>
                <td className="wrap">{m.result}</td>
                <td className="num">{m.mileage.toLocaleString('ru-RU')} км</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>Повреждения и страховые случаи</h3>
      {h.returns.filter((r: Row) => r.damage).length === 0 ? (
        <p className="muted">Повреждений не зафиксировано</p>
      ) : (
        <table className="table compact">
          <tbody>
            {h.returns
              .filter((r: Row) => r.damage)
              .map((r: Row) => (
                <tr key={r.code}>
                  <td>{r.code}</td>
                  <td>{dateRu(r.return_date)}</td>
                  <td className="wrap">{r.damage}</td>
                  <td>{r.client_name}</td>
                  <td>{r.insurance_case ? <span className="badge blue">страховой случай</span> : ''}</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </Modal>
  )
}
