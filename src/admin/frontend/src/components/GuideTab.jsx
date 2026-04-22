import { useState } from 'react'

function CodeBlock({ code }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="guide-code-wrap">
      <button className="guide-copy-btn" onClick={copy}>{copied ? '✓ 已复制' : '复制'}</button>
      <pre className="guide-code"><code>{code}</code></pre>
    </div>
  )
}

function Step({ n, title, children }) {
  return (
    <div className="guide-step">
      <div className="guide-step-header">
        <span className="guide-step-num">{n}</span>
        <span className="guide-step-title">{title}</span>
      </div>
      <div className="guide-step-body">{children}</div>
    </div>
  )
}

function Note({ children }) {
  return <div className="guide-note">{children}</div>
}

function EnvVarsBlock({ token = 'sk-hub-xxx', shell }) {
  if (shell === 'powershell') {
    return (
      <CodeBlock code={`[System.Environment]::SetEnvironmentVariable("ANTHROPIC_BASE_URL", "https://api.hub.tertax.cn", "User")
[System.Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", "${token}", "User")
[System.Environment]::SetEnvironmentVariable("CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", "1", "User")`} />
    )
  }
  const rc = shell === 'zsh' ? '~/.zshrc' : shell === 'bash_profile' ? '~/.bash_profile' : '~/.bashrc'
  return (
    <CodeBlock code={`echo 'export ANTHROPIC_BASE_URL="https://api.hub.tertax.cn"' >> ${rc}
echo 'export ANTHROPIC_API_KEY="${token}"' >> ${rc}
echo 'export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1' >> ${rc}
source ${rc}`} />
  )
}

function WindowsGuide() {
  return (
    <div className="guide-content">
      <p className="guide-desc">本指南适用于 Windows 10 / 11。</p>

      <Step n={1} title="安装 Node.js">
        <p>Claude Code 需要 Node.js 18 或更高版本。</p>
        <p className="guide-method-label">方法一：官网下载（推荐）</p>
        <ol className="guide-list">
          <li>访问 <a href="https://nodejs.org/" target="_blank" rel="noreferrer">https://nodejs.org/</a>，下载 <strong>LTS</strong> 版本</li>
          <li>双击 <code>.msi</code> 文件，按向导完成安装</li>
        </ol>
        <p className="guide-method-label">方法二：包管理器</p>
        <div className="guide-tab-group">
          <TabCodeBlock tabs={[
            { label: 'Chocolatey', code: 'choco install nodejs' },
            { label: 'Scoop', code: 'scoop install nodejs' },
          ]} />
        </div>
        <p className="guide-verify-label">验证安装：</p>
        <CodeBlock code={`node --version\nnpm --version`} />
      </Step>

      <Step n={2} title="安装 Claude Code">
        <p>以<strong>管理员身份</strong>打开 PowerShell，运行：</p>
        <CodeBlock code="npm install -g @anthropic-ai/claude-code" />
        <p className="guide-verify-label">验证：</p>
        <CodeBlock code="claude --version" />
        <Note>遇到权限错误？确认以管理员身份运行 PowerShell。执行策略错误时运行：<br /><code>Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser</code></Note>
      </Step>

      <Step n={3} title="配置环境变量">
        <p>将 <code>sk-hub-xxx</code> 替换为你的 Terminal Token，在 PowerShell 中运行：</p>
        <EnvVarsBlock shell="powershell" />
        <p className="guide-verify-label">验证：</p>
        <CodeBlock code={`[System.Environment]::GetEnvironmentVariable("ANTHROPIC_BASE_URL", "User")
[System.Environment]::GetEnvironmentVariable("ANTHROPIC_API_KEY", "User")`} />
        <div className="guide-env-desc">
          <div className="guide-env-row"><code>ANTHROPIC_BASE_URL</code><span>Hub 代理地址，所有请求通过此地址转发</span></div>
          <div className="guide-env-row"><code>ANTHROPIC_API_KEY</code><span>你的 Terminal Token，用于身份验证</span></div>
          <div className="guide-env-row"><code>CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC</code><span>禁用遥测数据上报，避免连接超时</span></div>
        </div>
      </Step>

      <Step n={4} title="验证和使用">
        <Note>必须<strong>重启 PowerShell</strong>（以普通用户身份）才能使环境变量生效。</Note>
        <CodeBlock code={`claude --version\nclaude`} />
        <p>在项目目录中使用：</p>
        <CodeBlock code={`cd C:\\path\\to\\your\\project\nclaude`} />
      </Step>

      <div className="guide-faq">
        <h3 className="guide-faq-title">常见问题</h3>
        <div className="guide-faq-item">
          <div className="guide-faq-q">{"SyntaxError: Unexpected token '{'"}</div>
          <div className="guide-faq-a">Node.js 版本低于 18。从 <a href="https://nodejs.org/" target="_blank" rel="noreferrer">nodejs.org</a> 下载最新 LTS 版本，重新运行 <code>npm install -g @anthropic-ai/claude-code</code>。</div>
        </div>
        <div className="guide-faq-item">
          <div className="guide-faq-q">安装提示 "permission denied"</div>
          <div className="guide-faq-a">以管理员身份重新打开 PowerShell 并重试。</div>
        </div>
        <div className="guide-faq-item">
          <div className="guide-faq-q">环境变量设置后不生效</div>
          <div className="guide-faq-a">关闭当前 PowerShell 窗口，重新打开一个新的 PowerShell（非管理员）后再试。</div>
        </div>
      </div>
    </div>
  )
}

function MacosGuide() {
  const [shell, setShell] = useState('zsh')
  return (
    <div className="guide-content">
      <p className="guide-desc">本指南适用于 macOS 12 及以上版本，支持 Intel 和 Apple Silicon。</p>

      <Step n={1} title="安装 Node.js">
        <p>Claude Code 需要 Node.js 18 或更高版本。</p>
        <p className="guide-method-label">方法一：Homebrew（推荐）</p>
        <CodeBlock code={`brew update\nbrew install node`} />
        <p className="guide-method-label">方法二：官网下载</p>
        <p>访问 <a href="https://nodejs.org/" target="_blank" rel="noreferrer">https://nodejs.org/</a>，下载 macOS LTS 版本 <code>.pkg</code> 文件运行安装。</p>
        <p className="guide-verify-label">验证安装：</p>
        <CodeBlock code={`node --version\nnpm --version`} />
      </Step>

      <Step n={2} title="安装 Claude Code">
        <CodeBlock code="npm install -g @anthropic-ai/claude-code" />
        <p className="guide-verify-label">验证：</p>
        <CodeBlock code="claude --version" />
        <Note>遇到权限错误？使用 <code>sudo npm install -g @anthropic-ai/claude-code</code></Note>
      </Step>

      <Step n={3} title="配置环境变量">
        <p>不确定用的是哪种 Shell？运行 <code>echo $SHELL</code> 查看。</p>
        <div className="guide-shell-switch">
          <button className={`guide-platform-btn ${shell === 'zsh' ? 'active' : ''}`} onClick={() => setShell('zsh')}>zsh（默认）</button>
          <button className={`guide-platform-btn ${shell === 'bash_profile' ? 'active' : ''}`} onClick={() => setShell('bash_profile')}>bash</button>
        </div>
        <p>将 <code>sk-hub-xxx</code> 替换为你的 Terminal Token：</p>
        <EnvVarsBlock shell={shell} />
        <p className="guide-verify-label">验证：</p>
        <CodeBlock code={`echo $ANTHROPIC_BASE_URL\necho $ANTHROPIC_API_KEY`} />
        <div className="guide-env-desc">
          <div className="guide-env-row"><code>ANTHROPIC_BASE_URL</code><span>Hub 代理地址，所有请求通过此地址转发</span></div>
          <div className="guide-env-row"><code>ANTHROPIC_API_KEY</code><span>你的 Terminal Token，用于身份验证</span></div>
          <div className="guide-env-row"><code>CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC</code><span>禁用遥测数据上报，避免连接超时</span></div>
        </div>
      </Step>

      <Step n={4} title="验证和使用">
        <Note>必须<strong>重新打开 Terminal</strong> 才能使环境变量生效。</Note>
        <CodeBlock code={`claude --version\nclaude`} />
        <p>在项目目录中使用：</p>
        <CodeBlock code={`cd /path/to/your/project\nclaude`} />
      </Step>

      <div className="guide-faq">
        <h3 className="guide-faq-title">常见问题</h3>
        <div className="guide-faq-item">
          <div className="guide-faq-q">权限错误（permission denied）</div>
          <div className="guide-faq-a">使用 sudo 安装：<code>sudo npm install -g @anthropic-ai/claude-code</code></div>
        </div>
        <div className="guide-faq-item">
          <div className="guide-faq-q">macOS 安全设置阻止运行</div>
          <div className="guide-faq-a">前往<strong>系统设置 → 隐私与安全性</strong>，在底部找到被阻止的程序，点击"仍要打开"。</div>
        </div>
        <div className="guide-faq-item">
          <div className="guide-faq-q">环境变量设置后不生效</div>
          <div className="guide-faq-a">确认修改了正确的配置文件，完全退出 Terminal 并重新打开。</div>
        </div>
      </div>
    </div>
  )
}

function LinuxGuide() {
  const [shell, setShell] = useState('bash')
  return (
    <div className="guide-content">
      <p className="guide-desc">本指南适用于 Ubuntu、Debian、CentOS 等主流 Linux 发行版，以及 Windows WSL2 环境。</p>

      <Step n={1} title="安装 Node.js">
        <p>Claude Code 需要 Node.js 18 或更高版本。</p>
        <p className="guide-method-label">方法一：NodeSource 官方仓库（推荐）</p>
        <div className="guide-tab-group">
          <TabCodeBlock tabs={[
            { label: 'Ubuntu / Debian / WSL2', code: `curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -\nsudo apt-get install -y nodejs` },
            { label: 'CentOS / RHEL / Fedora', code: `curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -\nsudo dnf install -y nodejs` },
          ]} />
        </div>
        <p className="guide-method-label">方法二：系统包管理器</p>
        <div className="guide-tab-group">
          <TabCodeBlock tabs={[
            { label: 'Ubuntu / Debian', code: `sudo apt update\nsudo apt install -y nodejs npm` },
            { label: 'CentOS / RHEL', code: `sudo dnf install -y nodejs npm` },
          ]} />
        </div>
        <p className="guide-verify-label">验证安装：</p>
        <CodeBlock code={`node --version\nnpm --version`} />
      </Step>

      <Step n={2} title="安装 Claude Code">
        <CodeBlock code="npm install -g @anthropic-ai/claude-code" />
        <p className="guide-verify-label">验证：</p>
        <CodeBlock code="claude --version" />
        <Note>遇到权限错误？使用 <code>sudo npm install -g @anthropic-ai/claude-code</code></Note>
      </Step>

      <Step n={3} title="配置环境变量">
        <p>不确定用的是哪种 Shell？运行 <code>echo $SHELL</code> 查看。</p>
        <div className="guide-shell-switch">
          <button className={`guide-platform-btn ${shell === 'bash' ? 'active' : ''}`} onClick={() => setShell('bash')}>bash</button>
          <button className={`guide-platform-btn ${shell === 'zsh' ? 'active' : ''}`} onClick={() => setShell('zsh')}>zsh</button>
        </div>
        <p>将 <code>sk-hub-xxx</code> 替换为你的 Terminal Token：</p>
        <EnvVarsBlock shell={shell} />
        <p className="guide-verify-label">验证：</p>
        <CodeBlock code={`echo $ANTHROPIC_BASE_URL\necho $ANTHROPIC_API_KEY`} />
        <div className="guide-env-desc">
          <div className="guide-env-row"><code>ANTHROPIC_BASE_URL</code><span>Hub 代理地址，所有请求通过此地址转发</span></div>
          <div className="guide-env-row"><code>ANTHROPIC_API_KEY</code><span>你的 Terminal Token，用于身份验证</span></div>
          <div className="guide-env-row"><code>CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC</code><span>禁用遥测数据上报，避免连接超时</span></div>
        </div>
      </Step>

      <Step n={4} title="验证和使用">
        <Note>必须<strong>重新打开终端</strong>（或运行 <code>source ~/.bashrc</code>）才能使环境变量生效。</Note>
        <CodeBlock code={`claude --version\nclaude`} />
        <p>在项目目录中使用：</p>
        <CodeBlock code={`cd /path/to/your/project\nclaude`} />
      </Step>

      <div className="guide-faq">
        <h3 className="guide-faq-title">常见问题</h3>
        <div className="guide-faq-item">
          <div className="guide-faq-q">权限错误（permission denied）</div>
          <div className="guide-faq-a">使用 sudo 安装：<code>sudo npm install -g @anthropic-ai/claude-code</code></div>
        </div>
        <div className="guide-faq-item">
          <div className="guide-faq-q">环境变量设置后不生效</div>
          <div className="guide-faq-a">确认修改了正确的配置文件（<code>~/.bashrc</code> 或 <code>~/.zshrc</code>），运行 <code>source ~/.bashrc</code> 重新加载。</div>
        </div>
        <div className="guide-faq-item">
          <div className="guide-faq-q">WSL2：无法连接到 Hub</div>
          <div className="guide-faq-a">确认 Windows 防火墙没有阻止 WSL2 出站连接。测试网络：<code>curl -I https://api.hub.tertax.cn</code></div>
        </div>
      </div>
    </div>
  )
}

function TabCodeBlock({ tabs }) {
  const [active, setActive] = useState(0)
  return (
    <div className="guide-tab-code">
      <div className="guide-tab-code-bar">
        {tabs.map((t, i) => (
          <button key={i} className={`guide-tab-code-btn ${active === i ? 'active' : ''}`} onClick={() => setActive(i)}>{t.label}</button>
        ))}
      </div>
      <CodeBlock code={tabs[active].code} />
    </div>
  )
}

const PLATFORMS = [
  { id: 'windows', title: 'Windows', desc: '支持 Windows 10 / 11，提供完整的 PowerShell 配置命令。' },
  { id: 'macos', title: 'macOS', desc: '支持 Intel 和 Apple Silicon，兼容 zsh 和 bash。' },
  { id: 'linux', title: 'Linux / WSL2', desc: '支持 Ubuntu、Debian、CentOS 等主流发行版，以及 Windows WSL2。' },
]

export default function GuideTab() {
  const [platform, setPlatform] = useState('windows')
  const selectLabel = PLATFORMS.find(p => p.id === platform)?.title ?? ''

  return (
    <div className="guide-tab">
      <div className="guide-hero">
        <h1 className="guide-hero-title">
          <span className="guide-hero-title-accent">claudecode-hub</span>
          <br />接入指南
        </h1>
        <p className="guide-hero-desc">将 Claude Code 安装到你的设备，并连接到 Hub，开始使用共享的 Claude 资源。</p>
      </div>

      <div className="guide-platform-grid">
        {PLATFORMS.map(p => (
          <div
            key={p.id}
            className={`guide-platform-card ${platform === p.id ? 'active' : ''}`}
            onClick={() => setPlatform(p.id)}
            role="button"
            tabIndex={0}
          >
            <div className="guide-platform-card-title">{p.title}</div>
            <div className="guide-platform-card-desc">{p.desc}</div>
            <div className="guide-platform-card-action">查看 {p.title} 指南 →</div>
          </div>
        ))}
      </div>

      <div className="guide-platform-content">
        <div className="guide-platform-content-label">{selectLabel} 安装步骤</div>
        {platform === 'windows' && <WindowsGuide />}
        {platform === 'macos' && <MacosGuide />}
        {platform === 'linux' && <LinuxGuide />}
      </div>
    </div>
  )
}
