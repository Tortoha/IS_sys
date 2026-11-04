import { useState } from 'react'
import { Badge, Empty, ErrorLine, Field, KV, Modal, ModalActions, PageHeader, Search, useLoad, useRefs, match } from '../components'
import ContractForm from './ContractForm'
import { ROLE, addDaysIso, cleanError, dateRu, money, todayIso, type Row, type User } from '../types'

export default function Contracts({ user }: { user: User }) {
  const [list, reload] = useLoad<Row[]>(() => window.api.contractsList(), [])
  const [q, setQ] = useState('')
  const [create, setCreate] = useState(false)
  const [detail, setDetail] = useState<Row | null>(null)
  const [notice, setNotice] = useState('')
  const canEdit = user.role_id === ROLE.manager || user.role_id === ROLE.boss

  const open = async (id: number) => setDetail(await window.api.contractGet(id))
  const shown = list.filter((k) => match(k, q))

  return (
    <>
      <PageHeader
        title="Договоры аренды"
        action={
          <>
            <Search value={q} onChange={setQ} placeholder="Номер, клиент, ИИН, автомобиль" />
            {canEdit && (
              <button className="btn primary" onClick={() => setCreate(true)}>
                Оформить договор
              </button>
            )}
          </>
        }
      >
        <p className="muted">
          Действующих: {list.filter((k) => [1, 2].includes(k.status_id)).length} · Всего: {list.length}
        </p>
      </PageHeader>

      {notice && <p className="info">{notice}</p>}

      {shown.length === 0 ? (
        <Empty text="Договоров не найдено" />
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Номер</th>
              <th>Клиент</th>
              <th>Автомобиль</th>
              <th>Период</th>
              <th>Сумма</th>
              <th>Залог</th>
              <th>Статус</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((k) => (
              <tr key={k.id}>
                <td>{k.code}</td>
                <td>
                  {k.client_name}
                  <div className="muted small">{k.iin_bin}</div>
                </td>
                <td>
                  {k.car_name}
                  <div className="muted small">{k.plate}</div>
                </td>
                <td className="dates">
                  {dateRu(k.date_from)} – {dateRu(k.date_to)}
                </td>
                <td>{money(k.rent_sum)}</td>
                <td>{money(k.deposit)}</td>
                <td>
                  <Badge text={k.status_name} />
                </td>
                <td className="actions">
                  <button className="link" onClick={() => open(k.id)}>
                    Открыть
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {create && (
        <ContractForm
          onClose={() => setCreate(false)}
          onDone={(code) => {
            setCreate(false)
            setNotice(`Договор ${code} оформлен, автомобиль выдан. Клиента ждёт оплата у кассира.`)
            reload()
          }}
        />
      )}
      {detail && (
        <ContractDetail
          k={detail}
          canEdit={canEdit}
          onClose={() => setDetail(null)}
          onChange={async () => {
            reload()
            setDetail(await window.api.contractGet(detail.id))
          }}
        />
      )}
    </>
  )
}

function ContractDetail(props: { k: Row; canEdit: boolean; onClose: () => void; onChange: () => void }) {
  const { k, canEdit } = props
  const refs = useRefs()
  const active = [1, 2].includes(k.status_id) && !k.act
  const [extend, setExtend] = useState<string | null>(null)
  const [service, setService] = useState<number | null>(null)
  const [fine, setFine] = useState<Row | null>(null)
  const [error, setError] = useState('')

  const run = async (fn: () => Promise<unknown>, done?: () => void) => {
    try {
      await fn()
      done?.()
      setError('')
      props.onChange()
    } catch (e) {
      setError(cleanError(e))
    }
  }

  return (
    <Modal title={`Договор ${k.code}`} onClose={props.onClose} wide>
      <KV
        items={[
          ['Статус', <Badge key="s" text={k.status_name} />],
          ['Клиент', `${k.client_name} · ${k.iin_bin}`],
          ['Автомобиль', `${k.car_name} · ${k.plate}`],
          ['Период', `${dateRu(k.date_from)} – ${dateRu(k.date_to)}`],
          ['Тариф', `${k.tariff_name}, ${money(k.price_per_day)} в сутки`],
          ['Доп. услуги', k.services.length ? k.services.map((s: Row) => s.name).join(', ') : 'нет'],
          ['Сумма аренды', money(k.rent_sum)],
          ['Залог', money(k.deposit)],
          ['К оплате сейчас', k.due > 0 && active ? money(k.due) : 'оплачено полностью'],
          ['При выдаче', `${k.issue_mileage.toLocaleString('ru-RU')} км, топливо: ${k.issue_fuel}${k.issue_note ? ', ' + k.issue_note : ''}`]
        ]}
      />

      {k.act && (
        <>
          <h3>Акт возврата {k.act.code}</h3>
          <KV
            items={[
              ['Дата возврата', dateRu(k.act.return_date)],
              ['Пробег', `${k.act.mileage.toLocaleString('ru-RU')} км`],
              ['Топливо', k.act.fuel],
              ['Повреждения', k.act.damage || 'нет']
            ]}
          />
        </>
      )}

      <h3>Платежи</h3>
      {k.payments.length === 0 ? (
        <p className="muted">Платежей нет</p>
      ) : (
        <table className="table compact">
          <tbody>
            {k.payments.map((p: Row) => (
              <tr key={p.id}>
                <td>{p.code}</td>
                <td>{p.type_name}</td>
                <td>{dateRu(p.paid_at)}</td>
                <td>{p.method_name}</td>
                <td className="num">{p.type_id === 3 ? '−' : ''}{money(p.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>Штрафы</h3>
      {k.fines.length === 0 ? (
        <p className="muted">Штрафов нет</p>
      ) : (
        <table className="table compact">
          <tbody>
            {k.fines.map((f: Row) => (
              <tr key={f.id}>
                <td>{f.code}</td>
                <td>{f.type_name}</td>
                <td>{dateRu(f.fined_at)}</td>
                <td>{f.paid ? 'оплачен' : <span className="danger-text">не оплачен</span>}</td>
                <td className="num">{money(f.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ErrorLine text={error} />

      {canEdit && active && (
        <div className="row-actions">
          <button className="btn" onClick={() => setExtend(addDaysIso(k.date_to, 1))}>
            Продлить аренду
          </button>
          <button className="btn" onClick={() => setService(0)}>
            Добавить услугу
          </button>
          <button className="btn" onClick={() => setFine({ type_id: 4, amount: '' })}>
            Начислить штраф
          </button>
          <button
            className="btn danger"
            onClick={() => confirm('Расторгнуть договор?') && run(() => window.api.contractsTerminate(k.id))}
          >
            Расторгнуть
          </button>
        </div>
      )}
      <div className="modal-actions">
        <button className="btn" onClick={props.onClose}>
          Закрыть
        </button>
      </div>

      {extend !== null && (
        <Modal title="Продление аренды" onClose={() => setExtend(null)}>
          <Field label="Новая дата возврата" hint="Стоимость аренды будет пересчитана">
            <input type="date" min={addDaysIso(k.date_to, 1)} value={extend} onChange={(e) => setExtend(e.target.value)} />
          </Field>
          <ErrorLine text={error} />
          <ModalActions
            onCancel={() => setExtend(null)}
            ok="Продлить"
            onOk={() => run(() => window.api.contractsExtend(k.id, extend), () => setExtend(null))}
          />
        </Modal>
      )}
      {service !== null && (
        <Modal title="Дополнительная услуга" onClose={() => setService(null)}>
          <Field label="Услуга" hint="Стоимость аренды будет пересчитана на весь срок договора">
            <select value={service} onChange={(e) => setService(Number(e.target.value))}>
              <option value={0}>Выберите услугу</option>
              {refs.services
                .filter((s: Row) => !k.services.some((x: Row) => x.id === s.id))
                .map((s: Row) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {money(s.price_per_day)}/сут
                  </option>
                ))}
            </select>
          </Field>
          <ErrorLine text={error} />
          <ModalActions
            onCancel={() => setService(null)}
            ok="Добавить"
            onOk={() => run(() => window.api.contractsAddService(k.id, service), () => setService(null))}
          />
        </Modal>
      )}
      {fine && (
        <Modal title="Начисление штрафа" onClose={() => setFine(null)}>
          <Field label="Вид штрафа">
            <select
              value={fine.type_id}
              onChange={(e) => {
                const t = refs.fineTypes.find((x: Row) => x.id === Number(e.target.value))
                setFine({ type_id: Number(e.target.value), amount: t?.default_amount || '' })
              }}
            >
              {refs.fineTypes.map((t: Row) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Сумма, ₸">
            <input type="number" value={fine.amount} onChange={(e) => setFine({ ...fine, amount: e.target.value })} />
          </Field>
          <ErrorLine text={error} />
          <ModalActions
            onCancel={() => setFine(null)}
            ok="Начислить"
            onOk={() =>
              run(
                () => window.api.finesAdd({ contract_id: k.id, type_id: fine.type_id, amount: fine.amount, fined_at: todayIso() }),
                () => setFine(null)
              )
            }
          />
        </Modal>
      )}
    </Modal>
  )
}
