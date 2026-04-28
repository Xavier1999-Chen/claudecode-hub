import { useState } from 'react'
import { addAggregatedAccount } from '../api.js'

export default function AggregatedModal({ onClose, onSuccess }) {
  const [step, setStep] = useState(1)
  const [nickname, setNickname] = useState('')
  const [plan, setPlan] = useState('max')
  const [providers, setProviders] = useState([{ name: '', baseUrl: '', apiKey: '', probeModel: '' }])
  const [routing, setRouting] = useState({
    opus: { providerIndex: 0, model: '' },
    sonnet: { providerIndex: 0, model: '' },
    haiku: { providerIndex: 0, model: '' },
    image: { providerIndex: 0, model: '' },
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  function addProvider() {
    setProviders([...providers, { name: '', baseUrl: '', apiKey: '', probeModel: '' }])
  }

  function removeProvider(idx) {
    setProviders(providers.filter((_, i) => i !== idx))
    const next = {}
    for (const key of ['opus', 'sonnet', 'haiku', 'image']) {
      const r = routing[key]
      if (!r) { next[key] = { providerIndex: 0, model: '' }; continue }
      if (r.providerIndex === idx) { next[key] = { providerIndex: 0, model: '' }; continue }
      if (r.providerIndex > idx) { next[key] = { ...r, providerIndex: r.providerIndex - 1 }; continue }
      next[key] = r
    }
    setRouting(next)
  }

  function updateProvider(idx, field, value) {
    setProviders(providers.map((p, i) => i === idx ? { ...p, [field]: value } : p))
  }

  function updateRouting(key, field, value) {
    setRouting({ ...routing, [key]: { ...routing[key], [field]: value } })
  }

  function validate() {
    if (!nickname.trim()) return '请输入聚合卡片名称'
    if (providers.length === 0) return '至少添加一个供应商'
    for (let i = 0; i < providers.length; i++) {
      const p = providers[i]
      if (!p.name.trim()) return `供应商 ${i + 1} 名称不能为空`
      if (!p.baseUrl.trim()) return `供应商 ${i + 1} Base URL 不能为空`
      if (!p.apiKey.trim()) return `供应商 ${i + 1} API Key 不能为空`
    }
    if (!routing.opus?.model?.trim() && !routing.sonnet?.model?.trim() && !routing.haiku?.model?.trim()) {
      return '至少配置 Opus、Sonnet 或 Haiku 中的一项路由'
    }
    return null
  }

  async function submit() {
    const err = validate()
    if (err) { setError(err); return }
    setBusy(true)
    setError(null)
    try {
      const cleanProviders = providers.map(p => ({
        name: p.name.trim(),
        baseUrl: p.baseUrl.trim(),
        apiKey: p.apiKey.trim(),
        probeModel: p.probeModel.trim() || undefined,
      }))
      const cleanRouting = {}
      for (const key of ['opus', 'sonnet', 'haiku', 'image']) {
        const r = routing[key]
        if (r?.model?.trim()) {
          cleanRouting[key] = { providerIndex: r.providerIndex, model: r.model.trim() }
        }
      }
      await addAggregatedAccount({ nickname: nickname.trim(), providers: cleanProviders, routing: cleanRouting, plan })
      onSuccess()
    } catch (e) {
      setError(e.message || '创建失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ width: 520, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">添加聚合卡片</h3>

        {step === 1 && (
          <>
            <div className="form-row">
              <label className="form-label">卡片名称</label>
              <input
                className="form-input"
                placeholder="例如：DeepSeek + GLM"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
              />
            </div>
            <div className="form-row">
              <label className="form-label">等级</label>
              <select className="form-input" value={plan} onChange={e => setPlan(e.target.value)}>
                <option value="pro">PRO</option>
                <option value="max">MAX</option>
                <option value="max_20x">MAX 20x</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={onClose}>取消</button>
              <button className="btn btn-primary" onClick={() => setStep(2)}>下一步</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p style={{ fontSize: 12, color: '#78716c', marginBottom: 12 }}>配置上游供应商（Base URL + API Key）</p>
            {providers.map((p, i) => (
              <div key={i} style={{ border: '1px solid #e7e5e4', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>供应商 {i + 1}</span>
                  {providers.length > 1 && (
                    <button className="btn btn-ghost btn-sm" onClick={() => removeProvider(i)}>删除</button>
                  )}
                </div>
                <div className="form-row" style={{ marginBottom: 8 }}>
                  <input className="form-input" placeholder="名称，如 DeepSeek" value={p.name} onChange={e => updateProvider(i, 'name', e.target.value)} />
                </div>
                <div className="form-row" style={{ marginBottom: 8 }}>
                  <input className="form-input" placeholder="Base URL，如 https://api.deepseek.com" value={p.baseUrl} onChange={e => updateProvider(i, 'baseUrl', e.target.value)} />
                </div>
                <div className="form-row" style={{ marginBottom: 8 }}>
                  <input className="form-input" placeholder="API Key" value={p.apiKey} onChange={e => updateProvider(i, 'apiKey', e.target.value)} />
                </div>
                <div className="form-row" style={{ marginBottom: 0 }}>
                  <input className="form-input" placeholder="探测模型（可选）" value={p.probeModel} onChange={e => updateProvider(i, 'probeModel', e.target.value)} />
                </div>
              </div>
            ))}
            <button className="btn btn-ghost" style={{ width: '100%', marginBottom: 12 }} onClick={addProvider}>+ 添加供应商</button>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setStep(1)}>上一步</button>
              <button className="btn btn-primary" onClick={() => setStep(3)}>下一步</button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <p style={{ fontSize: 12, color: '#78716c', marginBottom: 12 }}>根据请求的模型自动路由到对应供应商</p>
            {['opus', 'sonnet', 'haiku', 'image'].map(key => (
              <div key={key} style={{ marginBottom: 10 }}>
                <label className="form-label" style={{ textTransform: 'capitalize', marginBottom: 4 }}>
                  {key === 'image' ? '图片路由（可选）' : key}
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    className="form-input"
                    style={{ width: 140, flexShrink: 0 }}
                    value={routing[key]?.providerIndex ?? 0}
                    onChange={e => updateRouting(key, 'providerIndex', parseInt(e.target.value, 10))}
                  >
                    {providers.map((p, i) => (
                      <option key={i} value={i}>{p.name || `供应商 ${i + 1}`}</option>
                    ))}
                  </select>
                  <input
                    className="form-input"
                    placeholder="目标模型名，如 deepseek-v4-pro"
                    value={routing[key]?.model ?? ''}
                    onChange={e => updateRouting(key, 'model', e.target.value)}
                  />
                </div>
              </div>
            ))}
            {error && <div className="modal-error">{error}</div>}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setStep(2)}>上一步</button>
              <button className="btn btn-primary" onClick={submit} disabled={busy}>
                {busy ? '创建中…' : '创建'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
