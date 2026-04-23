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

function Heatmap({ dailyMap, cycleStart, cycleEnd, nowMs }) {
  // Build the 30-day grid: column = week (0-4), row = weekday offset within week.
  // Day index = col * 7 + row, capped at 30. The remaining 5 cells (index 30-34)
  // are rendered as neutral "out-of-cycle" placeholders.
  const startDay = new Date(cycleStart); startDay.setHours(0, 0, 0, 0)

  const cells = []
  for (let col = 0; col < 5; col++) {
    const colCells = []
    for (let row = 0; row < 7; row++) {
      const dayIdx = col * 7 + row
      if (dayIdx >= 30) {
        colCells.push({ placeholder: true, key: `ph-${col}-${row}` })
        continue
      }
      const dayMs = startDay.getTime() + dayIdx * 86400000
      const d = new Date(dayMs)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const usd = dailyMap[key] ?? 0
      const inFuture = dayMs > nowMs
      colCells.push({
        key,
        ts: dayMs,
        usd,
        bucket: inFuture ? 'future' : cellBucket(usd),
        future: inFuture,
      })
    }
    cells.push(colCells)
  }

  return (
    <div className="intensity-heat-body">
      <div className="intensity-heat-grid" role="grid">
        {cells.map((col, ci) => (
          <div key={ci} className="intensity-heat-col">
            {col.map(c => {
              if (c.placeholder) {
                return <div key={c.key} className="intensity-heat-cell placeholder" aria-hidden="true" />
              }
              const bg = c.future ? 'transparent' : (CELL_COLORS[c.bucket] ?? CELL_COLORS.empty)
              const border = c.future ? '1px dashed #e7e5e4' : '1px solid rgba(0,0,0,0.02)'
              return (
                <div
                  key={c.key}
                  className="intensity-heat-cell"
                  style={{ background: bg, border }}
                  title={MONTH_DAY(c.ts)}
                />
              )
            })}
          </div>
        ))}
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
      <div className="intensity-heat-range">
        周期：{SHORT(cycleStart)} – {SHORT(cycleEnd - 86400000)}
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
    getUsage('30d', 'terminal')
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
    () => aggregateDailyByTerminal(records, cycle.start),
    [records, cycle.start]
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
              <Heatmap dailyMap={selectedDaily} cycleStart={cycle.start} cycleEnd={cycle.end} nowMs={nowMs} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
