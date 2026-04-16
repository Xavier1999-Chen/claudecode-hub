import { useState } from 'react'
import { updateTerminal, deleteTerminal } from '../api.js'

function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

function age(ts) {
  if (!ts) return '—'
  const diff = Date.now() - ts
  const d = Math.floor(diff / 86400000)
  if (d > 0) return `${d}天`
  const h = Math.floor(diff / 3600000)
  if (h > 0) return `${h}小时`
  return `${Math.floor(diff / 60000)}分钟`
}

function terminalUsage(usageRecords, termId, since) {
  const recs = usageRecords.filter(r => r.terminalId === termId && r.ts >= since)
  const usd = recs.reduce((s, r) => s + (r.usd ?? 0), 0)
  return usd ? '$' + usd.toFixed(4) : '—'
}

export default function TerminalsTab({ terminals, accounts, usageRecords, onRefresh }) {
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')

  const today = new Date().setHours(0, 0, 0, 0)
  const weekAgo = Date.now() - 7 * 86400000

  function accountEmail(accId) {
    return accounts.find(a => a.id === accId)?.email ?? '—'
  }

  function copyToken(token) {
    navigator.clipboard.writeText(token).catch(() => {})
  }

  async function saveRename(t) {
    await updateTerminal(t.id, { name: editName })
    setEditId(null)
    await onRefresh()
  }

  async function handleDelete(id) {
    if (!window.confirm('确认删除此终端？')) return
    await deleteTerminal(id)
    await onRefresh()
  }

  return (
    <div className="main">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>名称</th>
              <th>Token</th>
              <th>模式</th>
              <th>账号</th>
              <th>今日用量</th>
              <th>本周用量</th>
              <th>创建时间</th>
              <th>存在时长</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {terminals.map(t => (
              <tr key={t.id}>
                <td>
                  {editId === t.id ? (
                    <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        className="inline-edit-table"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveRename(t); if (e.key === 'Escape') setEditId(null) }}
                        autoFocus
                      />
                      <button className="btn btn-primary btn-sm" onClick={() => saveRename(t)}>保存</button>
                    </span>
                  ) : (
                    <span style={{ cursor: 'pointer' }} onDoubleClick={() => { setEditId(t.id); setEditName(t.name) }}>
                      {t.name}
                    </span>
                  )}
                </td>
                <td>
                  <span className="token-cell">
                    <span>{t.id.slice(0, 22)}…</span>
                    <button className="copy-btn" onClick={() => copyToken(t.id)}>复制</button>
                  </span>
                </td>
                <td>
                  <span className={`mode-tag ${t.mode === 'auto' ? 'tag-auto' : 'tag-manual'}`}>
                    {t.mode === 'auto' ? '自动' : '手动'}
                  </span>
                </td>
                <td>{accountEmail(t.accountId)}</td>
                <td>{terminalUsage(usageRecords, t.id, today)}</td>
                <td>{terminalUsage(usageRecords, t.id, weekAgo)}</td>
                <td>{fmtDate(t.createdAt)}</td>
                <td><span className="age-badge">{age(t.createdAt)}</span></td>
                <td>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.id)}>删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
