import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Bitcoin Mining Hosting Match Tool',
  description: 'Find the right Bitcoin mining hosting provider for your hardware. Answer a few questions and get matched with compatible hosts at the best available rates.',
}

export default function HostingMatchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
