import { useState } from 'react'
import { createTerminal } from '../api.js'

const ADJS = ['brave','fuzzy','lazy','swift','quiet','happy','bold','calm','dark','eager']
const ANIMALS = ['koala','penguin','otter','falcon','panda','lemur','gecko','bison','crane','dingo']

function rollName(existing = []) {
  let name
  let tries = 0
  do {
    name = ADJS[Math.floor(Math.random() * ADJS.length)] + '-' + ANIMALS[Math.floor(Math.random() * ANIMALS.length)]
    tries++
  } while (existing.includes(name) && tries < 100)
  return name
}

export default function TerminalModal({ terminals, onClose, onSuccess }) {
  const [name, setName] = useState(() => rollName(terminals.map(t => t.name)))
  const [loading, setLoading] = useState(false)

  async function create() {
    setLoading(true)
    try {
      const t = await createTerminal({ name: name.trim() || undefined })
      onSuccess(t)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">新建终端</div>
        <div className="form-row">
          <label className="form-label">终端名称</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="form-input"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && create()}
              placeholder="brave-koala"
            />
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setName(rollName(terminals.map(t => t.name)))}
              title="随机生成"
              style={{ flexShrink: 0 }}
            >
              🎲
            </button>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          <button className="btn btn-primary" disabled={loading} onClick={create}>
            {loading ? '创建中…' : '创建'}
          </button>
        </div>
      </div>
    </div>
  )
}
