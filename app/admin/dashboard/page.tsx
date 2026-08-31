import { redirect } from 'next/navigation'

// The terminal's entry point. POSTS used to live here, but the content machine
// is paused (Jacob 2026-08-31), so it is off the nav and parked at
// /admin/dashboard/posts — nothing deleted, ready to come back.
//
// This route stays because the installed phone app's start_url points at it;
// changing that would only take effect on a reinstall. It forwards to MINE SIM,
// which is now the first tab.

export const dynamic = 'force-dynamic'

export default async function DashboardHome({ searchParams }: { searchParams: Promise<{ secret?: string }> }) {
  const { secret = '' } = await searchParams
  redirect(`/admin/dashboard/mining?secret=${encodeURIComponent(secret)}`)
}
