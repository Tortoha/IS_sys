import { useEffect, useState } from 'react'
import { Empty, ErrorLine, Field, PageHeader, Stat } from '../components'
import { addDaysIso, cleanError, dateRu, money, todayIso, type Row } from '../types'

export default function Reports() {
  const [from, setFrom] = useState(addDaysIso(todayIso(), -29))
  const [to, setTo] = useState(todayIso())
  const [data, setData] = useState<Row | null>(null)
  const [error, setError] = useState('')

  const build = async () => {
    try {
      setData(await window.api.report({ from, to }))
      setError('')
    } catch (e) {
      setError(cleanError(e))
    }
  }

  useEffect(() => {
    build()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <PageHeader title="Отчёт за период">
        <p className="muted">Договоры, платежи и загрузка автопарка</p>
      </PageHeader>

      <div className="period">
        <Field label="С">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="По">
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <button className="btn primary" onClick={build}>
          Сформировать
        </button>
        <button className="btn" onClick={() => window.print()}>
          Печать
        </button>
      </div>
      <ErrorLine text={error} />

      {data && (
        <>
          <p className="muted">
            Период: {dateRu(data.from)} – {dateRu(data.to)} ({data.periodDays} дн.)
          </p>
          <div className="stats">
            <Stat label="Договоров" value={data.contracts} />
            <Stat label="Бронирований" value={data.bookings} />
            <Stat label="Поступило" value={money(data.income)} note="аренда, залоги, штрафы" />
            <Stat label="Средняя загрузка" value={data.avgLoad + '%'} />
          </div>

          <h3>Платежи по видам</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Вид платежа</th>
                <th className="num">Операций</th>
                <th className="num">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {data.byType.map((t: Row) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td className="num">{t.cnt}</td>
                  <td className="num">
                    {t.id === 3 && t.sum > 0 ? '−' : ''}
                    {money(t.sum)}
                  </td>
                </tr>
              ))}
              <tr className="total-row">
                <td>Итого за вычетом возвратов залога</td>
                <td />
                <td className="num">{money(data.net)}</td>
              </tr>
            </tbody>
          </table>

          <h3 className="section">Загрузка автопарка</h3>
          {data.cars.length === 0 ? (
            <Empty text="Автомобилей нет" />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Автомобиль</th>
                  <th className="num">Договоров</th>
                  <th className="num">Дней в аренде</th>
                  <th style={{ width: '30%' }}>Загрузка</th>
                </tr>
              </thead>
              <tbody>
                {data.cars.map((c: Row) => (
                  <tr key={c.id}>
                    <td>
                      {c.name}
                      <div className="muted small">{c.plate}</div>
                    </td>
                    <td className="num">{c.contracts}</td>
                    <td className="num">{c.days}</td>
                    <td>
                      <div className="bar">
                        <div style={{ width: c.percent + '%' }} />
                      </div>
                      <span className="small muted">{c.percent}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </>
  )
}
