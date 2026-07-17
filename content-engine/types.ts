// Core types for the Lightning Mines content engine.

export type Platform = 'youtube_shorts' | 'instagram_reels' | 'tiktok' | 'x'

export type Pillar =
  | 'hashprice_check'   // Mon/Fri
  | 'red_flag'          // Tue
  | 'hardware_reality'  // Wed
  | 'explainer'         // Thu
  | 'week_recap'        // Fri
  | 'myth_bust'         // Sat
  | 'longform'          // Sun

export interface LiveNumbers {
  btcPrice: number
  difficulty: number
  hashpricePerThDay: number // USD revenue per TH/s per day at the network level
  fetchedAt: string
  source: string
}

export interface MinerEconomics {
  slug: string
  name: string
  hashrateTh: number
  powerWatts: number
  hostingMonthly: number
  dailyRevenueUsd: number
  dailyHostingUsd: number
  dailyProfitUsd: number
  monthlyProfitUsd: number
  breakevenBtcPrice: number
  profitable: boolean
}

export interface ContentBrief {
  date: string
  pillar: Pillar
  hookNumber: string
  featuredMiner?: MinerEconomics
  live: LiveNumbers
  angle: string
}

export interface ClaimedNumber {
  label: string
  value: number
  unit: 'usd' | 'usd_per_th_day' | 'btc_price' | 'percent'
}

export interface Script {
  platform: Platform
  pillar: Pillar
  hook: string
  title?: string // display/YouTube title, <=90 chars, curiosity-driven but honest
  body: string
  onScreenText?: string[]
  caption: string
  hashtags: string[]
  cta: string
  disclosures: string[]
  claimedNumbers: ClaimedNumber[]
}

export interface GateResult {
  gate: string
  pass: boolean
  score?: number
  issues: string[]
  notes?: string[]
}

export interface ReviewedScript {
  script: Script
  gates: GateResult[]
  passedAll: boolean
  revisions: number // how many Claude↔GPT cross-check rounds it took
}

export interface PipelineResult {
  brief: ContentBrief
  reviewed: ReviewedScript[]
  generatedAt: string
  mode: 'dry' | 'live'
}
