import { useState, useEffect, useRef } from 'react'
import './App.css'
import Nav from './components/Nav.jsx'
import AccountsTab from './components/AccountsTab.jsx'
import TerminalsTab from './components/TerminalsTab.jsx'
import UsageTab from './components/UsageTab.jsx'
import OAuthModal from './components/OAuthModal.jsx'
import TerminalModal from './components/TerminalModal.jsx'
import { getAccounts, getTerminals, getUsage, syncAllUsage } from './api.js'

// Snapshot of rate-limit state for change detection
function rateLimitSnapshot(accs) {
  return accs.map(a => `${a.id}:${a.rateLimit?.window5h?.utilization ?? ''}:${a.rateLimit?.weekly?.utilization ?? ''}`).join('|')
}

export default function App() {
  const [tab, setTab] = useState('accounts')
  const [accounts, setAccounts] = useState([])
  const [terminals, setTerminals] = useState([])
  const [usageRecords, setUsageRecords] = useState([])
  const [showOAuth, setShowOAuth] = useState(false)
  const [showTerminalModal, setShowTerminalModal] = useState(false)

  // Adaptive polling state
  const staleRoundsRef = useRef(0)
  const lastSnapshotRef = useRef('')

  async function refresh() {
    const [accs, terms] = await Promise.all([getAccounts(), getTerminals()])
    setAccounts(accs)
    setTerminals(terms)

    // Adaptive polling: track consecutive stale rounds
    const snapshot = rateLimitSnapshot(accs)
    if (snapshot === lastSnapshotRef.current) {
      staleRoundsRef.current += 1
    } else {
      staleRoundsRef.current = 0
      lastSnapshotRef.current = snapshot
    }

    // After 4 stale rounds (~60s), trigger an active probe
    if (staleRoundsRef.current >= 4) {
      staleRoundsRef.current = 0
      try {
        const probed = await syncAllUsage()
        if (Array.isArray(probed)) {
          setAccounts(probed)
          lastSnapshotRef.current = rateLimitSnapshot(probed)
        }
      } catch { /* non-fatal */ }
    }
  }

  useEffect(() => {
    refresh()
    // Load usage records for terminal tab usage display
    getUsage('7d', 'account').then(d => setUsageRecords(d.records ?? []))

    const timer = setInterval(refresh, 15000)
    return () => clearInterval(timer)
  }, [])

  function handleOAuthSuccess(account) {
    setShowOAuth(false)
    refresh()
  }

  function handleTerminalSuccess(terminal) {
    setShowTerminalModal(false)
    refresh()
  }

  return (
    <>
      <Nav
        tab={tab}
        setTab={setTab}
        onAddAccount={() => setShowOAuth(true)}
        onNewTerminal={() => setShowTerminalModal(true)}
      />

      {tab === 'accounts' && (
        <AccountsTab
          accounts={accounts}
          terminals={terminals}
          onRefresh={refresh}
          onNewTerminal={() => setShowTerminalModal(true)}
        />
      )}

      {tab === 'terminals' && (
        <TerminalsTab
          terminals={terminals}
          accounts={accounts}
          usageRecords={usageRecords}
          onRefresh={refresh}
        />
      )}

      {tab === 'usage' && (
        <UsageTab accounts={accounts} terminals={terminals} />
      )}

      {showOAuth && (
        <OAuthModal onClose={() => setShowOAuth(false)} onSuccess={handleOAuthSuccess} />
      )}

      {showTerminalModal && (
        <TerminalModal
          terminals={terminals}
          onClose={() => setShowTerminalModal(false)}
          onSuccess={handleTerminalSuccess}
        />
      )}
    </>
  )
}
