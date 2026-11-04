import { useState } from 'react'
import { Badge, Empty, ErrorLine, Field, KV, Modal, PageHeader, Search, Tabs, useLoad, useRefs, match } from '../components'
import { cleanError, dateRu, money, type Row } from '../types'

const KASPI = 3

export default function Payments() {
  const [tab, setTab] = useState('accept')
  return (
    <>
      <PageHeader title="Платежи">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            ['accept', 'Принять оплату'],
            ['settle', 'Расчёт при возврате'],
            ['journal', 'Журнал платежей']
          ]}
        />
      </PageHeader>
      {tab === 'accept' && <Accept />}
      {tab === 'settle' && <Settle />}
      {tab === 'journal' && <Journal />}
    </>
  )
}

/** Сценарий ПР 4: регистрация оплаты и залога. */
function Accept() {
  const refs = useRefs()
  const [q, setQ] = useState('')
  const [found, setFound] = useState<Row[] | null>(null)
  const [sel, setSel] = useState<Row | null>(null)
  const [method, setMethod] = useState(1)
  const [accepted, setAccepted] = useState('')
  const [ref, setRef] = useState('')
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState<Row | null>(null)

  const search = async () => {
    try {
      setFound(await window.api.contractFind(q))
      setSel(null)
      setError('')
    } catch (e) {
      setError(cleanError(e))
    }
  }

  const choose = (k: Row) => {
    setSel(k)
    setAccepted(String(k.due))
    setRef('')
    setError('')
  }

  const register = async () => {
    try {
      const r = await window.api.paymentsRegister({ contract_id: sel!.id, method_id: method, accepted: Number(accepted), ref_no: ref })
      setReceipt(r)
      setSel(null)
      setFound(null)
      setQ('')
    } catch (e) {
      setError(cleanError(e))
    }
  }

  return (
    <>
      <div className="searchbar">
        <input
          className="search wide"
          placeholder="Номер договора или ИИН клиента"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
        />
        <button className="btn primary" onClick={search}>
          Найти договор
        </button>
      </div>
      <ErrorLine text={sel ? '' : error} />

      {found && found.length === 0 && <Empty text="Договор не найден. Проверьте номер или ИИН" />}
      {found && found.length > 0 && !sel && (
        <table className="table">
          <thead>
            <tr>
              <th>Договор</th>
              <th>Клиент</th>
              <th>Автомобиль</th>
              <th>Статус</th>
              <th>К оплате</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {found.map((k) => (
              <tr key={k.id}>
                <td>{k.code}</td>
                <td>{k.client_name}</td>
                <td>{k.car_name}</td>
                <td>
                  <Badge text={k.status_name} />
                </td>
                <td>{[1, 2].includes(k.status_id) && !k.has_act ? money(k.due) : '—'}</td>
                <td className="actions">
                  {[1, 2].includes(k.status_id) && !k.has_act && (
                    <button className="link" onClick={() => choose(k)}>
                      Выбрать
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {sel && (
        <div className="panel">
          <h3>Договор {sel.code}</h3>
          <KV
            items={[
              ['Клиент', sel.client_name],
              ['Автомобиль', `${sel.car_name} · ${sel.plate}`],
              ['Срок', `${dateRu(sel.date_from)} – ${dateRu(sel.date_to)}`],
              ['Тариф', `${sel.tariff_name}, ${money(sel.price_per_day)} в сутки`],
              ['Аренда к оплате', money(sel.rentDue)],
              ['Залог к внесению', money(sel.depositDue)],
              ['Итого к оплате', money(sel.due)]
            ]}
          />
          {sel.due === 0 ? (
            <p className="info">По договору всё оплачено.</p>
          ) : (
            <>
              <div className="grid2">
                <Field label="Способ оплаты">
                  <select value={method} onChange={(e) => setMethod(Number(e.target.value))}>
                    {refs.methods.map((m: Row) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Принято от клиента, ₸">
                  <input type="number" value={accepted} onChange={(e) => setAccepted(e.target.value)} />
                </Field>
              </div>
              {method === KASPI && (
                <Field label="Номер операции Kaspi" hint="Из подтверждения оплаты банком">
                  <input value={ref} onChange={(e) => setRef(e.target.value)} />
                </Field>
              )}
              <ErrorLine text={error} />
              <div className="row-actions">
                <button className="btn" onClick={() => setSel(null)}>
                  Назад
                </button>
                <button className="btn primary" onClick={register}>
                  Зарегистрировать платёж
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {receipt && (
        <Modal title="Оплата принята" onClose={() => setReceipt(null)}>
          <KV
            items={[
              ['Договор', receipt.contract],
              ['Платежи', receipt.codes.join(', ')],
              ['Оплата аренды', money(receipt.rent)],
              ['Залог', money(receipt.deposit)],
              ['Принято', money(receipt.accepted)],
              ['Сдача', money(receipt.change)]
            ]}
          />
          <p className="muted">Договору присвоен статус «Оплачен». Передайте клиенту подтверждение оплаты.</p>
          <div className="modal-actions">
            <button className="btn" onClick={() => window.print()}>
              Печать чека
            </button>
            <button className="btn primary" onClick={() => setReceipt(null)}>
              Готово
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

/** Расчёт штрафов и возврат залога после акта возврата (процесс 4, ПР 3). */
function Settle() {
  const refs = useRefs()
  const [list, reload] = useLoad<Row[]>(() => window.api.settlementsList(), [])
  const [sel, setSel] = useState<Row | null>(null)
  const [method, setMethod] = useState(1)
  const [accepted, setAccepted] = useState('')
  const [ref, setRef] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState<Row | null>(null)

  const run = async () => {
    try {
      const r = await window.api.settlementRun({ contract_id: sel!.id, method_id: method, accepted: Number(accepted), ref_no: ref })
      setDone(r)
      setSel(null)
      reload()
    } catch (e) {
      setError(cleanError(e))
    }
  }

  return (
    <>
      {list.length === 0 ? (
        <Empty text="Нет договоров, ожидающих расчёта после возврата автомобиля" />
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Договор</th>
              <th>Клиент</th>
              <th>Залог внесён</th>
              <th>Штрафы</th>
              <th>Итог</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((k) => (
              <tr key={k.id}>
                <td>
                  {k.code}
                  <div className="muted small">{k.car_name}</div>
                </td>
                <td>{k.client_name}</td>
                <td>{money(k.held)}</td>
                <td>{money(k.fines)}</td>
                <td>
                  {k.extra > 0 ? `доплата ${money(k.extra)}` : k.refund > 0 ? `вернуть ${money(k.refund)}` : 'без расчётов'}
                </td>
                <td className="actions">
                  <button
                    className="link"
                    onClick={() => (setSel(k), setAccepted(String(k.extra)), setRef(''), setError(''))}
                  >
                    Выполнить расчёт
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {sel && (
        <Modal title={`Расчёт по договору ${sel.code}`} onClose={() => setSel(null)}>
          <KV
            items={[
              ['Залог внесён', money(sel.held)],
              ['Штрафы к оплате', money(sel.fines)],
              [sel.extra > 0 ? 'Клиент доплачивает' : 'Возврат залога клиенту', money(sel.extra > 0 ? sel.extra : sel.refund)]
            ]}
          />
          <p className="muted small">Штрафы удерживаются из залога. После расчёта договор будет закрыт.</p>
          {sel.rentDue > 0 && <p className="warn">Аренда не оплачена полностью. Сначала примите оплату на вкладке «Принять оплату».</p>}
          {(sel.extra > 0 || sel.refund > 0) && (
            <div className="grid2">
              <Field label="Способ оплаты">
                <select value={method} onChange={(e) => setMethod(Number(e.target.value))}>
                  {refs.methods.map((m: Row) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </Field>
              {sel.extra > 0 && (
                <Field label="Принято от клиента, ₸">
                  <input type="number" value={accepted} onChange={(e) => setAccepted(e.target.value)} />
                </Field>
              )}
            </div>
          )}
          {method === KASPI && (sel.extra > 0 || sel.refund > 0) && (
            <Field label="Номер операции Kaspi">
              <input value={ref} onChange={(e) => setRef(e.target.value)} />
            </Field>
          )}
          <ErrorLine text={error} />
          <div className="modal-actions">
            <button className="btn" onClick={() => setSel(null)}>
              Отмена
            </button>
            <button className="btn primary" onClick={run}>
              Выполнить расчёт и закрыть договор
            </button>
          </div>
        </Modal>
      )}

      {done && (
        <Modal title="Расчёт выполнен" onClose={() => setDone(null)}>
          <p>
            Договор {done.contract} закрыт.
            {done.refund > 0 && ` Залог возвращён клиенту: ${money(done.refund)}.`}
            {done.extra > 0 && ` Получена доплата по штрафам: ${money(done.extra)}.`}
          </p>
          <div className="modal-actions">
            <button className="btn primary" onClick={() => setDone(null)}>
              Готово
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

function Journal() {
  const [list] = useLoad<Row[]>(() => window.api.paymentsList(), [])
  const [q, setQ] = useState('')
  const shown = list.filter((p) => match(p, q))
  return (
    <>
      <div className="searchbar">
        <Search value={q} onChange={setQ} placeholder="Номер, договор, клиент" />
        <span className="muted">Записей: {shown.length}</span>
      </div>
      {shown.length === 0 ? (
        <Empty text="Платежей пока нет" />
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Платёж</th>
              <th>Договор</th>
              <th>Клиент</th>
              <th>Вид</th>
              <th>Способ</th>
              <th>Дата</th>
              <th className="num">Сумма</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.id}>
                <td>{p.code}</td>
                <td>{p.contract_code}</td>
                <td>{p.client_name}</td>
                <td>{p.type_name}</td>
                <td>
                  {p.method_name}
                  {p.ref_no && <div className="muted small">{p.ref_no}</div>}
                </td>
                <td>{dateRu(p.paid_at)}</td>
                <td className="num">
                  {p.type_id === 3 ? '−' : ''}
                  {money(p.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
