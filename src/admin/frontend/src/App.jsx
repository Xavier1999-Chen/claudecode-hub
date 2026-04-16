import { useState, useEffect } from 'react'
import './App.css'
import Nav from './components/Nav.jsx'
import AccountsTab from './components/AccountsTab.jsx'
import TerminalsTab from './components/TerminalsTab.jsx'
import UsageTab from './components/UsageTab.jsx'
import OAuthModal from './components/OAuthModal.jsx'
import TerminalModal from './components/TerminalModal.jsx'
import { getAccounts, getTerminals, getUsage } from './api.js'

export default function App() {
  const [tab, setTab] = useState('accounts')
  const [accounts, setAccounts] = useState([])
  const [terminals, setTerminals] = useState([])
  const [usageRecords, setUsageRecords] = useState([])
  const [showOAuth, setShowOAuth] = useState(false)
  const [showTerminalModal, setShowTerminalModal] = useState(false)

  async function refresh() {
    const [accs, terms] = await Promise.all([getAccounts(), getTerminals()])
    setAccounts(accs)
    setTerminals(terms)
  }

  useEffect(() => {
    refresh()
    // Load usage records for terminal tab usage display
    getUsage('7d', 'account').then(d => setUsageRecords(d.records ?? []))

    // Auto-refresh accounts & terminals every 30s
    const timer = setInterval(refresh, 60000)
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
