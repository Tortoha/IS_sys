import { useEffect, useState, type ComponentType } from 'react'
import Login from './pages/Login'
import Bookings from './pages/Bookings'
import Contracts from './pages/Contracts'
import Payments from './pages/Payments'
import Returns from './pages/Returns'
import Maintenance from './pages/Maintenance'
import Clients from './pages/Clients'
import Cars from './pages/Cars'
import Reports from './pages/Reports'
import Refs from './pages/Refs'
import Employees from './pages/Employees'
import { ROLE, cleanError, type User } from './types'

const { manager: M, cashier: C, tech: T, boss: B } = ROLE

const pages: { id: string; title: string; roles: number[]; view: ComponentType<{ user: User }> }[] = [
  { id: 'bookings', title: 'Бронирования', roles: [M, B], view: Bookings },
  { id: 'contracts', title: 'Договоры', roles: [M, C, B], view: Contracts },
  { id: 'payments', title: 'Платежи', roles: [C, B], view: Payments },
  { id: 'returns', title: 'Возврат', roles: [M, B], view: Returns },
  { id: 'maintenance', title: 'Техобслуживание', roles: [T, B], view: Maintenance },
  { id: 'cars', title: 'Автомобили', roles: [M, T, B], view: Cars },
  { id: 'clients', title: 'Клиенты', roles: [M, B], view: Clients },
  { id: 'reports', title: 'Отчёты', roles: [M, B], view: Reports },
  { id: 'refs', title: 'Справочники', roles: [B], view: Refs },
  { id: 'employees', title: 'Сотрудники', roles: [B], view: Employees }
]

const roleNames: Record<number, string> = { 1: 'Менеджер', 2: 'Кассир', 3: 'Специалист по ТО', 4: 'Руководитель' }

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [page, setPage] = useState('')
  const [version, setVersion] = useState(0)

  useEffect(() => {
    window.api.me().then((u) => {
      setUser(u)
      setReady(true)
    })
  }, [])

  const allowed = user ? pages.filter((p) => p.roles.includes(user.role_id)) : []
  useEffect(() => {
    if (user && !allowed.some((p) => p.id === page)) setPage(allowed[0]?.id ?? '')
  }, [user, page, allowed])

  if (!ready) return null
  if (!user) return <Login onLogin={setUser} />

  const Current = allowed.find((p) => p.id === page)?.view

  const loadDemo = async () => {
    if (!confirm('Текущие данные будут заменены тестовыми. Продолжить?')) return
    try {
      await window.api.demoLoad()
      setVersion((v) => v + 1)
    } catch (e) {
      alert(cleanError(e))
    }
  }
  const clearData = async () => {
    if (!confirm('Удалить все данные клиентов, автомобилей, договоров и платежей?')) return
    await window.api.demoClear()
    setVersion((v) => v + 1)
  }
  const logout = async () => {
    await window.api.logout()
    setUser(null)
    setPage('')
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">Прокат автомобилей</div>
        <nav>
          {allowed.map((p) => (
            <button key={p.id} className={'nav-item' + (p.id === page ? ' active' : '')} onClick={() => setPage(p.id)}>
              {p.title}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          {user.role_id === B && (
            <>
              <button className="nav-item" onClick={loadDemo}>
                Загрузить тестовые данные
              </button>
              <button className="nav-item" onClick={clearData}>
                Очистить данные
              </button>
            </>
          )}
          <div className="user">
            <strong>{user.full_name}</strong>
            <span>{roleNames[user.role_id]}</span>
          </div>
          <button className="nav-item" onClick={logout}>
            Выйти
          </button>
        </div>
      </aside>
      <main className="content">{Current && <Current key={page + version} user={user} />}</main>
    </div>
  )
}
