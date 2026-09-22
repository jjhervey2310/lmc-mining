import { redirect } from 'next/navigation'

// The terminal's entry point. POSTS used to live here, but the content machine
// is paused (Jacob 2026-08-31), so it is off the nav and parked at
// /admin/dashboard/posts — nothing deleted, ready to come back.
//
// This route stays because the installed phone app's start_url points at it;
// changing that would only take effect on a reinstall. It forwards to ROBINHOOD,
// which is the first tab again (Jacob 2026-09-22: "i want robinhood first").
// #39 pointed it at the AI competition on 09-19; the front door follows the
// first tab, so the two move together.

export const dynamic = 'force-dynamic'

export default async function DashboardHome({ searchParams }: { searchParams: Promise<{ secret?: string }> }) {
  const { secret = '' } = await searchParams
  redirect(`/admin/dashboard/fund?secret=${encodeURIComponent(secret)}`)
}
