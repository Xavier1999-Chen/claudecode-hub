import LogoMark from './LogoMark.jsx'

export default function Nav({ tab, setTab, onAddAccount, onAddRelay, onAddAggregated, onNewTerminal, session, isAdmin, onSignOut }) {
  return (
    <nav className="nav">
      <div className="nav-logo"><LogoMark size={20} />claudecode-hub</div>
      <div className={`nav-tab ${tab === 'accounts' ? 'active' : ''}`} onClick={() => setTab('accounts')}>账号</div>
      <div className={`nav-tab ${tab === 'terminals' ? 'active' : ''}`} onClick={() => setTab('terminals')}>终端</div>
      <div className={`nav-tab ${tab === 'usage' ? 'active' : ''}`} onClick={() => setTab('usage')}>用量</div>
      <div className={`nav-tab ${tab === 'guide' ? 'active' : ''}`} onClick={() => setTab('guide')}>指南</div>
      <div className="nav-right" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {tab === 'terminals' && (
          <button className="btn btn-primary" onClick={onNewTerminal}>+ 新建终端</button>
        )}
        {tab === 'accounts' && isAdmin && (
          <>
            <button className="btn btn-ghost" onClick={onAddRelay}>+ 添加中转</button>
            <button className="btn btn-ghost" onClick={onAddAggregated}>+ 添加聚合</button>
            <button className="btn btn-primary" onClick={onAddAccount}>+ 添加账号</button>
          </>
        )}
        <div className="nav-user">
          <span className="nav-user-email">{session?.user?.email}</span>
          {isAdmin && <span className="nav-user-badge">管理员</span>}
          <button className="nav-signout-btn" onClick={onSignOut} title="退出登录">⏻</button>
        </div>
      </div>
    </nav>
  )
}
