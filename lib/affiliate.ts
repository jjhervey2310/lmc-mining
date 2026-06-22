export async function trackAffiliateClick({
  providerName,
  destinationUrl,
  sourcePage,
  coolingTypeContext,
}: {
  providerName: string
  destinationUrl: string
  sourcePage: string
  coolingTypeContext?: string
}) {
  try {
    await fetch('/api/track-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider_name: providerName,
        destination_url: destinationUrl,
        source_page: sourcePage,
        cooling_type_context: coolingTypeContext,
      }),
    })
  } catch {
    // Non-blocking — tracking failure should never break UX
  }
}

export async function trackPageView(page: string) {
  try {
    await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'page_view', page }),
    })
  } catch {
    // Non-blocking
  }
}
