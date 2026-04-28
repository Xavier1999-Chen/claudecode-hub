import { useState, useEffect, useMemo } from 'react'
import { getUsage } from '../api.js'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell,
  PieChart, Pie, LabelList,
  useXAxisScale, useYAxisScale,
} from 'recharts'

const PALETTE = ['#E87040', '#93c5fd', '#6ee7b7', '#c4b5fd', '#fde68a', '#f9a8d4', '#5eead4']
const MODEL_COLORS = { sonnet: '#E87040', haiku: '#FDDCCC', opus: '#C0532A' }

function modelKey(mdl, tier) {
  // tier 是 proxy 端按"原始请求的模型前缀"记录的归一化字段，
  // 优先采用，避免聚合账号 upstream 模型名（如 kimi-for-coding）被误归到 sonnet。
  if (tier === 'opus' || tier === 'sonnet' || tier === 'haiku') return tier
  if (!mdl) return 'unknown'
  if (mdl.includes('opus')) return 'opus'
  if (mdl.includes('haiku')) return 'haiku'
  return 'sonnet'
}

function modelLabel(key) {
  return key.charAt(0).toUpperCase() + key.slice(1)
}

function fmtUsd(n) { return n < 0.01 ? n.toFixed(4) : n.toFixed(2) }

function fmtTok(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(Math.round(n))
}
function fmtTokCell(n) { return n ? fmtTok(n) : '—' }
function fmtValue(v, mode) { return mode === 'tokens' ? fmtTok(v) : '$' + fmtUsd(v) }

function valueOf(r, mode) {
  return mode === 'tokens' ? (r.in ?? 0) + (r.out ?? 0) : (r.usd ?? 0)
}

function axisFmt(v, isTokens) {
  return isTokens
    ? (v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : (v / 1000).toFixed(0) + 'k')
    : '$' + v.toFixed(2)
}

function DayTick({ x, y, payload }) {
  const isToday = payload.value === '今日'
  return (
    <text
      x={x} y={y + 12}
      textAnchor="middle"
      fontSize={12}
      fill={isToday ? '#E87040' : '#78716c'}
      fontWeight={isToday ? 600 : 400}
    >
      {payload.value}
    </text>
  )
}

function StackLabels({ rows, viewMode }) {
  const xScale = useXAxisScale()
  const yScale = useYAxisScale()
  if (!xScale || !yScale) return null
  return (
    <g>
      {rows.map((row) => {
        if (!row._total || row._total < 1) return null
        const cx = xScale(row.day, { position: 'middle' })
        const cy = yScale(row._total)
        if (cx == null || cy == null) return null
        return (
          <text key={row.day} x={cx} y={cy - 4} textAnchor="middle" fill="#78716c" fontSize={11} fontWeight={600}>
            {fmtValue(row._total, viewMode)}
          </text>
        )
      })}
    </g>
  )
}

function DonutCenter({ cx, cy, total, label, mode }) {
  return (
    <>
      <text x={cx} y={cy - 8} textAnchor="middle" fill="#1c1917" fontSize={mode === 'tokens' ? 14 : 18} fontWeight={700}>
        {fmtValue(total, mode)}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="#78716c" fontSize={12}>
        {label}
      </text>
    </>
  )
}

function Trend({ value, label }) {
  if (value === null) return null
  const cls = value >= 0 ? 'trend-up' : 'trend-down'
  return <div className={`stat-trend ${cls}`}>{value >= 0 ? '↑' : '↓'}{Math.abs(value)}% {label}</div>
}

function TokenIOCell({ data }) {
  return (
    <td className="token-io">
      {(data.in || data.out)
        ? <>{fmtTokCell(data.in)} <span className="io-sep">/</span> {fmtTokCell(data.out)}</>
        : <span className="io-none">—</span>}
    </td>
  )
}

export default function UsageTab({ accounts, terminals }) {
  const [range, setRange] = useState('today')
  const [group, setGroup] = useState('terminal')
  const [viewMode, setViewMode] = useState('tokens')
  const [records, setRecords] = useState([])
  const [prevRecords, setPrevRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedBreakdown, setSelectedBreakdown] = useState(null)

  useEffect(() => {
    setLoading(true)
    getUsage(range, group).then(data => {
      setRecords(data.records ?? [])
      setPrevRecords(data.prevRecords ?? [])
      setLoading(false)
    })
  }, [range, group])

  const rangeLabel = range === 'today' ? '今日' : range === '7d' ? '7天' : '30天'
  const trendLabel = range === 'today' ? '较昨日' : range === '7d' ? '较上周' : '较上月'
  const days = range === 'today' ? 1 : range === '7d' ? 7 : 30

  const totalUsd = useMemo(() => records.reduce((s, r) => s + (r.usd ?? 0), 0), [records])
  const totalTokens = useMemo(() => records.reduce((s, r) => s + (r.in ?? 0) + (r.out ?? 0), 0), [records])
  const totalReqs = records.length
  const avgDailyUsd = totalUsd / days
  const avgDailyTok = totalTokens / days

  const prevUsd = useMemo(() => prevRecords.reduce((s, r) => s + (r.usd ?? 0), 0), [prevRecords])
  const prevTokens = useMemo(() => prevRecords.reduce((s, r) => s + (r.in ?? 0) + (r.out ?? 0), 0), [prevRecords])
  const prevReqs = prevRecords.length

  const trendUsd = prevUsd > 0 ? Math.round((totalUsd - prevUsd) / prevUsd * 100) : null
  const trendTok = prevTokens > 0 ? Math.round((totalTokens - prevTokens) / prevTokens * 100) : null
  const trendReqs = prevReqs > 0 ? Math.round((totalReqs - prevReqs) / prevReqs * 100) : null

  const yStart = new Date(); yStart.setDate(yStart.getDate() - 1); yStart.setHours(0, 0, 0, 0)
  const yEnd = new Date(); yEnd.setHours(0, 0, 0, 0)
  const yesterdayUsd = records.filter(r => r.ts >= yStart.getTime() && r.ts < yEnd.getTime()).reduce((s, r) => s + (r.usd ?? 0), 0)

  const DELETED_ACCOUNT = '__deleted_account__'
  const DELETED_TERMINAL = '__deleted_terminal__'
  const groupKey = r => {
    if (group === 'account') {
      const exists = accounts.some(a => a.id === r.accountId)
      return exists ? r.accountId : DELETED_ACCOUNT
    }
    const exists = terminals.some(t => t.id === r.terminalId)
    return exists ? r.terminalId : DELETED_TERMINAL
  }
  const labelFor = id => {
    if (id === DELETED_ACCOUNT) return '已删除账号'
    if (id === DELETED_TERMINAL) return '已删除终端'
    if (group === 'account') {
      const acc = accounts.find(a => a.id === id)
      return acc?.nickname || acc?.email || id
    }
    return terminals.find(t => t.id === id)?.name || id
  }

  const dailyData = useMemo(() => {
    const dayMap = {}
    const keysSet = new Set()
    for (const r of records) {
      const day = new Date(r.ts).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
      const k = groupKey(r)
      if (!dayMap[day]) dayMap[day] = {}
      dayMap[day][k] = (dayMap[day][k] ?? 0) + valueOf(r, viewMode)
      keysSet.add(k)
    }
    const allKeys = [...keysSet]
    const todayLabel = new Date().toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
    const rows = Object.keys(dayMap).sort().map(d => {
      const entry = dayMap[d]
      const _total = Object.values(entry).reduce((s, v) => s + v, 0)
      // Use Number.EPSILON (not 0) so LabelList fires even when a key has no data for this day
      const filled = {}
      for (const k of allKeys) filled[k] = entry[k] ?? Number.EPSILON
      return { day: d === todayLabel ? '今日' : d, ...filled, _total }
    })
    const maxTotal = rows.reduce((m, r) => Math.max(m, r._total), 0)
    return { rows, keys: allKeys, maxTotal }
  }, [records, group, accounts, terminals, viewMode])

  const donutData = useMemo(() => {
    const map = {}
    for (const r of records) {
      const k = modelKey(r.mdl, r.tier)
      map[k] = (map[k] ?? 0) + valueOf(r, viewMode)
    }
    return Object.entries(map).map(([k, v]) => ({ name: modelLabel(k), value: v, color: MODEL_COLORS[k] ?? '#a8a29e' }))
  }, [records, viewMode])
  const donutTotal = donutData.reduce((s, d) => s + d.value, 0) || 1

  const breakdownItems = useMemo(() => {
    const ids = [...new Set(records.map(groupKey))]
    return ids.map((id, i) => ({
      id,
      label: labelFor(id),
      mode: group === 'terminal' ? (terminals.find(t => t.id === id)?.mode ?? null) : null,
      color: PALETTE[i % PALETTE.length],
    }))
  }, [records, group, accounts, terminals])

  useEffect(() => {
    setSelectedBreakdown(prev => {
      if (prev != null && breakdownItems.some(item => item.id === prev)) {
        return prev
      }
      return breakdownItems[0]?.id ?? null
    })
  }, [breakdownItems])

  const breakdownChartData = useMemo(() => {
    if (!selectedBreakdown) return []
    const recs = records.filter(r => groupKey(r) === selectedBreakdown)
    const map = {}
    for (const r of recs) {
      const key = modelKey(r.mdl, r.tier)
      map[key] = (map[key] ?? 0) + valueOf(r, viewMode)
    }
    const MODEL_ORDER = ['haiku', 'sonnet', 'opus']
    return Object.entries(map)
      .map(([key, value]) => ({ name: modelLabel(key), value, color: MODEL_COLORS[key] ?? '#a8a29e', _order: MODEL_ORDER.indexOf(key) }))
      .sort((a, b) => a._order - b._order)
  }, [records, selectedBreakdown, group, viewMode])

  // Single grouping pass shared by both detail table views
  const groupedData = useMemo(() => {
    const grouped = {}
    for (const r of records) {
      const k = groupKey(r)
      if (!grouped[k]) grouped[k] = {
        requests: 0, inTokens: 0, outTokens: 0, usd: 0,
        sonnet: { in: 0, out: 0 }, haiku: { in: 0, out: 0 },
        opus: { in: 0, out: 0 }, other: { in: 0, out: 0 },
      }
      const g = grouped[k]
      g.requests++
      g.inTokens += r.in ?? 0
      g.outTokens += r.out ?? 0
      g.usd += r.usd ?? 0
      const bucket = g[modelKey(r.mdl, r.tier)] ?? g.other
      bucket.in += r.in ?? 0
      bucket.out += r.out ?? 0
    }
    return grouped
  }, [records, group])

  const detailRows = useMemo(() => {
    const total = Object.values(groupedData).reduce((s, v) => s + v.usd, 0) || 1
    return Object.entries(groupedData).map(([id, v]) => ({
      id, label: labelFor(id),
      requests: v.requests,
      inTokens: v.inTokens,
      outTokens: v.outTokens,
      usd: v.usd.toFixed(4),
      pct: (v.usd / total * 100).toFixed(1),
    })).sort((a, b) => parseFloat(b.usd) - parseFloat(a.usd))
  }, [groupedData, accounts, terminals])

  const tokenDetailRows = useMemo(() => {
    const totalTok = Object.values(groupedData).reduce((s, v) =>
      s + v.sonnet.in + v.sonnet.out + v.haiku.in + v.haiku.out + v.opus.in + v.opus.out + v.other.in + v.other.out, 0) || 1
    return Object.entries(groupedData).map(([id, v]) => {
      const total = v.sonnet.in + v.sonnet.out + v.haiku.in + v.haiku.out + v.opus.in + v.opus.out + v.other.in + v.other.out
      return {
        id, label: labelFor(id),
        requests: v.requests,
        sonnet: v.sonnet, haiku: v.haiku, opus: v.opus,
        total,
        pct: (total / totalTok * 100).toFixed(1),
      }
    }).sort((a, b) => b.total - a.total)
  }, [groupedData, accounts, terminals])

  const selectedItem = breakdownItems.find(i => i.id === selectedBreakdown)
  const isTokens = viewMode === 'tokens'

  return (
    <div className="main">
      <div className="usage-header">
        <div>
          <h1 className="usage-title">用量统计</h1>
          <p className="usage-subtitle">基于每次 API 响应中的 token 数据累计</p>
        </div>
        <button
          className="icon-btn"
          title="刷新用量数据"
          onClick={() => {
            setLoading(true)
            getUsage(range, group).then(data => {
              setRecords(data.records ?? [])
              setPrevRecords(data.prevRecords ?? [])
              setLoading(false)
            })
          }}
        >↻</button>
      </div>

      <div className="usage-controls">
        <div className="range-group">
          {[['today','今日'],['7d','近 7 天'],['30d','近 30 天']].map(([v, l]) => (
            <button key={v} className={`range-btn ${range === v ? 'active' : ''}`} onClick={() => setRange(v)}>{l}</button>
          ))}
        </div>
        <div className="view-group">
          <button className={`group-btn ${!isTokens ? 'active' : ''}`} onClick={() => setViewMode('usd')}>美金</button>
          <button className={`group-btn ${isTokens ? 'active' : ''}`} onClick={() => setViewMode('tokens')}>Token</button>
        </div>
        <div className="group-group">
          <button className={`group-btn ${group === 'account' ? 'active' : ''}`} onClick={() => setGroup('account')}>按账号</button>
          <button className={`group-btn ${group === 'terminal' ? 'active' : ''}`} onClick={() => setGroup('terminal')}>按终端</button>
        </div>
        {loading && <span style={{ fontSize: 12, color: '#a8a29e' }}><span className="spinner" />加载中…</span>}
      </div>

      {/* Stat Cards */}
      <div className="stat-cards">
        {isTokens ? (
          <>
            <div className="stat-card">
              <div className="stat-label">总 Token（{rangeLabel}）</div>
              <div className="stat-value">{fmtTok(totalTokens)}</div>
              <Trend value={trendTok} label={trendLabel} />
            </div>
            <div className="stat-card">
              <div className="stat-label">日均 Token</div>
              <div className="stat-value">{fmtTok(avgDailyTok)}</div>
            </div>
          </>
        ) : (
          <>
            <div className="stat-card">
              <div className="stat-label">总费用（{rangeLabel}）</div>
              <div className="stat-value">${fmtUsd(totalUsd)}</div>
              <Trend value={trendUsd} label={trendLabel} />
            </div>
            <div className="stat-card">
              <div className="stat-label">总 Token</div>
              <div className="stat-value">{fmtTok(totalTokens)}</div>
              <Trend value={trendTok} label={trendLabel} />
            </div>
          </>
        )}
        <div className="stat-card">
          <div className="stat-label">请求次数</div>
          <div className="stat-value">{totalReqs}</div>
          <Trend value={trendReqs} label={trendLabel} />
        </div>
        {isTokens ? (
          <div className="stat-card">
            <div className="stat-label">总费用</div>
            <div className="stat-value" style={{ fontSize: 22 }}>${fmtUsd(totalUsd)}</div>
            <Trend value={trendUsd} label={trendLabel} />
          </div>
        ) : (
          <div className="stat-card">
            <div className="stat-label">日均费用</div>
            <div className="stat-value">${fmtUsd(avgDailyUsd)}</div>
            {yesterdayUsd > 0 && <div className="stat-trend trend-neutral">昨日 ${fmtUsd(yesterdayUsd)}</div>}
          </div>
        )}
      </div>

      {/* Charts row */}
      <div className="charts-grid">
        {/* Daily bar chart */}
        <div className="chart-card">
          <div className="chart-title-row">
            <span className="chart-title">每日{isTokens ? ' Token' : '费用'}</span>
            <span className="chart-subtitle">近 {rangeLabel}</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dailyData.rows} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="day" tick={<DayTick />} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => axisFmt(v, isTokens)} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={56} domain={[0, (dailyData.maxTotal || 1) * 1.2]} />
              <Tooltip formatter={(v, name) => [fmtValue(v, viewMode), name]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {dailyData.keys.map((k, i) => (
                <Bar key={k} dataKey={k} name={labelFor(k)} stackId="a" fill={PALETTE[i % PALETTE.length]} radius={i === dailyData.keys.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} maxBarSize={52} />
              ))}
              <StackLabels rows={dailyData.rows} viewMode={viewMode} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Donut chart */}
        <div className="chart-card">
          <div className="chart-title">模型占比</div>
          <div className="donut-wrap">
            <PieChart width={200} height={200}>
              <Pie
                data={donutData}
                cx={100} cy={100}
                innerRadius={60} outerRadius={90}
                dataKey="value"
                startAngle={90} endAngle={-270}
                strokeWidth={0}
              >
                {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <DonutCenter cx={100} cy={100} total={donutTotal} label={rangeLabel} mode={viewMode} />
            </PieChart>
          </div>
          <div className="donut-legend">
            {donutData.map(d => (
              <div key={d.name} className="legend-row">
                <div className="legend-left">
                  <span className="legend-dot" style={{ background: d.color }} />
                  <span className="legend-name">{d.name}</span>
                </div>
                <span className="legend-pct">{(d.value / donutTotal * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div className="breakdown-card">
        <div className="breakdown-layout">
          <div className="breakdown-sidebar">
            <div className="breakdown-sidebar-label">{group === 'account' ? '选择账号' : '选择终端'}</div>
            <div className="breakdown-list">
              {breakdownItems.map(item => (
                <div
                  key={item.id}
                  className={`breakdown-item ${selectedBreakdown === item.id ? 'selected' : ''}`}
                  onClick={() => setSelectedBreakdown(item.id)}
                >
                  <div className="breakdown-item-row">
                    <span className="breakdown-dot" style={{ background: item.color }} />
                    <span className="breakdown-item-name">{item.label}</span>
                  </div>
                  {item.mode && <div className="breakdown-item-sub">{item.mode === 'auto' ? '自动' : '手动'}</div>}
                </div>
              ))}
            </div>
          </div>
          <div className="breakdown-main">
            <div className="breakdown-chart-title">
              {selectedItem ? `${selectedItem.label} — 模型${isTokens ? ' Token' : '费用'}分布（近 ${rangeLabel}）` : '—'}
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={breakdownChartData} margin={{ top: 24, right: 16, left: 8, bottom: 4 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#78716c' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => axisFmt(v, isTokens)} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
                <Tooltip formatter={v => fmtValue(v, viewMode)} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={80}>
                  {breakdownChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                  <LabelList
                    dataKey="value"
                    content={({ x, y, width, value }) => (
                      <text x={x + width / 2} y={y - 5} textAnchor="middle" fill="#78716c" fontSize={12} fontWeight={600}>
                        {fmtValue(value, viewMode)}
                      </text>
                    )}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detail Table */}
      <div className="detail-table">
        {isTokens ? (
          <table>
            <thead>
              <tr>
                <th>{group === 'account' ? '账号' : '终端'}</th>
                <th>请求数</th>
                <th>Sonnet</th>
                <th>Haiku</th>
                <th>Opus</th>
                <th>合计 Token</th>
                <th>占比</th>
              </tr>
            </thead>
            <tbody>
              {tokenDetailRows.map(row => (
                <tr key={row.id}>
                  <td>{row.label}</td>
                  <td>{row.requests}</td>
                  <TokenIOCell data={row.sonnet} />
                  <TokenIOCell data={row.haiku} />
                  <TokenIOCell data={row.opus} />
                  <td><strong>{fmtTokCell(row.total)}</strong></td>
                  <td>{row.pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{group === 'account' ? '账号' : '终端'}</th>
                <th>请求数</th>
                <th>Input Tokens</th>
                <th>Output Tokens</th>
                <th>费用</th>
                <th>占比</th>
              </tr>
            </thead>
            <tbody>
              {detailRows.map(row => (
                <tr key={row.id}>
                  <td>{row.label}</td>
                  <td>{row.requests}</td>
                  <td>{fmtTokCell(row.inTokens)}</td>
                  <td>{fmtTokCell(row.outTokens)}</td>
                  <td>${row.usd}</td>
                  <td>{row.pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
