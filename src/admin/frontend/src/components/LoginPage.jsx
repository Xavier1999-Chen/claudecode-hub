import { useState } from 'react'
import { signIn, signUp } from '../api.js'
import LogoMark from './LogoMark.jsx'

export default function LoginPage() {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [registered, setRegistered] = useState(false)

  function switchMode(next) {
    setMode(next)
    setError('')
    setPasswordConfirm('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (mode === 'register' && password !== passwordConfirm) {
      setError('两次输入的密码不一致')
      return
    }
    setLoading(true)
    try {
      if (mode === 'login') {
        await signIn(email, password)
        // onAuthStateChange in App.jsx will flip state
      } else {
        await signUp(email, password)
        setRegistered(true)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (registered) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-state-icon">✉️</div>
          <div className="auth-state-title">请查收验证邮件</div>
          <div className="auth-state-desc">
            验证邮件已发送至 <strong>{email}</strong>，请点击邮件中的链接完成注册。
          </div>
          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 16 }}
            onClick={() => { setRegistered(false); setMode('login'); setPassword('') }}
          >
            返回登录
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <LogoMark size={28} color="#E87040" />
          <span className="auth-logo-name">claudecode-hub</span>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setMode('login'); setError('') }}
            type="button"
          >
            登录
          </button>
          <button
            className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => { setMode('register'); setError('') }}
            type="button"
          >
            注册
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label className="form-label">邮箱</label>
            <input
              className="form-input"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-row">
            <label className="form-label">密码</label>
            <input
              className="form-input"
              type="password"
              placeholder={mode === 'register' ? '至少 6 位' : ''}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={mode === 'register' ? 6 : undefined}
            />
          </div>

          {mode === 'register' && (
            <div className="form-row">
              <label className="form-label">确认密码</label>
              <input
                className="form-input"
                type="password"
                placeholder="再次输入密码"
                value={passwordConfirm}
                onChange={e => setPasswordConfirm(e.target.value)}
                required
                minLength={6}
              />
              {passwordConfirm && password !== passwordConfirm && (
                <div className="modal-error" style={{ marginTop: 6 }}>两次输入的密码不一致</div>
              )}
            </div>
          )}

          {error && <div className="modal-error" style={{ marginBottom: 12 }}>{error}</div>}

          <button
            className="btn btn-primary"
            style={{ width: '100%', padding: '11px' }}
            disabled={loading || (mode === 'register' && (!passwordConfirm || password !== passwordConfirm))}
            type="submit"
          >
            {loading
              ? <><span className="spinner" />处理中…</>
              : mode === 'login' ? '登录' : '注册'}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'login'
            ? <>没有账号？<button type="button" className="auth-link" onClick={() => switchMode('register')}>去注册</button></>
            : <>已有账号？<button type="button" className="auth-link" onClick={() => switchMode('login')}>去登录</button></>
          }
        </div>
      </div>
    </div>
  )
}
