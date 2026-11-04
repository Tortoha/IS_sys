import { useState } from 'react'
import { ErrorLine } from '../components'
import { cleanError, type User } from '../types'

const demo = [
  ['boss', 'Руководитель'],
  ['manager', 'Менеджер'],
  ['kassir', 'Кассир'],
  ['to', 'Специалист по ТО']
]

export default function Login({ onLogin, onClient }: { onLogin: (u: User) => void; onClient: () => void }) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = async () => {
    try {
      onLogin(await window.api.login(login, password))
    } catch (e) {
      setError(cleanError(e))
    }
  }

  return (
    <div className="login">
      <div className="login-card">
        <h1>Прокат автомобилей</h1>
        <p className="muted">Войдите в систему</p>
        <label className="field">
          <span>Логин</span>
          <input autoFocus value={login} onChange={(e) => setLogin(e.target.value)} />
        </label>
        <label className="field">
          <span>Пароль</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </label>
        <ErrorLine text={error} />
        <button className="btn primary block" onClick={submit}>
          Войти
        </button>
        <button className="btn block" style={{ marginTop: 12 }} onClick={onClient}>
          Я клиент: найти автомобиль
        </button>
        <div className="login-hint">
          <p>Тестовые учётные записи, пароль 1234:</p>
          {demo.map(([l, r]) => (
            <button key={l} className="link" onClick={() => (setLogin(l), setPassword('1234'))}>
              {l} · {r}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
