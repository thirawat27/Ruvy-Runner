import './globals.css'

export const meta = {
  title: 'Ruvy-Runner — Endless Cyberpunk Runner',
  description: 'Jump, duck, and shoot your way through an endless cyberpunk world. Defeat bosses, rack up scores, and survive!',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#0a0a0f" />
      </head>
      <body>{children}</body>
    </html>
  )
}
