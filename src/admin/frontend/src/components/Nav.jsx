export default function Nav({ tab, setTab, onAddAccount, onNewTerminal }) {
  return (
    <nav className="nav">
      <div className="nav-logo">✳ claudecode-hub</div>
      <div className={`nav-tab ${tab === 'accounts' ? 'active' : ''}`} onClick={() => setTab('accounts')}>账号</div>
      <div className={`nav-tab ${tab === 'terminals' ? 'active' : ''}`} onClick={() => setTab('terminals')}>终端</div>
      <div className={`nav-tab ${tab === 'usage' ? 'active' : ''}`} onClick={() => setTab('usage')}>用量</div>
      {tab !== 'usage' && (
        <div className="nav-right">
          <button className="btn btn-primary" onClick={tab === 'terminals' ? onNewTerminal : onAddAccount}>
            {tab === 'terminals' ? '+ 新建终端' : '+ 添加账号'}
          </button>
        </div>
      )}
    </nav>
  )
}
