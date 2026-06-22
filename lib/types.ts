export type CoolingType = 'air' | 'hydro' | 'immersion'
export type SpecConfidence = 'verified' | 'pending_verification'
export type PricingStatus = 'verified' | 'contact_required' | 'pending_verification'
export type VerificationStatus = 'verified' | 'pending_verification'
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

export interface HostingProvider {
  id: number
  name: string
  website: string | null
  locations: string[] | null
  supported_cooling: CoolingType[] | null
  monthly_fee_air: number | null
  monthly_fee_hydro: number | null
  monthly_fee_immersion: number | null
  pricing_status: PricingStatus
  deposit_amount: number | null
  deposit_description: string | null
  deposit_status: 'verified' | 'unverified'
  contract_terms: string | null
  contract_status: 'verified' | 'unverified'
  key_features: string[] | null
  affiliate_program_available: boolean
  affiliate_url: string | null
  affiliate_commission: string | null
  is_primary: boolean
  verification_status: VerificationStatus
  verification_source_url: string | null
  verification_date: string | null
  rating: number | null
  sort_order: number
  hydro_immersion_available_date: string | null
  is_active: boolean
  created_at: string
  // v2 enriched fields
  slug?: string | null
  electricity_rate_kwh?: number | null
  setup_fee?: number | null
  insurance_included?: boolean | null
  pool_flexibility?: boolean | null
  firmware_flexibility?: boolean | null
  financing_available?: boolean | null
  min_units?: number | null
  max_units?: number | null
  best_for?: string | null
  uptime_guarantee?: number | null
  user_rating?: number | null
  review_count?: number | null
  description?: string | null
  pros?: string[] | null
  cons?: string[] | null
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
  miner: Miner | null
  hashrate_th: number
  power_watts: number
  cooling_type: CoolingType
  provider: HostingProvider | null
  monthly_hosting_fee: number | null
  electricity_rate_kwh: number
  miner_purchase_price: number | null
  btc_price: number
  network_difficulty: number
}

export interface CalculatorResults {
  daily_btc_mined: number
  daily_gross_revenue_usd: number
  daily_home_electricity_cost: number
  daily_hosted_cost: number | null
  daily_net_profit_home: number
  daily_net_profit_hosted: number | null
  monthly_net_profit_home: number
  monthly_net_profit_hosted: number | null
  annual_net_profit_home: number
  annual_net_profit_hosted: number | null
  breakeven_days_hosted: number | null
  breakeven_days_home: number | null
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
