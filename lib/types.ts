export type CoolingType = 'air' | 'hydro' | 'immersion'
export type SpecConfidence = 'verified' | 'pending_verification'
export type LeadType = 'deal_review' | 'hosting_match' | 'email_capture' | 'audit_inquiry'
export type LeadStatus = 'new' | 'reviewed' | 'responded' | 'converted' | 'closed'

export interface Miner {
  id: number
  name: string
  algorithm: string
  cooling_type: CoolingType
  default_hashrate_th: number
  power_watts: number
  spec_confidence: SpecConfidence
  notes: string | null
  is_active: boolean
  created_at: string
  // v2 enriched fields
  slug?: string | null
  manufacturer?: string | null
  release_date?: string | null
  market_price_usd?: number | null
  efficiency_j_per_th?: number | null
  noise_db?: number | null
  dimensions?: string | null
  weight_kg?: number | null
  best_for?: string | null
  worst_for?: string | null
  rating?: number | null
  pros?: string[] | null
  cons?: string[] | null
}

export type HostingProvider = {
  // Identity
  id: string
  name: string
  tier: 1 | 2 | 3
  country: string
  facilityLocations: string[]
  website: string
  contactEmail: string
  lastVerified: string

  // Pricing (what powers the calculator)
  rateMin: number | null
  rateMax: number | null
  flatMonthly: number | null
  billingType: 'kwh' | 'flat' | 'revenue_share'
  setupFee: number | null
  repairPolicy: string
  hiddenFees: string | null

  // Infrastructure
  cooling: CoolingType[]
  powerSource: string
  capacityMW: number | null
  uptimePercent: number | null

  // Terms
  minMachines: number | null
  contractLength: string
  financingAvailable: boolean
  insuranceAvailable: boolean
  customerOwnedMiners: boolean
  minerPurchaseProgram: boolean
  poolOptions: string[]
  kycRequired: boolean

  // Commercial
  affiliateProgram: boolean
  affiliateRate: string | null
  affiliateLink: string | null

  // Status
  verified: boolean
  verificationStatus: 'verified' | 'pending' | 'contact_only' | 'unresponsive'
  listingStatus: 'active' | 'flagged' | 'removed'
  warningFlag: string | null

  // Scoring
  lightningScore: number

  // Content
  description: string
  pros: string[]
  cons: string[]
  bestFor: string
}

export interface Lead {
  id: number
  name: string
  email: string
  lead_type: LeadType
  form_data: Record<string, unknown>
  extracted_entities: Record<string, unknown> | null
  primary_concern: string | null
  question_category: string | null
  status: LeadStatus
  founder_notes: string | null
  created_at: string
  updated_at: string
}

export interface CalculatorInputs {
  hashrate_th: number
  power_watts: number
  electricity_rate_kwh: number
  hardware_cost: number | null
  btc_price: number
  network_difficulty: number
}

export interface CalculatorResults {
  daily_btc_mined: number
  daily_revenue_usd: number
  daily_power_cost_usd: number
  daily_profit_usd: number
  monthly_revenue_usd: number
  monthly_profit_usd: number
  annual_revenue_usd: number
  annual_profit_usd: number
  breakeven_btc_price: number
  profit_margin_percent: number
  hashprice_usd_per_th_day: number
  payback_days: number | null
}

export interface GlossaryTerm {
  id: number
  term: string
  definition: string
  extended_explanation?: string | null
  related_terms?: string[] | null
}

export interface DealAnalysis {
  hardware_score: number
  hosting_score: number
  efficiency_score: number
  profitability_score: number
  risk_score: number
  overall_score: number
  verdict: string
  verdict_detail: string
}

export interface Article {
  slug: string
  title: string
  meta_description: string
  category: string
  tags: string[]
  reading_time_minutes: number
  content: string
  faqs: { question: string; answer: string }[]
  is_published: boolean
}

// Mining concern taxonomy
export const CONCERN_CATEGORIES = [
  'ROI',
  'Hosting',
  'Power Costs',
  'Hardware Selection',
  'Difficulty Risk',
  'BTC Price Risk',
  'Taxes',
  'Financing',
  'Cooling',
  'Other',
] as const

export type ConcernCategory = (typeof CONCERN_CATEGORIES)[number]
