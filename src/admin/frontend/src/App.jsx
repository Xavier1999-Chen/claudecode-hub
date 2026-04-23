import { useState, useEffect, useRef } from 'react'
import './App.css'
import Nav from './components/Nav.jsx'
import AccountsTab from './components/AccountsTab.jsx'
import TerminalsTab from './components/TerminalsTab.jsx'
import UsageTab from './components/UsageTab.jsx'
import UsageIntensityView from './components/UsageIntensityView.jsx'
import GuideTab from './components/GuideTab.jsx'
import OAuthModal from './components/OAuthModal.jsx'
import RelayModal from './components/RelayModal.jsx'
import TerminalModal from './components/TerminalModal.jsx'
import LoginPage from './components/LoginPage.jsx'
import ConfirmEmailPage from './components/ConfirmEmailPage.jsx'
import VerifyErrorPage from './components/VerifyErrorPage.jsx'
import { getAccounts, getTerminals, getUsage, syncAllUsage, signOut, resendVerification } from './api.js'
import { supabase, getRole, getStatus, isApproved } from './supabase.js'
import { classifyAuthRedirect } from './auth-redirect.js'

function rateLimitSnapshot(accs) {
  return accs.map(a => `${a.id}:${a.rateLimit?.window5h?.utilization ?? ''}:${a.rateLimit?.weekly?.utilization ?? ''}`).join('|')
}

export default function App() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [tab, setTab] = useState('accounts')
  const [accounts, setAccounts] = useState([])
  const [terminals, setTerminals] = useState([])
  const [usageRecords, setUsageRecords] = useState([])
  const [showOAuth, setShowOAuth] = useState(false)
  const [showRelay, setShowRelay] = useState(false)
  const [showTerminalModal, setShowTerminalModal] = useState(false)

  const staleRoundsRef = useRef(0)
  const lastSnapshotRef = useRef('')

  // ── Auth state subscription ─────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setAuthLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function refresh() {
    try {
      const [accs, terms] = await Promise.all([getAccounts(), getTerminals()])
      if (!Array.isArray(accs) || !Array.isArray(terms)) return
      setAccounts(accs)
      setTerminals(terms)

      const snapshot = rateLimitSnapshot(accs)
      if (snapshot === lastSnapshotRef.current) {
        staleRoundsRef.current += 1
      } else {
        staleRoundsRef.current = 0
        lastSnapshotRef.current = snapshot
      }

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
    } catch { /* non-fatal */ }
  }

  useEffect(() => {
    if (!session || !isApproved(session.user)) return
    refresh()
    getUsage('7d', 'account').then(d => setUsageRecords(d.records ?? [])).catch(() => {})
    const timer = setInterval(refresh, 15000)
    return () => clearInterval(timer)
  }, [session?.access_token])

  function handleOAuthSuccess() { setShowOAuth(false); refresh() }
  function handleRelaySuccess() { setShowRelay(false); refresh() }
  function handleTerminalSuccess() { setShowTerminalModal(false); refresh() }

  async function handleSignOut() {
    await signOut()
    setSession(null)
  }

  // ── Email-verification redirect (GitHub #6) ─────────────────────────────────
  // Run BEFORE the session-based auth gates: a cross-device email click
  // (e.g. signed up on PC, opened email on phone) has no session yet, but
  // the URL still carries the token_hash that needs to drive verifyOtp.
  const redirect = classifyAuthRedirect(new URLSearchParams(window.location.search))
  if (redirect.mode === 'confirm-email') {
    return <ConfirmEmailPage tokenHash={redirect.tokenHash} type={redirect.type} />
  }
  if (redirect.mode === 'verify-error') {
    return <VerifyErrorPage />
  }

  // ── Auth gates ──────────────────────────────────────────────────────────────
  if (authLoading) return null  // brief flash avoidance

  if (!session) {
    return <LoginPage />
  }

  const user = session.user
  const emailConfirmed = !!user.email_confirmed_at || !!user.confirmed_at

  if (!emailConfirmed) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-state-icon">✉️</div>
          <div className="auth-state-title">请验证邮箱</div>
          <div className="auth-state-desc">验证邮件已发送至 <strong>{user.email}</strong>，请点击邮件中的链接完成验证后刷新此页面。</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={handleSignOut}>退出</button>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={async () => {
                try { await resendVerification(user.email); alert('验证邮件已重新发送') }
                catch (e) { alert(e.message) }
              }}
            >
              重发邮件
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!isApproved(user)) {
    const status = getStatus(user)
    const isRejected = status === 'rejected'
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-state-icon">{isRejected ? '⛔' : '⏳'}</div>
          <div className="auth-state-title">
            {isRejected ? '申请已被拒绝' : '等待管理员审批'}
          </div>
          <div className="auth-state-desc">
            {isRejected
              ? <>账号 <strong>{user.email}</strong> 的访问申请已被管理员拒绝。如有疑问请联系管理员。</>
              : <>账号 <strong>{user.email}</strong> 已注册成功，请等待管理员审批后即可使用。</>}
          </div>
          <button className="btn btn-ghost" style={{ width: '100%', marginTop: 16 }} onClick={handleSignOut}>退出登录</button>
        </div>
      </div>
    )
  }

  const isAdmin = getRole(user) === 'admin'

  return (
    <>
      <Nav
        tab={tab}
        setTab={setTab}
        onAddAccount={() => setShowOAuth(true)}
        onAddRelay={() => setShowRelay(true)}
        onNewTerminal={() => setShowTerminalModal(true)}
        session={session}
        isAdmin={isAdmin}
        onSignOut={handleSignOut}
      />

      {tab === 'accounts' && (
        <AccountsTab
          accounts={accounts}
          terminals={terminals}
          onRefresh={refresh}
          onNewTerminal={() => setShowTerminalModal(true)}
          isAdmin={isAdmin}
        />
      )}

      {tab === 'terminals' && (
        <TerminalsTab
          terminals={terminals}
          accounts={accounts}
          usageRecords={usageRecords}
          onRefresh={refresh}
          isAdmin={isAdmin}
        />
      )}

      {tab === 'usage' && (isAdmin
        ? <UsageTab accounts={accounts} terminals={terminals} />
        : <UsageIntensityView terminals={terminals} session={session} />
      )}

      {tab === 'guide' && <GuideTab />}

      {showOAuth && (
        <OAuthModal onClose={() => setShowOAuth(false)} onSuccess={handleOAuthSuccess} />
      )}

      {showRelay && (
        <RelayModal onClose={() => setShowRelay(false)} onSuccess={handleRelaySuccess} />
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
