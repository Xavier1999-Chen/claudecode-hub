# macOS 安装指南

本指南适用于 **macOS 12 及以上版本**，支持 Intel 和 Apple Silicon（M 系列芯片）。

---

## 准备工作

在开始前，请确认你已从管理员处获取：
- **Terminal Token**：格式为 `sk-hub-xxx`
- **Hub API 地址**：`https://api.hub.tertax.cn`

---

## 步骤一：安装 Node.js

Claude Code 需要 Node.js 18 或更高版本。

### 方法一：Homebrew（推荐）

如果尚未安装 Homebrew，先安装：

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

然后安装 Node.js：

```bash
brew update
brew install node
```

### 方法二：官网下载

1. 访问 [https://nodejs.org/](https://nodejs.org/)
2. 下载 **LTS** 版本对应的 macOS `.pkg` 文件
3. 双击运行安装程序

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

```bash [zsh（默认 Shell）]
echo 'export ANTHROPIC_BASE_URL="https://api.hub.tertax.cn"' >> ~/.zshrc
echo 'export ANTHROPIC_API_KEY="sk-hub-xxx"' >> ~/.zshrc
echo 'export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1' >> ~/.zshrc
source ~/.zshrc
```

```bash [bash]
echo 'export ANTHROPIC_BASE_URL="https://api.hub.tertax.cn"' >> ~/.bash_profile
echo 'export ANTHROPIC_API_KEY="sk-hub-xxx"' >> ~/.bash_profile
echo 'export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1' >> ~/.bash_profile
source ~/.bash_profile
```

:::

> 不确定自己用的是哪种 Shell？运行 `echo $SHELL`，输出 `/bin/zsh` 则用 zsh，输出 `/bin/bash` 则用 bash。

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
必须**重新打开 Terminal**（完全关闭再重新打开）才能使环境变量生效。
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

### macOS 安全设置阻止运行

前往**系统设置 → 隐私与安全性**，在底部找到被阻止的程序，点击"仍要打开"。

### 环境变量设置后不生效

确认修改的是正确的配置文件，然后重新加载：

```bash
# zsh
source ~/.zshrc

# bash
source ~/.bash_profile
```

如果仍然不生效，完全退出 Terminal 并重新打开。

### Homebrew 安装速度慢

可设置镜像源，或直接从 [nodejs.org](https://nodejs.org/) 下载安装包。
