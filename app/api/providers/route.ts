import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { PROVIDERS_DATA } from '@/lib/data'
import type { HostingProvider } from '@/lib/types'

// Maps a raw Supabase row (old snake_case schema) to the current HostingProvider type
function mapDbRow(row: Record<string, unknown>): HostingProvider {
  const slug = String(row.slug ?? row.id ?? 'unknown')
  const isPrimary = Boolean(row.is_primary)
  const sortOrder = Number(row.sort_order ?? 99)
  const tier: 1 | 2 | 3 = isPrimary ? 1 : sortOrder <= 4 ? 2 : 3
  const pricingStatus = String(row.pricing_status ?? '')
  const verStatus = String(row.verification_status ?? '')
  return {
    id: slug,
    name: String(row.name ?? ''),
    tier,
    country: 'US',
    facilityLocations: (Array.isArray(row.locations) ? row.locations : []) as string[],
    website: String(row.website ?? ''),
    contactEmail: '',
    lastVerified: String(row.verification_date ?? ''),
    rateMin: row.electricity_rate_kwh != null ? Number(row.electricity_rate_kwh) : null,
    rateMax: row.electricity_rate_kwh != null ? Number(row.electricity_rate_kwh) : null,
    flatMonthly: row.monthly_fee_air != null ? Number(row.monthly_fee_air) : null,
    billingType: row.monthly_fee_air != null ? 'flat' : 'kwh',
    setupFee: row.deposit_amount != null ? Number(row.deposit_amount) : null,
    repairPolicy: String(row.deposit_description ?? 'Contact provider for repair policy'),
    hiddenFees: null,
    cooling: (Array.isArray(row.supported_cooling) ? row.supported_cooling : []) as ('air' | 'hydro' | 'immersion')[],
    powerSource: 'Grid',
    capacityMW: null,
    uptimePercent: row.uptime_guarantee != null ? Number(row.uptime_guarantee) : null,
    minMachines: row.min_units != null ? Number(row.min_units) : null,
    contractLength: String(row.contract_terms ?? 'flexible'),
    financingAvailable: Boolean(row.financing_available),
    insuranceAvailable: Boolean(row.insurance_included),
    customerOwnedMiners: true,
    minerPurchaseProgram: false,
    poolOptions: row.pool_flexibility ? ['Any pool — full freedom'] : [],
    kycRequired: false,
    affiliateProgram: Boolean(row.affiliate_program_available),
    affiliateRate: row.affiliate_commission != null ? String(row.affiliate_commission) : null,
    affiliateLink: row.affiliate_url != null ? String(row.affiliate_url) : null,
    verified: verStatus === 'verified',
    verificationStatus: pricingStatus === 'contact_required' ? 'contact_only'
      : verStatus === 'verified' ? 'verified'
      : 'pending',
    lightningScore: row.rating != null ? Math.round(Number(row.rating) * 20) : 50,
    description: String(row.description ?? ''),
    pros: (Array.isArray(row.pros) ? row.pros : []) as string[],
    cons: (Array.isArray(row.cons) ? row.cons : []) as string[],
    bestFor: String(row.best_for ?? ''),
  }
}

export async function GET() {
  const supabase = createServiceClient()

  if (!supabase) {
    return NextResponse.json({ providers: PROVIDERS_DATA })
  }

  const { data, error } = await supabase
    .from('hosting_providers')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
    .order('name')

  if (error || !data?.length) {
    console.error('Error fetching providers:', error)
    return NextResponse.json({ providers: PROVIDERS_DATA })
  }

  return NextResponse.json({ providers: data.map(mapDbRow) })
}

export const dynamic = 'force-dynamic'
