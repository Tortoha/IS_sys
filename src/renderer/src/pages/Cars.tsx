import { useEffect, useState } from 'react'
import { Empty, Field, Modal, PageHeader } from '../components'
import { carStatus, money, type Car } from '../types'

type Form = Partial<Car>

export default function Cars() {
  const [list, setList] = useState<Car[]>([])
  const [form, setForm] = useState<Form | null>(null)
  const [error, setError] = useState('')

  const load = () => window.api.carsList().then(setList)
  useEffect(() => {
    load()
  }, [])

  const set = (k: keyof Car, v: string | number) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    try {
      await window.api.carsSave({
        id: form?.id,
        brand: (form?.brand ?? '').trim(),
        model: (form?.model ?? '').trim(),
        plate: (form?.plate ?? '').trim().toUpperCase(),
        vin: form?.vin?.trim() || null,
        year: Number(form?.year),
        daily_price: Number(form?.daily_price),
        status: form?.status
      })
      setForm(null)
      setError('')
      load()
    } catch (e) {
      setError((e as Error).message.replace(/^Error invoking remote method '.*?': Error: /, ''))
    }
  }

  const remove = async (c: Car) => {
    if (!confirm(`Удалить автомобиль ${c.brand} ${c.model}?`)) return
    try {
      await window.api.carsDelete(c.id)
      load()
    } catch (e) {
      alert((e as Error).message)
    }
  }

  return (
    <>
      <PageHeader
        title="Автомобили"
        action={
          <button className="btn primary" onClick={() => (setForm({ status: 'free' }), setError(''))}>
            Добавить
          </button>
        }
      >
        <p className="muted">Всего в автопарке: {list.length}</p>
      </PageHeader>

      {list.length === 0 ? (
        <Empty text="Автомобилей пока нет" />
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Автомобиль</th>
              <th>Госномер</th>
              <th>Год</th>
              <th>Цена в сутки</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id}>
                <td>
                  {c.brand} {c.model}
                </td>
                <td>{c.plate}</td>
                <td>{c.year}</td>
                <td>{money(c.daily_price)}</td>
                <td>
                  <span className={'badge ' + c.status}>{carStatus[c.status]}</span>
                </td>
                <td className="actions">
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
        <Modal title={form.id ? 'Редактирование' : 'Новый автомобиль'} onClose={() => setForm(null)}>
          <div className="grid2">
            <Field label="Марка">
              <input value={form.brand ?? ''} onChange={(e) => set('brand', e.target.value)} />
            </Field>
            <Field label="Модель">
              <input value={form.model ?? ''} onChange={(e) => set('model', e.target.value)} />
            </Field>
            <Field label="Госномер">
              <input value={form.plate ?? ''} onChange={(e) => set('plate', e.target.value)} />
            </Field>
            <Field label="VIN">
              <input value={form.vin ?? ''} onChange={(e) => set('vin', e.target.value)} />
            </Field>
            <Field label="Год выпуска">
              <input
                type="number"
                value={form.year ?? ''}
                onChange={(e) => set('year', e.target.value)}
              />
            </Field>
            <Field label="Цена в сутки, ₸">
              <input
                type="number"
                value={form.daily_price ?? ''}
                onChange={(e) => set('daily_price', e.target.value)}
              />
            </Field>
          </div>
          {form.id && form.status !== 'rented' && (
            <Field label="Статус">
              <select value={form.status} onChange={(e) => set('status', e.target.value)}>
                <option value="free">{carStatus.free}</option>
                <option value="service">{carStatus.service}</option>
              </select>
            </Field>
          )}
          {error && <p className="error">{error}</p>}
          <div className="modal-actions">
            <button className="btn" onClick={() => setForm(null)}>
              Отмена
            </button>
            <button className="btn primary" onClick={save}>
              Сохранить
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
