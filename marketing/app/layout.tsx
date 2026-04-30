import type { Metadata } from 'next'
import { Inter, Source_Serif_4 } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-source-serif',
})

export const metadata: Metadata = {
  title: 'claudecode-hub · 共享账号池，让 Claude Code 既好用又划算',
  description:
    'Claude Code 用户的共享账号池服务：Pro/Max 共享 · 阶梯月结 · 免封号 · 先用后付。',
  metadataBase: new URL('https://claudecode-hub.example.com'),
  openGraph: {
    title: 'claudecode-hub',
    description: '共享账号池，让 Claude Code 既好用又划算',
    type: 'website',
    locale: 'zh_CN',
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className={`${inter.variable} ${sourceSerif.variable}`}>
      <body>{children}</body>
    </html>
  )
}
