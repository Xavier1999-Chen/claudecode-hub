# Windows 安装指南

本指南适用于 **Windows 10 / 11**。

---

## 准备工作

在开始前，请确认你已从管理员处获取：
- **Terminal Token**：格式为 `sk-hub-xxx`
- **Hub API 地址**：`https://api.hub.tertax.cn`

---

## 步骤一：安装 Node.js

Claude Code 需要 Node.js 18 或更高版本。

### 方法一：官网下载（推荐）

1. 访问 [https://nodejs.org/](https://nodejs.org/)
2. 下载 **LTS** 版本（长期支持版）
3. 双击 `.msi` 安装文件，按向导完成安装

### 方法二：包管理器

::: code-group

```powershell [Chocolatey]
choco install nodejs
```

```powershell [Scoop]
scoop install nodejs
```

:::

### 验证安装

```powershell
node --version
npm --version
```

两条命令均有输出即表示安装成功。

---

## 步骤二：安装 Claude Code

以**管理员身份**打开 PowerShell，运行：

```powershell
npm install -g @anthropic-ai/claude-code
```

验证安装：

```powershell
claude --version
```

::: tip 遇到权限错误？
确认以管理员身份运行 PowerShell。如果遇到执行策略错误，先运行：
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
:::

---

## 步骤三：配置环境变量

在 PowerShell 中运行以下命令，将 `sk-hub-xxx` 替换为你的 Terminal Token：

```powershell
[System.Environment]::SetEnvironmentVariable("ANTHROPIC_BASE_URL", "https://api.hub.tertax.cn", "User")
[System.Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", "sk-hub-xxx", "User")
[System.Environment]::SetEnvironmentVariable("CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", "1", "User")
```

> 环境变量说明：
> - `ANTHROPIC_BASE_URL`：Hub 代理地址，所有请求通过此地址转发
> - `ANTHROPIC_API_KEY`：你的 Terminal Token，用于身份验证
> - `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`：禁用遥测数据上报，避免连接超时

### 验证环境变量

```powershell
[System.Environment]::GetEnvironmentVariable("ANTHROPIC_BASE_URL", "User")
[System.Environment]::GetEnvironmentVariable("ANTHROPIC_API_KEY", "User")
[System.Environment]::GetEnvironmentVariable("CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", "User")
```

三条命令均有对应输出即表示设置成功。

---

## 步骤四：验证和使用

::: warning 重要
必须**重启 PowerShell**（以普通用户身份，非管理员）才能使环境变量生效。
:::

验证 Claude Code 是否正常工作：

```powershell
claude --version
```

进入某个项目目录，启动 Claude Code：

```powershell
cd C:\path\to\your\project
claude
```

---

## 常见问题

### SyntaxError: Unexpected token '{'

**原因**：Node.js 版本低于 18。

**解决**：
1. 检查版本：`node --version`
2. 从 [nodejs.org](https://nodejs.org/) 下载最新 LTS 版本重新安装
3. 重新运行：`npm install -g @anthropic-ai/claude-code`

### 安装时提示 "permission denied"

以管理员身份运行 PowerShell 重试。

### PowerShell 执行策略错误

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 环境变量设置后不生效

必须关闭当前 PowerShell 窗口，重新打开一个新的 PowerShell（非管理员）后再试。

也可通过以下命令检查临时生效：

```powershell
$env:ANTHROPIC_BASE_URL = "https://api.hub.tertax.cn"
$env:ANTHROPIC_API_KEY = "sk-hub-xxx"
$env:CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "1"
```
