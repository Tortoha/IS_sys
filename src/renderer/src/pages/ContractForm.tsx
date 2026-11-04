import { useEffect, useMemo, useState } from 'react'
import { ErrorLine, Field, KV, Modal, ModalActions, useRefs } from '../components'
import { cleanError, daysCount, dateRu, money, todayIso, addDaysIso, type Row } from '../types'

/** Оформление договора аренды и выдача автомобиля (процесс 2, ПР 3). */
export default function ContractForm(props: { booking?: Row; onClose: () => void; onDone: (code: string) => void }) {
  const { booking } = props
  const refs = useRefs()
  const [clients, setClients] = useState<Row[]>([])
  const [cars, setCars] = useState<Row[]>([])
  const [f, setF] = useState<Row>({
    client_id: 0, car_id: 0, date_from: todayIso(), date_to: addDaysIso(todayIso(), 2),
    deposit: 50000, services: [] as number[], issue_fuel: 'Полный', issue_note: '', signed: false
  })
  const [error, setError] = useState('')

  useEffect(() => {
    window.api.clientsList().then(setClients)
  }, [])

  const from = booking ? booking.date_from : f.date_from
  const to = booking ? booking.date_to : f.date_to

  useEffect(() => {
    if (booking) {
      window.api.carsList().then((all) => setCars(all.filter((c: Row) => c.id === booking.car_id)))
    } else if (from && to && to >= from) {
      window.api.carsAvailable({ date_from: from, date_to: to }).then(setCars).catch(() => setCars([]))
    }
  }, [booking, from, to])

  const car = cars.find((c) => c.id === (booking ? booking.car_id : f.car_id))
  const client = clients.find((c) => c.id === (booking ? booking.client_id : f.client_id))

  useEffect(() => {
    if (car) setF((x: Row) => ({ ...x, issue_mileage: car.mileage }))
  }, [car?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const svcPerDay = useMemo(
    () => refs.services.filter((s: Row) => f.services.includes(s.id)).reduce((a: number, s: Row) => a + s.price_per_day, 0),
    [refs.services, f.services]
  )
  const days = daysCount(from, to)
  const total = car ? days * (car.price_per_day + svcPerDay) : 0

  const toggle = (id: number) =>
    setF((x: Row) => ({ ...x, services: x.services.includes(id) ? x.services.filter((s: number) => s !== id) : [...x.services, id] }))

  const submit = async () => {
    try {
      const code = await window.api.contractsCreate({ ...f, booking_id: booking?.id })
      props.onDone(code)
    } catch (e) {
      setError(cleanError(e))
    }
  }

  return (
    <Modal title={booking ? `Выдача автомобиля по брони ${booking.code}` : 'Новый договор аренды'} onClose={props.onClose} wide>
      {booking ? (
        <KV
          items={[
            ['Клиент', booking.client_name],
            ['Автомобиль', `${booking.car_name} · ${booking.plate}`],
            ['Период', `${dateRu(booking.date_from)} – ${dateRu(booking.date_to)}`]
          ]}
        />
      ) : (
        <>
          <div className="grid2">
            <Field label="Дата выдачи">
              <input type="date" value={f.date_from} onChange={(e) => setF({ ...f, date_from: e.target.value, car_id: 0 })} />
            </Field>
            <Field label="Дата возврата">
              <input type="date" min={f.date_from} value={f.date_to} onChange={(e) => setF({ ...f, date_to: e.target.value, car_id: 0 })} />
            </Field>
          </div>
          <Field label="Клиент">
            <select value={f.client_id} onChange={(e) => setF({ ...f, client_id: Number(e.target.value) })}>
              <option value={0}>Выберите клиента</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name} · {c.iin_bin}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Автомобиль" hint="Показаны автомобили, свободные на выбранные даты">
            <select value={f.car_id} onChange={(e) => setF({ ...f, car_id: Number(e.target.value) })}>
              <option value={0}>Выберите автомобиль</option>
              {cars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.brand} {c.model} · {c.plate} · {c.class_name} · {money(c.price_per_day)}/сут
                </option>
              ))}
            </select>
          </Field>
        </>
      )}

      {car && (!car.osgpo_until || car.osgpo_until < to) && (
        <p className="warn">
          {car.osgpo_until ? `Полис ОС ГПО ВТС автомобиля действует до ${dateRu(car.osgpo_until)}, раньше окончания аренды` : 'У автомобиля не указан полис ОС ГПО ВТС'}
        </p>
      )}
      {client && client.unpaid_fines > 0 && (
        <p className="warn">У клиента есть неоплаченные штрафы на {money(client.unpaid_fines)}</p>
      )}
      {client && client.license_expiry < to && (
        <p className="warn">Водительское удостоверение клиента действует до {dateRu(client.license_expiry)}, раньше окончания аренды</p>
      )}

      <div className="grid2">
        <Field label="Размер залога, ₸">
          <input type="number" value={f.deposit} onChange={(e) => setF({ ...f, deposit: e.target.value })} />
        </Field>
        <Field label="Топливо при выдаче">
          <select value={f.issue_fuel} onChange={(e) => setF({ ...f, issue_fuel: e.target.value })}>
            {refs.fuel.map((x: string) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
        <Field label="Пробег при выдаче, км">
          <input type="number" value={f.issue_mileage ?? ''} onChange={(e) => setF({ ...f, issue_mileage: e.target.value })} />
        </Field>
        <Field label="Состояние автомобиля">
          <input
            placeholder="Повреждений нет"
            value={f.issue_note}
            onChange={(e) => setF({ ...f, issue_note: e.target.value })}
          />
        </Field>
      </div>

      <div className="field">
        <span>Дополнительные услуги</span>
        <div className="checks">
          {refs.services.map((s: Row) => (
            <label key={s.id} className="check">
              <input type="checkbox" checked={f.services.includes(s.id)} onChange={() => toggle(s.id)} />
              {s.name} · {money(s.price_per_day)}/сут
            </label>
          ))}
        </div>
      </div>

      <label className="check sign">
        <input type="checkbox" checked={f.signed} onChange={(e) => setF({ ...f, signed: e.target.checked })} />
        Договор подписан клиентом
      </label>

      <div className="total">
        <span>
          {days} сут. по тарифу {car ? money(car.price_per_day) : '—'}
          {svcPerDay ? ` + услуги ${money(svcPerDay)}` : ''}
        </span>
        <strong>{money(total)}</strong>
      </div>
      <ErrorLine text={error} />
      <ModalActions onCancel={props.onClose} onOk={submit} ok="Оформить и выдать" />
    </Modal>
  )
}
