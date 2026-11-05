import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { cleanError, type Row } from './types'

export function Modal(props: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; xwide?: boolean }) {
  const { onClose } = props
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className={'modal' + (props.wide ? ' wide' : '') + (props.xwide ? ' xwide' : '')} onMouseDown={(e) => e.stopPropagation()}>
        <h2>{props.title}</h2>
        {props.children}
      </div>
    </div>
  )
}

export function Field(props: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span>{props.label}</span>
      {props.children}
      {props.hint && <small>{props.hint}</small>}
    </label>
  )
}

export function PageHeader(props: { title: string; action?: ReactNode; children?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{props.title}</h1>
        {props.children}
      </div>
      <div className="header-actions">{props.action}</div>
    </header>
  )
}

export function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>
}

const tones: Record<string, string> = {
  Свободен: 'blue', Подтверждено: 'blue', Оплачен: 'blue', Завершено: 'gray', Закрыт: 'gray',
  Создано: 'soft', Оформлен: 'soft', Забронирован: 'soft', 'В аренде': 'dark', 'Автомобиль выдан': 'dark',
  Отменено: 'red', Расторгнут: 'red', Недоступен: 'red', 'На техническом обслуживании': 'red'
}

export function Badge({ text }: { text: string }) {
  return <span className={'badge ' + (tones[text] ?? 'soft')}>{text}</span>
}

/** Загрузка данных страницы с возможностью обновления. */
export function useLoad<T>(fn: () => Promise<T>, initial: T): [T, () => void] {
  const [data, setData] = useState<T>(initial)
  const load = useCallback(() => {
    fn().then(setData).catch((e) => alert(cleanError(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(load, [load])
  return [data, load]
}

export function useRefs(): Row {
  const [refs, setRefs] = useState<Row>({
    classes: [], carStatuses: [], methods: [], fineTypes: [], workTypes: [], roles: [],
    clientTypes: [], services: [], tariffs: [], fuel: []
  })
  useEffect(() => {
    window.api.refs().then(setRefs)
  }, [])
  return refs
}

export function ErrorLine({ text }: { text: string }) {
  return text ? <p className="error">{text}</p> : null
}

export function Tabs(props: { items: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="tabs">
      {props.items.map(([id, title]) => (
        <button key={id} className={'tab' + (id === props.value ? ' active' : '')} onClick={() => props.onChange(id)}>
          {title}
        </button>
      ))}
    </div>
  )
}

export function Search(props: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      className="search"
      placeholder={props.placeholder ?? 'Поиск'}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
    />
  )
}

export function Stat(props: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="stat">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
      {props.note && <small>{props.note}</small>}
    </div>
  )
}

export function KV({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="kv">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export const match = (row: Row, q: string): boolean =>
  !q.trim() || Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q.trim().toLowerCase()))

export function ModalActions(props: { onCancel: () => void; onOk: () => void; ok: string; disabled?: boolean }) {
  return (
    <div className="modal-actions">
      <button className="btn" onClick={props.onCancel}>
        Отмена
      </button>
      <button className="btn primary" onClick={props.onOk} disabled={props.disabled}>
        {props.ok}
      </button>
    </div>
  )
}
