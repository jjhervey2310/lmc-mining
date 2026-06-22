import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Bitcoin Mining Hosting Match',
  description: 'Find the best Bitcoin mining hosting company for your needs.',
}

export default function HostingMatchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
