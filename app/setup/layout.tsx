import type { Metadata } from 'next'

export const metadata: Metadata = {
  alternates: { canonical: '/setup' },
  title: 'Done-With-You Bitcoin Mining Setup — $997',
  description: 'Deploy your first Bitcoin miners with an independent operator in the room: hardware selection, hosting shortlist, contract review, deployment checklist, and first-payout verification. $997, three clients a month, application required.',
}

export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
