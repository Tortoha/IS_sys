import { useState } from 'react'
import { ErrorLine, Field, Modal, ModalActions, useRefs } from '../components'
import { cleanError, type Row } from '../types'

/** Карточка клиента: физическое лицо (ИИН) или юридическое (БИН и представитель). */
export default function ClientForm(props: { initial: Row; onClose: () => void; onSaved: (id: number) => void }) {
  const refs = useRefs()
  const [form, setForm] = useState<Row>(props.initial)
  const [error, setError] = useState('')
  const set = (k: string, v: string | number) => setForm((f: Row) => ({ ...f, [k]: v }))
  const legal = form.type_id === 2

  const save = async () => {
    try {
      props.onSaved(await window.api.clientsSave(form))
    } catch (e) {
      setError(cleanError(e))
    }
  }

  return (
    <Modal title={form.id ? 'Редактирование клиента' : 'Новый клиент'} onClose={props.onClose}>
      <Field label="Тип клиента">
        <select value={form.type_id} onChange={(e) => set('type_id', Number(e.target.value))}>
          {refs.clientTypes.map((t: Row) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={legal ? 'Наименование организации' : 'ФИО'}>
        <input value={form.full_name ?? ''} onChange={(e) => set('full_name', e.target.value)} />
      </Field>
      {legal && (
        <Field label="Представитель организации" hint="ФИО и должность лица, которое получает автомобиль">
          <input value={form.representative ?? ''} onChange={(e) => set('representative', e.target.value)} />
        </Field>
      )}
      <div className="grid2">
        <Field label={legal ? 'БИН' : 'ИИН'}>
          <input maxLength={12} value={form.iin_bin ?? ''} onChange={(e) => set('iin_bin', e.target.value.replace(/\D/g, ''))} />
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
      <ModalActions onCancel={props.onClose} onOk={save} ok="Сохранить" />
    </Modal>
  )
}
