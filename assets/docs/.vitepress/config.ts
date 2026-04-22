import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Claude Code Hub',
  description: '将 Claude Code 接入 Hub 代理的安装配置指南',
  lang: 'zh-CN',
  cleanUrls: true,

  head: [
    ['meta', { name: 'theme-color', content: '#E87040' }],
  ],

  themeConfig: {
    siteTitle: 'Claude Code Hub',

    nav: [
      { text: '首页', link: '/' },
      {
        text: '安装指南',
        items: [
          { text: 'Windows', link: '/windows' },
          { text: 'macOS', link: '/macos' },
          { text: 'Linux / WSL2', link: '/linux' },
        ],
      },
    ],

    sidebar: [
      {
        text: '安装配置',
        items: [
          { text: 'Windows', link: '/windows' },
          { text: 'macOS', link: '/macos' },
          { text: 'Linux / WSL2', link: '/linux' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/Xavier1999-Chen/claudecode-hub' },
    ],

    footer: {
      copyright: 'Copyright © 2025 Claude Code Hub',
    },

    outline: {
      label: '本页目录',
      level: [2, 3],
    },

    docFooter: {
      prev: '上一页',
      next: '下一页',
    },
  },
})
