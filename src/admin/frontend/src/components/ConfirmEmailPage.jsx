import { useState } from 'react'
import { confirmEmail } from '../api.js'

// Intermediate page that the email-verification link lands on. The Supabase
// email template MUST be configured to point here, e.g.:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
// Verification only fires on a real button click — see GitHub #6 for why
// we cannot let Supabase auto-consume the token on link load.
export default function ConfirmEmailPage({ tokenHash, type }) {
  const [state, setState] = useState('idle') // 'idle' | 'verifying' | 'success' | 'error'
  const [error, setError] = useState('')

  async function handleConfirm() {
    setState('verifying')
    setError('')
    try {
      await confirmEmail({ tokenHash, type })
      setState('success')
      // Strip auth params so a refresh lands on the normal app
      window.history.replaceState({}, '', '/')
      setTimeout(() => { window.location.href = '/' }, 1500)
    } catch (e) {
      setError(e.message)
      setState('error')
    }
  }

  if (state === 'success') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-state-icon">✅</div>
          <div className="auth-state-title">邮箱验证成功</div>
          <div className="auth-state-desc">即将跳转到登录页…</div>
        </div>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-state-icon">⚠️</div>
          <div className="auth-state-title">验证失败</div>
          <div className="auth-state-desc">{error}</div>
          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 16 }}
            onClick={() => { window.location.href = '/' }}
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
        <div className="auth-state-icon">✉️</div>
        <div className="auth-state-title">确认邮箱验证</div>
        <div className="auth-state-desc">
          点击下方按钮完成邮箱验证。
        </div>
        <button
          className="btn btn-primary"
          style={{ width: '100%', marginTop: 16, padding: '11px' }}
          disabled={state === 'verifying'}
          onClick={handleConfirm}
        >
          {state === 'verifying'
            ? <><span className="spinner" />验证中…</>
            : '点击完成验证'}
        </button>
      </div>
    </div>
  )
}
