import { useState } from 'react'
import Cars from './pages/Cars'
import Clients from './pages/Clients'
import Rentals from './pages/Rentals'

const pages = [
  { id: 'rentals', title: 'Договоры', view: Rentals },
  { id: 'cars', title: 'Автомобили', view: Cars },
  { id: 'clients', title: 'Клиенты', view: Clients }
] as const

export default function App() {
  const [page, setPage] = useState<(typeof pages)[number]['id']>('rentals')
  const [version, setVersion] = useState(0)
  const Current = pages.find((p) => p.id === page)!.view

  const loadDemo = async () => {
    if (!confirm('Текущие данные будут заменены тестовыми. Продолжить?')) return
    await window.api.demoLoad()
    setVersion((v) => v + 1)
  }
  const clearData = async () => {
    if (!confirm('Удалить все данные из базы?')) return
    await window.api.demoClear()
    setVersion((v) => v + 1)
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">Прокат автомобилей</div>
        <nav>
          {pages.map((p) => (
            <button
              key={p.id}
              className={'nav-item' + (p.id === page ? ' active' : '')}
              onClick={() => setPage(p.id)}
            >
              {p.title}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <button className="nav-item" onClick={loadDemo}>
            Загрузить тестовые данные
          </button>
          <button className="nav-item" onClick={clearData}>
            Очистить базу
          </button>
        </div>
      </aside>
      <main className="content">
        <Current key={page + version} />
      </main>
    </div>
  )
}
