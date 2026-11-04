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
  const Current = pages.find((p) => p.id === page)!.view

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
      </aside>
      <main className="content">
        <Current />
      </main>
    </div>
  )
}
