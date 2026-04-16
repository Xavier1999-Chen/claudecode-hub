import { useState } from 'react'
import { oauthStart, oauthSubmitCode, oauthImport } from '../api.js'

export default function OAuthModal({ onClose, onSuccess }) {
  const [step, setStep] = useState(0)  // 0=starting, 1=show url, 2=waiting
  const [sessionId, setSessionId] = useState('')
  const [authUrl, setAuthUrl] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Auto-start on mount
  useState(() => {
    setLoading(true)
    oauthStart().then(data => {
      setSessionId(data.sessionId)
      setAuthUrl(data.authUrl)
      setStep(1)
      setLoading(false)
    }).catch(err => {
      setError('启动失败: ' + err.message)
      setLoading(false)
    })
  }, [])

  async function submitCode() {
    if (!code.trim()) return
    setLoading(true)
    setError('')
    try {
      await oauthSubmitCode(sessionId, code.trim())
      setStep(2)
      const data = await oauthImport(sessionId)
      onSuccess(data.account)
    } catch (err) {
      setError(err.message)
      setStep(1)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">添加账号</div>

        {step === 0 && (
          <div className="oauth-step-info"><span className="spinner" />正在启动登录进程…</div>
        )}

        {step === 1 && (
          <div>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 10 }}>
              点击下方链接，用目标 Claude 账号授权，然后将页面显示的 <strong>Authentication Code</strong> 粘贴到下方：
            </p>
            <a href={authUrl} target="_blank" rel="noreferrer" className="oauth-url-box">{authUrl}</a>
            <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(authUrl)}>复制链接</button>
            </div>
            <div className="form-row" style={{ marginTop: 12 }}>
              <label className="form-label">Authentication Code</label>
              <div className="oauth-code-row">
                <input
                  className="form-input"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submitCode()}
                  placeholder="粘贴 Authentication Code…"
                />
                <button
                  className="btn btn-primary"
                  style={{ flexShrink: 0 }}
                  disabled={!code || loading}
                  onClick={submitCode}
                >
                  {loading ? '提交中…' : '提交'}
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="oauth-step-info"><span className="spinner" />正在等待登录完成…</div>
        )}

        {error && <p className="modal-error">{error}</p>}

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
        </div>
      </div>
    </div>
  )
}
