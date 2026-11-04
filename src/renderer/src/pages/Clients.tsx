import { useEffect, useState } from 'react'
import { Empty, Field, Modal, PageHeader } from '../components'
import type { Client } from '../types'

type Form = Partial<Client>

export default function Clients() {
  const [list, setList] = useState<Client[]>([])
  const [form, setForm] = useState<Form | null>(null)
  const [error, setError] = useState('')

  const load = () => window.api.clientsList().then(setList)
  useEffect(() => {
    load()
  }, [])

  const set = (k: keyof Client, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    const iin = (form?.iin ?? '').trim()
    if (!/^\d{12}$/.test(iin)) return setError('ИИН должен содержать 12 цифр')
    try {
      await window.api.clientsSave({
        id: form?.id,
        full_name: (form?.full_name ?? '').trim(),
        iin,
        phone: (form?.phone ?? '').trim(),
        license_no: (form?.license_no ?? '').trim()
      })
      setForm(null)
      setError('')
      load()
    } catch (e) {
      setError((e as Error).message.replace(/^Error invoking remote method '.*?': Error: /, ''))
    }
  }

  const remove = async (c: Client) => {
    if (!confirm(`Удалить клиента ${c.full_name}?`)) return
    try {
      await window.api.clientsDelete(c.id)
      load()
    } catch (e) {
      alert((e as Error).message.replace(/^Error invoking remote method '.*?': Error: /, ''))
    }
  }

  return (
    <>
      <PageHeader
        title="Клиенты"
        action={
          <button className="btn primary" onClick={() => (setForm({}), setError(''))}>
            Добавить
          </button>
        }
      >
        <p className="muted">Всего клиентов: {list.length}</p>
      </PageHeader>

      {list.length === 0 ? (
        <Empty text="Клиентов пока нет" />
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>ФИО</th>
              <th>ИИН</th>
              <th>Телефон</th>
              <th>Водительское удостоверение</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id}>
                <td>{c.full_name}</td>
                <td>{c.iin}</td>
                <td>{c.phone}</td>
                <td>{c.license_no}</td>
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
        <Modal title={form.id ? 'Редактирование' : 'Новый клиент'} onClose={() => setForm(null)}>
          <Field label="ФИО">
            <input value={form.full_name ?? ''} onChange={(e) => set('full_name', e.target.value)} />
          </Field>
          <div className="grid2">
            <Field label="ИИН">
              <input
                maxLength={12}
                value={form.iin ?? ''}
                onChange={(e) => set('iin', e.target.value.replace(/\D/g, ''))}
              />
            </Field>
            <Field label="Телефон">
              <input
                placeholder="+7 700 000 00 00"
                value={form.phone ?? ''}
                onChange={(e) => set('phone', e.target.value)}
              />
            </Field>
          </div>
          <Field label="Номер водительского удостоверения">
            <input value={form.license_no ?? ''} onChange={(e) => set('license_no', e.target.value)} />
          </Field>
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
