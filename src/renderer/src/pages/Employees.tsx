import { useState } from 'react'
import { ErrorLine, Field, Modal, ModalActions, PageHeader, useLoad, useRefs } from '../components'
import { cleanError, type Row, type User } from '../types'

export default function Employees({ user }: { user: User }) {
  const [list, reload] = useLoad<Row[]>(() => window.api.employeesList(), [])
  const refs = useRefs()
  const [form, setForm] = useState<Row | null>(null)
  const [error, setError] = useState('')

  const save = async () => {
    try {
      await window.api.employeesSave(form)
      setForm(null)
      reload()
    } catch (e) {
      setError(cleanError(e))
    }
  }

  return (
    <>
      <PageHeader
        title="Сотрудники"
        action={
          <button className="btn primary" onClick={() => (setForm({ role_id: 1, active: 1, password: '' }), setError(''))}>
            Добавить сотрудника
          </button>
        }
      >
        <p className="muted">Учётные записи и роли пользователей системы</p>
      </PageHeader>

      <table className="table">
        <thead>
          <tr>
            <th>Код</th>
            <th>ФИО</th>
            <th>Роль</th>
            <th>Логин</th>
            <th>Учётная запись</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {list.map((e) => (
            <tr key={e.id}>
              <td className="muted">{e.code}</td>
              <td>
                {e.full_name}
                {e.id === user.id && <span className="muted small"> · это вы</span>}
              </td>
              <td>{e.role_name}</td>
              <td>{e.login}</td>
              <td>{e.active ? 'активна' : <span className="muted">отключена</span>}</td>
              <td className="actions">
                <button className="link" onClick={() => (setForm({ ...e, password: '' }), setError(''))}>
                  Изменить
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {form && (
        <Modal title={form.id ? 'Редактирование сотрудника' : 'Новый сотрудник'} onClose={() => setForm(null)}>
          <Field label="ФИО">
            <input value={form.full_name ?? ''} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </Field>
          <div className="grid2">
            <Field label="Роль">
              <select value={form.role_id} onChange={(e) => setForm({ ...form, role_id: Number(e.target.value) })}>
                {refs.roles.map((r: Row) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Логин">
              <input value={form.login ?? ''} onChange={(e) => setForm({ ...form, login: e.target.value })} />
            </Field>
          </div>
          <Field label={form.id ? 'Новый пароль' : 'Пароль'} hint={form.id ? 'Оставьте пустым, чтобы не менять' : undefined}>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          {form.id && (
            <label className="check">
              <input type="checkbox" checked={!!form.active} onChange={(e) => setForm({ ...form, active: e.target.checked ? 1 : 0 })} />
              Учётная запись активна
            </label>
          )}
          <ErrorLine text={error} />
          <ModalActions onCancel={() => setForm(null)} onOk={save} ok="Сохранить" />
        </Modal>
      )}
    </>
  )
}
