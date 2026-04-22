# Linux / WSL2 安装指南

本指南适用于 **Ubuntu、Debian、CentOS、RHEL、Fedora** 等主流 Linux 发行版，以及 **Windows WSL2** 环境。

---

## 准备工作

在开始前，请确认你已从管理员处获取：
- **Terminal Token**：格式为 `sk-hub-xxx`
- **Hub API 地址**：`https://api.hub.tertax.cn`

如果使用 WSL2，请先确保 WSL2 已正确安装并可正常访问网络。

---

## 步骤一：安装 Node.js

Claude Code 需要 Node.js 18 或更高版本。

### 方法一：NodeSource 官方仓库（推荐）

::: code-group

```bash [Ubuntu / Debian / WSL2]
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

```bash [CentOS / RHEL / Fedora]
curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
sudo dnf install -y nodejs
```

:::

### 方法二：系统包管理器

::: code-group

```bash [Ubuntu / Debian]
sudo apt update
sudo apt install -y nodejs npm
```

```bash [CentOS / RHEL / Fedora]
sudo dnf install -y nodejs npm
```

:::

::: warning 注意
系统包管理器中的 Node.js 版本可能偏旧，建议优先使用方法一。
:::

### 验证安装

```bash
node --version
npm --version
```

两条命令均有输出即表示安装成功。

---

## 步骤二：安装 Claude Code

```bash
npm install -g @anthropic-ai/claude-code
```

验证安装：

```bash
claude --version
```

::: tip 遇到权限错误？
```bash
sudo npm install -g @anthropic-ai/claude-code
```
:::

---

## 步骤三：配置环境变量

将 `sk-hub-xxx` 替换为你的 Terminal Token。

::: code-group

```bash [bash（大多数 Linux 默认）]
echo 'export ANTHROPIC_BASE_URL="https://api.hub.tertax.cn"' >> ~/.bashrc
echo 'export ANTHROPIC_API_KEY="sk-hub-xxx"' >> ~/.bashrc
echo 'export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1' >> ~/.bashrc
source ~/.bashrc
```

```bash [zsh]
echo 'export ANTHROPIC_BASE_URL="https://api.hub.tertax.cn"' >> ~/.zshrc
echo 'export ANTHROPIC_API_KEY="sk-hub-xxx"' >> ~/.zshrc
echo 'export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1' >> ~/.zshrc
source ~/.zshrc
```

:::

> 不确定自己用的是哪种 Shell？运行 `echo $SHELL`。

> 环境变量说明：
> - `ANTHROPIC_BASE_URL`：Hub 代理地址，所有请求通过此地址转发
> - `ANTHROPIC_API_KEY`：你的 Terminal Token，用于身份验证
> - `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`：禁用遥测数据上报，避免连接超时

### 验证环境变量

```bash
echo $ANTHROPIC_BASE_URL
echo $ANTHROPIC_API_KEY
echo $CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC
```

三条命令均有对应输出即表示设置成功。

---

## 步骤四：验证和使用

::: warning 重要
必须**重新打开终端**（或运行 `source ~/.bashrc`）才能使环境变量生效。
:::

验证 Claude Code 是否正常工作：

```bash
claude --version
```

进入某个项目目录，启动 Claude Code：

```bash
cd /path/to/your/project
claude
```

---

## 常见问题

### 权限错误（permission denied）

使用 `sudo` 安装：

```bash
sudo npm install -g @anthropic-ai/claude-code
```

### 缺少依赖包

按照错误提示安装对应的包，例如：

```bash
sudo apt install -y build-essential
```

### 环境变量设置后不生效

确认修改的是正确的配置文件并重新加载：

```bash
source ~/.bashrc   # 或 source ~/.zshrc
```

如果仍然不生效，重新打开终端。

### WSL2：无法连接到 Hub

1. 确认 Windows 防火墙没有阻止 WSL2 的出站连接
2. 在 WSL2 中测试网络：`curl -I https://api.hub.tertax.cn`
3. 如果公司网络有代理，可能需要在 WSL2 中配置代理：
   ```bash
   export HTTPS_PROXY=http://your-proxy:port
   ```

### WSL2：Node.js 安装前先更新

```bash
sudo apt update && sudo apt upgrade -y
```
