import { useState } from 'react'
import { addRelayAccount } from '../api.js'

/**
 * Add a third-party relay station as a fallback account.
 * Relays use a static x-api-key and don't return Anthropic rate-limit headers,
 * so they only serve requests when all OAuth accounts are cooling/exhausted.
 * Optional model-name remapping per tier handles relays that only expose
 * older model IDs (e.g. opus-4-6 instead of opus-4-7).
 */
export default function RelayModal({ onClose, onSuccess }) {
  const [nickname, setNickname] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [mapOpus, setMapOpus] = useState('')
  const [mapSonnet, setMapSonnet] = useState('')
  const [mapHaiku, setMapHaiku] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!nickname.trim()) return setError('请填写昵称')
    if (!/^https:\/\//i.test(baseUrl.trim())) return setError('Base URL 必须以 https:// 开头')
    if (!apiKey.trim()) return setError('请填写 API Key')

    const modelMap = {}
    if (mapOpus.trim()) modelMap.opus = mapOpus.trim()
    if (mapSonnet.trim()) modelMap.sonnet = mapSonnet.trim()
    if (mapHaiku.trim()) modelMap.haiku = mapHaiku.trim()

    setLoading(true)
    setError('')
    try {
      const acc = await addRelayAccount({
        nickname: nickname.trim(),
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim(),
        modelMap,
      })
      onSuccess(acc)
    } catch (err) {
      setError(err.message || '添加失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">添加中转站</div>
        <div className="modal-subtitle" style={{ color: '#78716c', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
          中转账号仅在所有 OAuth 账号全部耗尽时作为 fallback 使用。
          若中转站仅支持特定模型名，可在下方三档填写目标模型名覆盖请求。
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label className="form-label">昵称</label>
            <input className="form-input" value={nickname} onChange={e => setNickname(e.target.value)}
              placeholder="例如：青云TOP" autoFocus />
          </div>
          <div className="form-row">
            <label className="form-label">Base URL</label>
            <input className="form-input" value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
              placeholder="https://api.example.com" />
          </div>
          <div className="form-row">
            <label className="form-label">API Key</label>
            <input className="form-input" type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
              placeholder="sk-xxx" autoComplete="off" />
          </div>

          <div style={{ margin: '16px 0 8px', fontSize: 13, fontWeight: 600, color: '#44403c' }}>
            模型映射 <span style={{ fontWeight: 400, color: '#a8a29e' }}>（留空则透传）</span>
          </div>
          <div className="form-row">
            <label className="form-label">Opus 档 →</label>
            <input className="form-input" value={mapOpus} onChange={e => setMapOpus(e.target.value)}
              placeholder="留空 / 或 claude-opus-4-5-20250929" />
          </div>
          <div className="form-row">
            <label className="form-label">Sonnet 档 →</label>
            <input className="form-input" value={mapSonnet} onChange={e => setMapSonnet(e.target.value)}
              placeholder="留空 / 或 claude-sonnet-4-20250514" />
          </div>
          <div className="form-row">
            <label className="form-label">Haiku 档 →</label>
            <input className="form-input" value={mapHaiku} onChange={e => setMapHaiku(e.target.value)}
              placeholder="留空 / 或 claude-haiku-4-5-20251001" />
          </div>

          {error && <div className="modal-error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>取消</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? '添加中…' : '添加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
