import { useState } from 'react'
import { updateTerminal, forceOnline, forceOffline, deleteAccount, renameAccount, refreshAccountToken, syncAccountUsage } from '../api.js'

function fmtK(n) { if (!n) return '0'; return (n / 1000).toFixed(1) }
function pct(used, limit) { if (!limit) return 0; return Math.min(100, Math.round(used / limit * 100)) }
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

// Per-card action panel (shown in a popover-style expanded section)
function AccountActions({ acc, onAction, onClose }) {
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState(acc.nickname || acc.email)
  const [busy, setBusy] = useState(null)

  async function run(action) {
    setBusy(action)
    try { await onAction(action) } finally { setBusy(null) }
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

      {/* Refresh token */}
      <button className="action-btn" disabled={busy === 'refresh'} onClick={() => run('refresh')}>
        {busy === 'refresh' ? '…' : '🔑 刷新 Token'}
      </button>

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
  const [refreshingId, setRefreshingId] = useState(null) // account id being token-refreshed
  const [syncingId, setSyncingId] = useState(null)       // account id being usage-synced

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
          const expiry = fmtExpiry(acc.tokenExpiresAt)
          const reset5h = fmtReset(acc.rateLimit?.window5h?.resetAt)
          const resetWeek = fmtReset(acc.rateLimit?.weekly?.resetAt)

          return (
            <div
              key={acc.id}
              className={`account-card ${mounted ? 'mounted' : ''} ${exhausted ? 'exhausted' : ''}`}
              onClick={() => !actionsOpen && mountAccount(acc)}
            >
              <div className={`card-header ${exhausted ? 'exhausted' : ''}`}>
                <span className="card-email" title={acc.email}>{displayName}</span>
                <span className={`plan-badge ${acc.plan === 'max' ? 'badge-max' : acc.plan === 'free' ? 'badge-free' : 'badge-pro'}`}>
                  {acc.plan?.toUpperCase() ?? 'PRO'}
                </span>
                <span className={`status-dot ${statusDot(acc)}`} />
                {isAdmin && (
                  <>
                    {/* Sync usage button */}
                    <button
                      className={`card-refresh-btn${syncingId === acc.id ? ' spinning' : ''}`}
                      title="同步用量"
                      onClick={async e => {
                        e.stopPropagation()
                        setSyncingId(acc.id)
                        try {
                          const updated = await syncAccountUsage(acc.id)
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
    </div>
  )
}
