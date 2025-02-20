import type { Metadata } from 'next'
import './globals.css'
import { LabelProvider } from "../lib/context/LabelContext"

export const metadata: Metadata = {
  title: 'v0 App',
  description: 'Created with v0',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        <LabelProvider>
          {children}
        </LabelProvider>
      </body>
    </html>
  )
}
