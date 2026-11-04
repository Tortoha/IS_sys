import { useEffect, useState } from 'react'
import { Empty, ErrorLine, Field, KV, Modal, ModalActions, PageHeader, useLoad, useRefs } from '../components'
import { cleanError, daysCount, dateRu, money, todayIso, type Row } from '../types'

export default function Returns() {
  const [list, reload] = useLoad<Row[]>(() => window.api.returnsList(), [])
  const [toClose, reloadClose] = useLoad<Row[]>(() => window.api.contractsToClose(), [])
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<Row | null>(null)

  const close = async (k: Row) => {
    if (!confirm(`Закрыть договор ${k.code}?`)) return
    try {
      await window.api.contractsClose(k.id)
      reload()
      reloadClose()
    } catch (e) {
      alert(cleanError(e))
    }
  }

  return (
    <>
      <PageHeader
        title="Возврат автомобилей"
        action={
          <button className="btn primary" onClick={() => setOpen(true)}>
            Принять автомобиль
          </button>
        }
      >
        <p className="muted">Акты возврата: {list.length}</p>
      </PageHeader>

      {toClose.length > 0 && (
        <>
          <h3>Расчёт выполнен, закройте договор</h3>
          <table className="table">
            <tbody>
              {toClose.map((k) => (
                <tr key={k.id}>
                  <td>{k.code}</td>
                  <td>{k.client_name}</td>
                  <td>{k.car_name}</td>
                  <td className="actions">
                    <button className="btn primary" onClick={() => close(k)}>
                      Закрыть договор
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 className="section">Акты возврата</h3>
        </>
      )}

      {list.length === 0 ? (
        <Empty text="Актов возврата пока нет" />
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Акт</th>
              <th>Договор</th>
              <th>Клиент</th>
              <th>Автомобиль</th>
              <th>Возврат</th>
              <th>Пробег</th>
              <th>Повреждения</th>
              <th>Штрафы</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id}>
                <td>{r.code}</td>
                <td>{r.contract_code}</td>
                <td>{r.client_name}</td>
                <td>
                  {r.car_name}
                  <div className="muted small">{r.plate}</div>
                </td>
                <td>
                  {dateRu(r.return_date)}
                  {r.return_date > r.date_to && <div className="danger-text small">просрочка</div>}
                </td>
                <td>
                  {r.mileage.toLocaleString('ru-RU')} км
                  <div className="muted small">{r.fuel}</div>
                </td>
                <td className="wrap">
                  {r.damage || <span className="muted">нет</span>}
                  {r.insurance_case ? <div className="small" style={{ color: 'var(--accent)' }}>страховой случай</div> : null}
                </td>
                <td>{r.fines_sum > 0 ? money(r.fines_sum) : <span className="muted">нет</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {open && (
        <ReturnForm
          onClose={() => setOpen(false)}
          onDone={(r) => {
            setOpen(false)
            setResult(r)
            reload()
          }}
        />
      )}
      {result && (
        <Modal title={`Акт ${result.code} составлен`} onClose={() => setResult(null)}>
          <p>
            {result.fines.length > 0
              ? `Начислены штрафы: ${result.fines.join(', ')}.`
              : 'Нарушений не выявлено, штрафы не начислены.'}
          </p>
          <p>
            {result.toService
              ? 'Из-за повреждений автомобиль передан специалисту по ТО.'
              : 'Автомобиль свободен и снова доступен для бронирования.'}
          </p>
          <p className="muted">Следующие шаги: кассир выполняет расчёт по штрафам и залогу, затем менеджер закрывает договор.</p>
          <div className="modal-actions">
            <button className="btn primary" onClick={() => setResult(null)}>
              Готово
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

function ReturnForm(props: { onClose: () => void; onDone: (r: Row) => void }) {
  const refs = useRefs()
  const [contracts, setContracts] = useState<Row[]>([])
  const [f, setF] = useState<Row>({ contract_id: 0, return_date: todayIso(), mileage: '', fuel: 'Полный', damage: '', damage_amount: '', insurance_case: false })
  const [error, setError] = useState('')

  useEffect(() => {
    window.api.contractsOpen().then(setContracts)
  }, [])

  const k = contracts.find((c) => c.id === f.contract_id)
  useEffect(() => {
    if (k) setF((x: Row) => ({ ...x, mileage: k.issue_mileage, fuel: k.issue_fuel }))
  }, [k?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const overdue = k && f.return_date > k.date_to
  const lessFuel = k && refs.fuel.indexOf(f.fuel) < refs.fuel.indexOf(k.issue_fuel)

  const submit = async () => {
    try {
      props.onDone(await window.api.returnsCreate(f))
    } catch (e) {
      setError(cleanError(e))
    }
  }

  return (
    <Modal title="Приём автомобиля" onClose={props.onClose}>
      <Field label="Договор">
        <select value={f.contract_id} onChange={(e) => setF({ ...f, contract_id: Number(e.target.value) })}>
          <option value={0}>Выберите договор</option>
          {contracts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} · {c.client_name} · {c.car_name}
            </option>
          ))}
        </select>
      </Field>
      {k && (
        <KV
          items={[
            ['Срок аренды', `${dateRu(k.date_from)} – ${dateRu(k.date_to)}`],
            ['При выдаче', `${k.issue_mileage.toLocaleString('ru-RU')} км, ${k.issue_fuel}`]
          ]}
        />
      )}
      <div className="grid2">
        <Field label="Дата возврата">
          <input type="date" value={f.return_date} onChange={(e) => setF({ ...f, return_date: e.target.value })} />
        </Field>
        <Field label="Пробег, км">
          <input type="number" value={f.mileage} onChange={(e) => setF({ ...f, mileage: e.target.value })} />
        </Field>
      </div>
      <Field label="Уровень топлива">
        <select value={f.fuel} onChange={(e) => setF({ ...f, fuel: e.target.value })}>
          {refs.fuel.map((x: string) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </Field>
      <Field label="Описание повреждений" hint="Оставьте пустым, если повреждений нет">
        <input value={f.damage} onChange={(e) => setF({ ...f, damage: e.target.value })} />
      </Field>
      {f.damage.trim() && (
        <>
          <Field label="Штраф за повреждения, ₸">
            <input type="number" value={f.damage_amount} onChange={(e) => setF({ ...f, damage_amount: e.target.value })} />
          </Field>
          <label className="check sign">
            <input type="checkbox" checked={f.insurance_case} onChange={(e) => setF({ ...f, insurance_case: e.target.checked })} />
            Оформить как страховой случай
          </label>
        </>
      )}
      {(overdue || lessFuel) && (
        <p className="warn">
          Будут начислены штрафы:{overdue ? ` просрочка возврата (${daysCount(k.date_to, f.return_date) - 1} сут. × 10 000 ₸)` : ''}
          {overdue && lessFuel ? ',' : ''}
          {lessFuel ? ' возврат без топлива' : ''}
        </p>
      )}
      <ErrorLine text={error} />
      <ModalActions onCancel={props.onClose} onOk={submit} ok="Составить акт" />
    </Modal>
  )
}
