---
layout: home

hero:
  name: "Claude Code Hub"
  text: "安装与接入指南"
  tagline: 将 Claude Code 安装到你的设备，并连接到 Hub 代理，开始使用共享的 Claude 资源。
  actions:
    - theme: brand
      text: Windows 安装
      link: /windows
    - theme: alt
      text: macOS 安装
      link: /macos
    - theme: alt
      text: Linux / WSL2
      link: /linux

features:
  - icon: 🪟
    title: Windows
    details: 支持 Windows 10/11，提供完整的 PowerShell 配置命令，5 分钟完成安装。
    link: /windows
    linkText: 查看 Windows 指南
  - icon: 🍎
    title: macOS
    details: 支持 Intel 和 Apple Silicon，兼容 zsh 和 bash，一键完成环境配置。
    link: /macos
    linkText: 查看 macOS 指南
  - icon: 🐧
    title: Linux / WSL2
    details: 支持 Ubuntu、Debian、CentOS 等主流发行版，以及 Windows WSL2 环境。
    link: /linux
    linkText: 查看 Linux 指南
---

## 开始之前

在安装 Claude Code 之前，请确认你已具备以下条件：

- **Terminal Token**：从 Hub 管理员处获取你的 `sk-hub-xxx` token
- **Hub 地址**：`https://api.hub.tertax.cn`
- **网络连通性**：确保可以访问 Hub 服务器

> 如果你还没有 token，请联系管理员在 [Hub 管理面板](https://hub.tertax.cn) 为你创建 terminal。
