import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { PwaRegister } from '@/components/pwa-register'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Sprello 商圏分析',
  description: '洗車店の出店・商圏分析ツール',
  generator: 'v0.app',
  applicationName: 'Sprello',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'Sprello',
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  themeColor: '#1b4da0',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja">
      <body className={`font-sans antialiased`}>
        {children}
        <PwaRegister />
      </body>
    </html>
  )
}
