import { useState, useEffect } from 'react'
import { updateTerminal, forceOnline, forceOffline, deleteAccount, renameAccount, refreshAccountToken, syncAccountUsage, updateRelayModelMap, updateProbeModel, listRelayModels } from '../api.js'

function fmtExpiry(ts) {
  if (!ts) return null
  const diff = ts - Date.now()
  if (diff < 0) return '已过期'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}m 后自动刷新` : `${m}m 后自动刷新`
}

function fmtReset(ts) {
  if (!ts) return null
  const diff = ts - Date.now()
  if (diff <= 0) return '即将重置'
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (d > 0) return `${d}d ${h}h ${m}m 后重置`
  return h > 0 ? `${h}h ${m}m 后重置` : `${m}m 后重置`
}

// ── Relay health components ────────────────────────────────────────────────

function useTtlCountdown(ttlMs) {
  const [state, setState] = useState(null) // { receivedAt, ttlMs }
  // Sync from server: update when a fresh ttlMs arrives
  useEffect(() => {
    if (ttlMs == null) { setState(null); return }
    setState(prev => {
      if (!prev) return { receivedAt: Date.now(), ttlMs }
      // Only reset if server gave us a significantly larger value
      // (meaning a new probe cycle started). Otherwise keep counting.
      const localRemaining = prev.ttlMs - (Date.now() - prev.receivedAt)
      if (ttlMs > localRemaining + 2000) return { receivedAt: Date.now(), ttlMs }
      return prev
    })
  }, [ttlMs])
  // Re-render once per second so `remaining` recomputes from Date.now()
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])
  if (!state) return ''
  const remaining = state.ttlMs - (Date.now() - state.receivedAt)
  if (remaining <= 0) return '正在检查'
  const s = Math.ceil(remaining / 1000)
  return s >= 120 ? `${Math.ceil(s / 60)}min 后再次检查` : `${s}s 后再次检查`
}

function RelayHealthRow({ health, hasProbeConfig }) {
  const countdown = useTtlCountdown(health?.ttlMs ?? null)
  if (!hasProbeConfig) {
    return <div className="relay-health-row unknown">⚪ 请先配置探测模型</div>
  }
  if (!health) {
    return <div className="relay-health-row unknown">⚪ 等待首次探测</div>
  }
  if (health.status === 'online') {
    return (
      <div className="relay-health-row online">
        <span className="relay-health-dot dot-green" />
        <span>在线</span>
        <span className="relay-health-latency">{health.latencyMs}ms</span>
        <span className="relay-health-model">{health.model}</span>
        {countdown && <span className="relay-health-next">{countdown}</span>}
      </div>
    )
  }
  return (
    <div className="relay-health-row offline">
      <span className="relay-health-dot dot-red" />
      <span>离线</span>
      {health.error && <span className="relay-health-error" title={health.error}>{health.error.slice(0, 60)}</span>}
      {countdown && <span className="relay-health-next">{countdown}</span>}
    </div>
  )
}

function ProbeModelModal({ acc, onSave, onClose }) {
  const [models, setModels] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(acc.probeModel ?? '')
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listRelayModels(acc.id)
      .then(data => { if (!cancelled) setModels(data.models ?? []) })
      .catch(err => { if (!cancelled) { setError(err.message); setModels([]) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [acc.id])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">设置探测模型</h3>
        <p style={{ fontSize: 12, color: '#78716c', margin: '0 0 12px' }}>
          选择用于健康检测的模型。"与 Opus 映射相同"表示使用模型映射中的 Opus 配置。
        </p>
        {loading && <div style={{ fontSize: 12, color: '#a8a29e' }}>加载模型列表…</div>}
        {error && <div style={{ fontSize: 12, color: '#dc2626' }}>加载失败: {error}</div>}
        <select
          className="probe-model-select"
          value={selected}
          onChange={e => setSelected(e.target.value)}
        >
          <option value="">与 Opus 映射相同</option>
          {models && models.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={() => onSave(selected || null)}>保存</button>
        </div>
      </div>
    </div>
  )
}

// Relay card body with inline-editable model mapping
function RelayCardBody({ acc, mounted, terms }) {
  const hasMap = acc.modelMap && Object.keys(acc.modelMap).length > 0
  const hasProbeConfig = acc.probeModel || acc.modelMap?.opus

  return (
    <>
      <div className="card-body">
        {mounted && <div className="mounted-label">✓ 已挂载</div>}
        {hasMap ? (
          <div className="relay-modelmap" style={{ fontSize: 12, color: '#57534e', lineHeight: 1.6 }}>
            {acc.modelMap.opus && <div>Opus → <code>{acc.modelMap.opus}</code></div>}
            {acc.modelMap.sonnet && <div>Sonnet → <code>{acc.modelMap.sonnet}</code></div>}
            {acc.modelMap.haiku && <div>Haiku → <code>{acc.modelMap.haiku}</code></div>}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#a8a29e' }}>无模型映射 · 原样透传</div>
        )}
        <RelayHealthRow health={acc.health ?? null} hasProbeConfig={hasProbeConfig} />
      </div>
      {terms.length > 0 && (
        <div className="card-footer">
          {terms.map(t => <span key={t.id} className="footer-chip">{t.name}</span>)}
        </div>
      )}
    </>
  )
}

// Per-card action panel (shown in a popover-style expanded section)
function AccountActions({ acc, onAction, onClose }) {
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState(acc.nickname || acc.email)
  const [busy, setBusy] = useState(null)
  const [editingMap, setEditingMap] = useState(false)
  const [mapOpus, setMapOpus] = useState(acc.modelMap?.opus ?? '')
  const [mapSonnet, setMapSonnet] = useState(acc.modelMap?.sonnet ?? '')
  const [mapHaiku, setMapHaiku] = useState(acc.modelMap?.haiku ?? '')

  async function run(action) {
    setBusy(action)
    try { await onAction(action) } finally { setBusy(null) }
  }

  async function saveModelMap() {
    const modelMap = {}
    if (mapOpus.trim()) modelMap.opus = mapOpus.trim()
    if (mapSonnet.trim()) modelMap.sonnet = mapSonnet.trim()
    if (mapHaiku.trim()) modelMap.haiku = mapHaiku.trim()
    setBusy('modelmap')
    try { await onAction('modelmap:' + JSON.stringify(modelMap)) } finally { setBusy(null) }
    setEditingMap(false)
  }

  const exhausted = acc.status === 'exhausted'

  return (
    <div
      className="account-actions-panel"
      onClick={e => e.stopPropagation()}
    >
      {/* Rename */}
      {renaming ? (
        <div className="action-rename-row">
          <input
            className="inline-edit"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { run('rename:' + newName); setRenaming(false) }
              if (e.key === 'Escape') setRenaming(false)
            }}
            autoFocus
          />
          <button className="btn btn-primary btn-sm" onClick={() => { run('rename:' + newName); setRenaming(false) }}>保存</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setRenaming(false)}>取消</button>
        </div>
      ) : (
        <button className="action-btn" onClick={() => { setNewName(acc.nickname || acc.email); setRenaming(true) }}>
          ✏️ 重命名
        </button>
      )}

      {/* Model map editing — relay only */}
      {acc.type === 'relay' && (
        editingMap ? (
          <div className="relay-map-edit" style={{ fontSize: 12, padding: '4px 0' }}>
            <div className="relay-map-row">
              <span className="relay-map-label">Opus →</span>
              <input className="inline-edit" value={mapOpus} onChange={e => setMapOpus(e.target.value)}
                placeholder="留空则透传" style={{ flex: 1 }} />
            </div>
            <div className="relay-map-row">
              <span className="relay-map-label">Sonnet →</span>
              <input className="inline-edit" value={mapSonnet} onChange={e => setMapSonnet(e.target.value)}
                placeholder="留空则透传" style={{ flex: 1 }} />
            </div>
            <div className="relay-map-row">
              <span className="relay-map-label">Haiku →</span>
              <input className="inline-edit" value={mapHaiku} onChange={e => setMapHaiku(e.target.value)}
                placeholder="留空则透传" style={{ flex: 1 }} />
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button className="btn btn-primary btn-sm" onClick={saveModelMap} disabled={busy === 'modelmap'}>
                {busy === 'modelmap' ? '…' : '保存'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingMap(false)}>取消</button>
            </div>
          </div>
        ) : (
          <button className="action-btn" onClick={() => {
            setMapOpus(acc.modelMap?.opus ?? '')
            setMapSonnet(acc.modelMap?.sonnet ?? '')
            setMapHaiku(acc.modelMap?.haiku ?? '')
            setEditingMap(true)
          }}>
            🔀 编辑模型映射
          </button>
        )
      )}

      {/* Probe model — relay only */}
      {acc.type === 'relay' && (
        <button className="action-btn" onClick={() => onAction('probe-modal')}>
          🩺 设置探测模型
        </button>
      )}

      {/* Online / Offline toggle */}
      {exhausted ? (
        <button className="action-btn action-btn-success" disabled={busy === 'online'} onClick={() => run('online')}>
          {busy === 'online' ? '…' : '✓ 强制上线'}
        </button>
      ) : (
        <button className="action-btn action-btn-warn" disabled={busy === 'offline'} onClick={() => run('offline')}>
          {busy === 'offline' ? '…' : '⏸ 强制下线'}
        </button>
      )}

      {/* Refresh token — OAuth only */}
      {acc.type !== 'relay' && (
        <button className="action-btn" disabled={busy === 'refresh'} onClick={() => run('refresh')}>
          {busy === 'refresh' ? '…' : '🔑 刷新 Token'}
        </button>
      )}

      {/* Delete */}
      <button className="action-btn action-btn-danger" disabled={busy === 'delete'} onClick={() => run('delete')}>
        {busy === 'delete' ? '…' : '🗑 删除账号'}
      </button>
    </div>
  )
}

export default function AccountsTab({ accounts, terminals, onRefresh, onNewTerminal, isAdmin = false }) {
  const [selectedTerminal, setSelectedTerminal] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [editNameValue, setEditNameValue] = useState('')
  const [expandedCard, setExpandedCard] = useState(null) // account id with open actions
  const [syncingId, setSyncingId] = useState(null)       // account id being usage-synced
  const [probeModalAcc, setProbeModalAcc] = useState(null) // relay account for probe modal

  function selectTerminal(t) {
    if (selectedTerminal?.id === t.id) {
      setSelectedTerminal(null); setDetailOpen(false)
    } else {
      setSelectedTerminal(t); setDetailOpen(true)
    }
  }

  function mountedAccountEmail(t) {
    if (!t.accountId) return '未挂载'
    const acc = accounts.find(a => a.id === t.accountId)
    return acc?.nickname || acc?.email || t.accountId
  }

  function terminalsOnAccount(accId) {
    return terminals.filter(t => t.accountId === accId)
  }

  function isMounted(acc) {
    return syncedTerminal?.accountId === acc.id
  }

  function isWindowRateLimited(w) {
    if (!w) return false
    return w.status === 'blocked' || (w.utilization != null && w.utilization >= 1.0)
  }

  function isRateLimited(acc) {
    return isWindowRateLimited(acc.rateLimit?.window5h) || isWindowRateLimited(acc.rateLimit?.weekly)
  }

  function statusDot(acc) {
    if (acc.type === 'relay') {
      if (acc.health?.status === 'offline') return 'dot-red'
      if (acc.health?.status === 'online') return 'dot-green'
      return 'dot-gray'
    }
    if (acc.status === 'exhausted' || isRateLimited(acc)) return 'dot-red'
    if (acc.status === 'idle') return 'dot-green'
    return 'dot-gray'
  }

  async function mountAccount(acc) {
    if (!selectedTerminal || acc.status === 'exhausted' || isRateLimited(acc)) return
    if (expandedCard === acc.id) return  // don't mount when actions panel is open
    await updateTerminal(selectedTerminal.id, { accountId: acc.id, mode: 'manual' })
    await onRefresh()
  }

  async function saveTerminalName() {
    if (!selectedTerminal) return
    await updateTerminal(selectedTerminal.id, { name: editNameValue })
    setEditingName(false)
    await onRefresh()
  }

  // Pick best account from the pool, excluding one optional ID.
  // Prefer non-exhausted accounts sorted by 5h usage (least used first).
  // Fallback: soonest cooldown expiry.
  function bestAccount(excludeId = null) {
    const pool = excludeId ? accounts.filter(a => a.id !== excludeId) : accounts
    const available = pool.filter(a => a.status !== 'exhausted')
    if (available.length) {
      return available.sort((a, b) =>
        (a.rateLimit?.window5h?.used ?? 0) - (b.rateLimit?.window5h?.used ?? 0)
      )[0]
    }
    return pool.filter(a => a.cooldownUntil).sort((a, b) => a.cooldownUntil - b.cooldownUntil)[0] ?? null
  }

  // Reassign terminals whose account is being removed.
  // modes=null → all modes; modes=['auto'] → auto only
  async function reassignTerminals(removedAccountId, modes) {
    const affected = terminals.filter(t =>
      t.accountId === removedAccountId &&
      (modes === null || modes.includes(t.mode))
    )
    if (!affected.length) return
    const best = bestAccount(removedAccountId)
    await Promise.all(affected.map(t => updateTerminal(t.id, { accountId: best?.id ?? null })))
  }

  async function setMode(mode) {
    if (!selectedTerminal) return
    await updateTerminal(selectedTerminal.id, { mode })
    // Switching to auto with no account → immediately assign best available
    if (mode === 'auto' && !syncedTerminal?.accountId) {
      const best = bestAccount()
      if (best) await updateTerminal(selectedTerminal.id, { accountId: best.id })
    }
    await onRefresh()
  }

  async function handleCardAction(acc, action) {
    if (action === 'online') {
      await forceOnline(acc.id)
    } else if (action === 'offline') {
      await forceOffline(acc.id)
      // Force-offline: only reassign auto-mode terminals
      await reassignTerminals(acc.id, ['auto'])
    } else if (action === 'refresh') {
      await refreshAccountToken(acc.id)
    } else if (action === 'delete') {
      if (!window.confirm(`确认删除账号 ${acc.email}？`)) return
      // Delete: reassign ALL terminals (auto + manual)
      await reassignTerminals(acc.id, null)
      await deleteAccount(acc.id)
      setExpandedCard(null)
    } else if (action.startsWith('rename:')) {
      await renameAccount(acc.id, action.slice(7))
    } else if (action.startsWith('modelmap:')) {
      await updateRelayModelMap(acc.id, JSON.parse(action.slice(9)))
    } else if (action === 'probe-modal') {
      setProbeModalAcc(acc)
      return
    }
    await onRefresh()
  }

  function copyToken(token) {
    navigator.clipboard.writeText(token).catch(() => {})
  }

  const syncedTerminal = selectedTerminal
    ? terminals.find(t => t.id === selectedTerminal.id) ?? selectedTerminal
    : null

  return (
    <div className="main">
      {/* Terminal Bar */}
      <div className="terminal-bar">
        <div className="terminal-bar-main">
          <span className="bar-label">终端</span>
          <div className="terminal-list">
            {terminals.map(t => (
              <div
                key={t.id}
                className={`terminal-chip ${syncedTerminal?.id === t.id ? 'selected' : ''}`}
                onClick={() => selectTerminal(t)}
              >
                <span className={`chip-dot ${t.lastUsedAt ? 'dot-active' : 'dot-idle'}`} />
                <span className="chip-name">{t.name}</span>
                <span className="chip-sub">{mountedAccountEmail(t)}</span>
                <span className={`chip-mode ${t.mode === 'auto' ? 'chip-mode-auto' : 'chip-mode-manual'}`}>
                  {t.mode === 'auto' ? '自动' : '手动'}
                </span>
              </div>
            ))}
            <div className="terminal-chip add-chip" onClick={onNewTerminal}>+ 新建</div>
          </div>
          {syncedTerminal && (
            <button className="detail-toggle-btn" onClick={() => setDetailOpen(o => !o)}>
              <span>{detailOpen ? '收起详情' : '展开详情'}</span>
              <span style={{ fontSize: 10, transform: detailOpen ? '' : 'rotate(180deg)', display: 'inline-block', transition: 'transform .2s' }}>▲</span>
            </button>
          )}
        </div>

        {syncedTerminal && detailOpen && (
          <div className="detail-strip">
            <div className="detail-field">
              <span className="detail-label">终端名称</span>
              <div className="detail-value">
                {editingName ? (
                  <>
                    <input
                      className="inline-edit"
                      value={editNameValue}
                      onChange={e => setEditNameValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveTerminalName(); if (e.key === 'Escape') setEditingName(false) }}
                      autoFocus
                    />
                    <button className="btn btn-primary btn-sm" onClick={saveTerminalName}>保存</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingName(false)}>取消</button>
                  </>
                ) : (
                  <>
                    <span>{syncedTerminal.name}</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditingName(true); setEditNameValue(syncedTerminal.name) }}>重命名</button>
                  </>
                )}
              </div>
            </div>
            <div className="detail-field">
              <span className="detail-label">Token</span>
              <div className="detail-value">
                <span className="token-display">{syncedTerminal.id}</span>
                <button className="copy-btn" onClick={() => copyToken(syncedTerminal.id)}>复制</button>
              </div>
            </div>
            <div className="detail-field">
              <span className="detail-label">模式</span>
              <div className="mode-toggle">
                <button className={`mode-btn ${syncedTerminal.mode === 'auto' ? 'active' : ''}`} onClick={() => setMode('auto')}>自动</button>
                <button className={`mode-btn ${syncedTerminal.mode === 'manual' ? 'active' : ''}`} onClick={() => setMode('manual')}>手动</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {syncedTerminal && (
        <p className="mount-hint">
          点击账号卡片将终端 <strong>{syncedTerminal.name}</strong> 挂载到该账号
        </p>
      )}

      <div className="accounts-grid">
        {accounts.map(acc => {
          const w5h = acc.rateLimit?.window5h
          const wk = acc.rateLimit?.weekly
          // utilization is 0-1 from Anthropic headers; null means never synced
          const p5h = w5h?.utilization != null ? Math.round(w5h.utilization * 100) : null
          const pw  = wk?.utilization  != null ? Math.round(wk.utilization  * 100) : null
          const mounted = isMounted(acc)
          const exhausted = acc.status === 'exhausted' || isRateLimited(acc)
          const terms = terminalsOnAccount(acc.id)
          const actionsOpen = expandedCard === acc.id
          const displayName = acc.nickname || acc.email
          const isRelay = acc.type === 'relay'
          const expiry = !isRelay && fmtExpiry(acc.tokenExpiresAt)
          const reset5h = fmtReset(acc.rateLimit?.window5h?.resetAt)
          const resetWeek = fmtReset(acc.rateLimit?.weekly?.resetAt)

          return (
            <div
              key={acc.id}
              className={`account-card ${mounted ? 'mounted' : ''} ${exhausted ? 'exhausted' : ''}`}
              onClick={() => !actionsOpen && mountAccount(acc)}
            >
              <div className={`card-header ${exhausted ? 'exhausted' : ''}`}>
                <span className="card-email" title={acc.email || acc.baseUrl}>{displayName}</span>
                {isRelay ? (
                  <span className="plan-badge badge-relay">中转</span>
                ) : (
                  <span className={`plan-badge ${acc.plan === 'max' ? 'badge-max' : acc.plan === 'free' ? 'badge-free' : 'badge-pro'}`}>
                    {acc.plan?.toUpperCase() ?? 'PRO'}
                  </span>
                )}
                <span className={`status-dot ${statusDot(acc)}`} />
                {isAdmin && (
                  <>
                    {/* Sync usage / health check button */}
                    <button
                      className={`card-refresh-btn${syncingId === acc.id ? ' spinning' : ''}`}
                      title={isRelay ? '检测连通性' : '同步用量'}
                      onClick={async e => {
                        e.stopPropagation()
                        setSyncingId(acc.id)
                        try {
                          await syncAccountUsage(acc.id)
                          await onRefresh()
                        } finally { setSyncingId(null) }
                      }}
                      disabled={syncingId === acc.id}
                    >
                      ↻
                    </button>
                    {/* Edit toggle button */}
                    <button
                      className="card-edit-btn"
                      title="管理账号"
                      onClick={e => { e.stopPropagation(); setExpandedCard(actionsOpen ? null : acc.id) }}
                    >
                      {actionsOpen ? '×' : '⋯'}
                    </button>
                  </>
                )}
              </div>

              {actionsOpen ? (
                <AccountActions
                  acc={acc}
                  onAction={action => handleCardAction(acc, action)}
                  onClose={() => setExpandedCard(null)}
                />
              ) : isRelay ? (
                <RelayCardBody acc={acc} mounted={mounted} terms={terms} />
              ) : (
                <>
                  <div className="card-body">
                    {mounted && <div className="mounted-label">✓ 已挂载</div>}
                    {expiry && <div className="token-expiry">Auth Token {expiry}</div>}
                    <div className="usage-row">
                      <div className="usage-meta">
                        <span>
                          5小时窗口
                          {reset5h && <span className="usage-reset"> · {reset5h}</span>}
                          {isWindowRateLimited(acc.rateLimit?.window5h) && <span className="cooling-icon"> · 冷却中</span>}
                        </span>
                        <span className="usage-pct">{p5h !== null ? `${p5h}%` : '—'}</span>
                      </div>
                      {p5h !== null ? (
                        <div className="progress-bar">
                          <div className={`progress-fill ${p5h > 85 ? 'danger' : ''}`} style={{ width: `${p5h}%` }} />
                        </div>
                      ) : (
                        <div className="usage-tokens usage-unsynced">点击 ↻ 同步用量</div>
                      )}
                    </div>
                    <div className="usage-row">
                      <div className="usage-meta">
                        <span>
                          本周
                          {resetWeek && <span className="usage-reset"> · {resetWeek}</span>}
                          {isWindowRateLimited(acc.rateLimit?.weekly) && <span className="cooling-icon"> · 冷却中</span>}
                        </span>
                        <span className="usage-pct">{pw !== null ? `${pw}%` : '—'}</span>
                      </div>
                      {pw !== null ? (
                        <div className="progress-bar">
                          <div className={`progress-fill ${pw > 85 ? 'danger' : ''}`} style={{ width: `${pw}%` }} />
                        </div>
                      ) : (
                        <div className="usage-tokens usage-unsynced">点击 ↻ 同步用量</div>
                      )}
                    </div>
                  </div>
                  {terms.length > 0 && (
                    <div className="card-footer">
                      {terms.map(t => <span key={t.id} className="footer-chip">{t.name}</span>)}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      {probeModalAcc && (
        <ProbeModelModal
          acc={probeModalAcc}
          onSave={async (model) => {
            await updateProbeModel(probeModalAcc.id, model)
            setProbeModalAcc(null)
            await onRefresh()
          }}
          onClose={() => setProbeModalAcc(null)}
        />
      )}
    </div>
  )
}
