import { useState, useEffect, useMemo } from 'react'
import { getUsage } from '../api.js'
import {
  tierProgress,
  needleAngle,
  tierFillColor,
  currentCycle,
  aggregateDailyByTerminal,
  cellBucket,
  CELL_COLORS,
  CYCLE_MS,
} from '../usage-intensity.js'

// Half-circle arc from (20, 110) to (200, 110) with radius 90.
// Arc length = π × 90 ≈ 282.74. strokeDasharray + dashoffset fills by ratio.
const ARC_RADIUS = 90
const ARC_LEN = Math.PI * ARC_RADIUS
const ARC_PATH = `M 20 110 A ${ARC_RADIUS} ${ARC_RADIUS} 0 0 1 200 110`

const TIERS = [
  { key: 'light',  label: '轻度' },
  { key: 'medium', label: '中度' },
  { key: 'heavy',  label: '重度' },
  { key: 'xheavy', label: '超重度' },
]

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const MONTH_DAY = ts => {
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）`
}
const SHORT = ts => {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function Gauge({ usd }) {
  const { tier, ratio } = tierProgress(usd)
  const fill = tierFillColor(tier)
  const fillOffset = ARC_LEN * (1 - ratio)
  const needleDeg = needleAngle(usd) - 90  // -90° = pointing left (arc start)

  return (
    <div className="intensity-gauge">
      <svg className="intensity-gauge-svg" viewBox="0 0 220 130" aria-label="使用强度仪表盘">
        {/* Track */}
        <path d={ARC_PATH} fill="none" stroke="#f0ede8" strokeWidth="18" strokeLinecap="round" />
        {/* Tier fill */}
        <path
          d={ARC_PATH}
          fill="none"
          stroke={fill}
          strokeWidth="18"
          strokeLinecap="round"
          strokeDasharray={ARC_LEN}
          strokeDashoffset={fillOffset}
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }}
        />
        {/* Needle */}
        <g transform={`rotate(${needleDeg} 110 110)`} style={{ transition: 'transform 0.6s ease' }}>
          <line x1="110" y1="110" x2="110" y2="34" stroke="#E87040" strokeWidth="3" strokeLinecap="round" />
          <circle cx="110" cy="34" r="4" fill="#E87040" />
        </g>
        {/* Pivot */}
        <circle cx="110" cy="110" r="8" fill="white" stroke="#E87040" strokeWidth="3" />
      </svg>
      <div className={`intensity-tier-chip tier-${tier}`}>{TIERS.find(t => t.key === tier)?.label}</div>
      <div className="intensity-tier-labels">
        {TIERS.map(t => (
          <span key={t.key} className={`intensity-tier-label ${t.key === tier ? 'active' : ''}`}>
            {t.label}
          </span>
        ))}
      </div>
    </div>
  )
}

const MONTHS_SHORT = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
const WEEKDAY_LABELS = ['', '周一', '', '周三', '', '周五', '']

function Heatmap({ dailyMap, nowMs }) {
  // GitHub-style: 52 columns (weeks) × 7 rows (Mon–Sun).
  // End at today, start 52 weeks back. Each column = one calendar week.
  const today = new Date(nowMs)
  today.setHours(0, 0, 0, 0)
  const todayDay = today.getDay() // 0=Sun
  // Align to the start of the current week (Monday).
  // If today is Sunday (0), go back 6 days; otherwise go back (day - 1) days.
  const endMonday = new Date(today)
  endMonday.setDate(today.getDate() - (todayDay === 0 ? 6 : todayDay - 1))
  // Go back 52 weeks from that Monday.
  const startMonday = new Date(endMonday)
  startMonday.setDate(endMonday.getDate() - 52 * 7)

  // Build 53 columns (week 0..52), each with 7 rows (Mon=0 .. Sun=6).
  const cols = []
  const monthLabels = [] // { colIdx, label }
  let lastMonth = -1

  for (let w = 0; w <= 52; w++) {
    const weekStart = new Date(startMonday)
    weekStart.setDate(startMonday.getDate() + w * 7)

    // Month label: show when the first day of this week is in a new month.
    const m = weekStart.getMonth()
    if (m !== lastMonth) {
      monthLabels.push({ col: w, label: MONTHS_SHORT[m] })
      lastMonth = m
    }

    const weekCells = []
    for (let d = 0; d < 7; d++) {
      const dayMs = weekStart.getTime() + d * 86400000
      const dt = new Date(dayMs)
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
      const inFuture = dayMs > nowMs
      const usd = dailyMap[key] ?? 0
      weekCells.push({
        key,
        ts: dayMs,
        bucket: inFuture ? 'future' : cellBucket(usd),
        future: inFuture,
      })
    }
    cols.push(weekCells)
  }

  return (
    <div className="intensity-heat-body">
      {/* Month labels */}
      <div className="intensity-heat-months">
        <div className="intensity-heat-weekday-spacer" />
        <div className="intensity-heat-months-track">
          {monthLabels.map((ml, i) => (
            <span
              key={i}
              className="intensity-heat-month"
              style={{ gridColumnStart: ml.col + 1 }}
            >
              {ml.label}
            </span>
          ))}
        </div>
      </div>
      <div className="intensity-heat-grid-wrap">
        {/* Weekday labels */}
        <div className="intensity-heat-weekdays">
          {WEEKDAY_LABELS.map((l, i) => (
            <span key={i} className="intensity-heat-weekday">{l}</span>
          ))}
        </div>
        {/* Grid */}
        <div className="intensity-heat-grid" role="grid">
          {cols.map((week, wi) => (
            <div key={wi} className="intensity-heat-col">
              {week.map(c => {
                const bg = c.future ? 'transparent' : (CELL_COLORS[c.bucket] ?? CELL_COLORS.empty)
                const border = c.future ? '1px dashed #e7e5e4' : 'none'
                return (
                  <div
                    key={c.key}
                    className={`intensity-heat-cell${c.future ? ' future' : ''}`}
                    style={{ background: bg, border }}
                    title={c.future ? '' : MONTH_DAY(c.ts)}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="intensity-heat-legend">
        <span className="intensity-heat-legend-label">少</span>
        <span className="intensity-heat-cell legend-cell" style={{ background: CELL_COLORS.empty }} />
        <span className="intensity-heat-cell legend-cell" style={{ background: CELL_COLORS.low }} />
        <span className="intensity-heat-cell legend-cell" style={{ background: CELL_COLORS.mid }} />
        <span className="intensity-heat-cell legend-cell" style={{ background: CELL_COLORS.high }} />
        <span className="intensity-heat-cell legend-cell" style={{ background: CELL_COLORS.xhigh }} />
        <span className="intensity-heat-legend-label">多</span>
      </div>
    </div>
  )
}

export default function UsageIntensityView({ terminals, session }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTerminal, setSelectedTerminal] = useState(null)
  // Snapshot "now" at mount — keeps cycle stable across re-renders and
  // satisfies React Compiler's purity rules (no Date.now() in render).
  const [nowMs] = useState(() => Date.now())

  // Anchor cycles on account registration date; gracefully fall back to a
  // rolling 30-day window if the session somehow lacks a created_at.
  const anchor = useMemo(() => {
    const createdAt = session?.user?.created_at
    if (createdAt) return new Date(createdAt).getTime()
    return nowMs - CYCLE_MS
  }, [session?.user?.created_at, nowMs])

  const cycle = useMemo(() => currentCycle(anchor, nowMs), [anchor, nowMs])

  useEffect(() => {
    setLoading(true)
    getUsage('365d', 'terminal')
      .then(data => {
        setRecords(data.records ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Cumulative USD for the current cycle across all the user's terminals.
  const cycleUsd = useMemo(() => {
    return records
      .filter(r => r.ts >= cycle.start && r.ts < cycle.end)
      .reduce((s, r) => s + (r.usd ?? 0), 0)
  }, [records, cycle.start, cycle.end])

  // Per-terminal per-day map for the heatmap.
  const dailyByTerminal = useMemo(
    () => aggregateDailyByTerminal(records, nowMs - 365 * 86400000),
    [records, nowMs]
  )

  // Terminal list: only show terminals that belong to this user (already
  // filtered server-side) and exist; sort by last-used desc so the most
  // active one sits on top.
  const visibleTerminals = useMemo(() => {
    return [...terminals].sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0))
  }, [terminals])

  useEffect(() => {
    if (!visibleTerminals.length) { setSelectedTerminal(null); return }
    setSelectedTerminal(prev =>
      prev && visibleTerminals.some(t => t.id === prev) ? prev : visibleTerminals[0].id
    )
  }, [visibleTerminals])

  const selectedDaily = selectedTerminal ? (dailyByTerminal[selectedTerminal] ?? {}) : {}
  const selectedName = visibleTerminals.find(t => t.id === selectedTerminal)?.name ?? '—'

  return (
    <div className="main">
      <div className="usage-header">
        <div>
          <h1 className="usage-title">使用强度</h1>
          <p className="usage-subtitle">本周期的累计使用量 · 每 30 天一个周期</p>
        </div>
        {loading && <span style={{ fontSize: 12, color: '#a8a29e' }}><span className="spinner" />加载中…</span>}
      </div>

      {/* Gauge card */}
      <div className="intensity-card">
        <div className="intensity-card-header">
          <span className="intensity-card-title">本周期使用强度</span>
          <span className="intensity-cycle-badge">
            {SHORT(cycle.start)} – {SHORT(cycle.end - 86400000)}
          </span>
        </div>
        <Gauge usd={cycleUsd} />
      </div>

      {/* Heatmap card */}
      <div className="intensity-card">
        <div className="intensity-card-header">
          <span className="intensity-card-title">终端使用强度</span>
        </div>
        {visibleTerminals.length === 0 ? (
          <div className="intensity-empty">暂无终端 — 请先在"终端"标签页创建一个</div>
        ) : (
          <div className="intensity-heat-layout">
            <div className="intensity-heat-sidebar">
              <div className="intensity-heat-sidebar-label">选择终端</div>
              <div className="intensity-heat-sidebar-list">
                {visibleTerminals.map(t => (
                  <div
                    key={t.id}
                    className={`intensity-heat-item ${selectedTerminal === t.id ? 'selected' : ''}`}
                    onClick={() => setSelectedTerminal(t.id)}
                  >
                    <div className="intensity-heat-item-row">
                      <span className={`intensity-heat-dot ${t.mode === 'auto' ? 'auto' : 'manual'}`} />
                      <span className="intensity-heat-item-name">{t.name}</span>
                    </div>
                    <div className="intensity-heat-item-sub">
                      {t.mode === 'auto' ? '自动' : '手动'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="intensity-heat-main">
              <div className="intensity-heat-main-title">{selectedName} — 近 30 天</div>
              <Heatmap dailyMap={selectedDaily} nowMs={nowMs} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
