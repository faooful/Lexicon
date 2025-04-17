import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Lexicon - Word Game',
  description: 'A word game combining elements of Wordle and Bananagrams',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
} 