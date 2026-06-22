import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

// Load .env.local then .env
for (const file of ['.env.local', '.env']) {
  const p = path.resolve(process.cwd(), file)
  if (fs.existsSync(p)) {
    dotenv.config({ path: p })
    console.log(`Loaded env from ${file}`)
    break
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('\n❌  Missing Supabase credentials.')
  console.error('    Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local\n')
  process.exit(1)
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ─── Miners ──────────────────────────────────────────────────────────────────

const MINERS = [
  // Air-cooled — verified from manufacturer datasheets
  { name: 'Antminer S21 Pro',       cooling_type: 'air',       default_hashrate_th: 234, power_watts: 3510, spec_confidence: 'verified',             notes: 'Bitmain flagship air-cooled miner (2024)' },
  { name: 'Antminer S21',           cooling_type: 'air',       default_hashrate_th: 200, power_watts: 3500, spec_confidence: 'verified',             notes: null },
  { name: 'Antminer S19 XP',        cooling_type: 'air',       default_hashrate_th: 140, power_watts: 3010, spec_confidence: 'verified',             notes: 'High-efficiency S19 generation' },
  { name: 'Antminer S19j Pro+',     cooling_type: 'air',       default_hashrate_th: 122, power_watts: 3355, spec_confidence: 'verified',             notes: null },
  { name: 'Antminer S19j Pro',      cooling_type: 'air',       default_hashrate_th: 100, power_watts: 3050, spec_confidence: 'verified',             notes: null },
  { name: 'Antminer S19 Pro',       cooling_type: 'air',       default_hashrate_th: 110, power_watts: 3250, spec_confidence: 'verified',             notes: null },
  { name: 'Canaan Avalon A1566',    cooling_type: 'air',       default_hashrate_th: 150, power_watts: 3420, spec_confidence: 'verified',             notes: null },
  { name: 'Canaan Avalon A1466',    cooling_type: 'air',       default_hashrate_th: 130, power_watts: 3230, spec_confidence: 'verified',             notes: null },
  { name: 'Canaan Avalon A1366',    cooling_type: 'air',       default_hashrate_th: 110, power_watts: 3250, spec_confidence: 'verified',             notes: null },
  { name: 'Whatsminer M60S',        cooling_type: 'air',       default_hashrate_th: 170, power_watts: 3400, spec_confidence: 'verified',             notes: 'MicroBT Whatsminer M60S' },
  // Hydro
  { name: 'Antminer S21 Pro Hydro', cooling_type: 'hydro',     default_hashrate_th: 335, power_watts: 5360, spec_confidence: 'verified',             notes: 'Liquid cooling required' },
  { name: 'Antminer S21 Hydro',     cooling_type: 'hydro',     default_hashrate_th: 319, power_watts: 5360, spec_confidence: 'verified',             notes: null },
  { name: 'Antminer S19 XP Hydro',  cooling_type: 'hydro',     default_hashrate_th: 255, power_watts: 5346, spec_confidence: 'verified',             notes: 'Significantly higher hash than air variant' },
  { name: 'Antminer S19 Pro+ Hydro',cooling_type: 'hydro',     default_hashrate_th: 198, power_watts: 5445, spec_confidence: 'verified',             notes: null },
  { name: 'Whatsminer M63S Hydro',  cooling_type: 'hydro',     default_hashrate_th: 390, power_watts: 7215, spec_confidence: 'pending_verification', notes: 'Verify latest revision with MicroBT' },
  // Immersion
  { name: 'Antminer S19 XP Immersion',   cooling_type: 'immersion', default_hashrate_th: 255, power_watts: 2900, spec_confidence: 'pending_verification', notes: 'Estimated ~10-15% power reduction vs air — verify with Bitmain' },
  { name: 'Whatsminer M50S++ Immersion',  cooling_type: 'immersion', default_hashrate_th: 230, power_watts: 3600, spec_confidence: 'pending_verification', notes: 'Immersion-optimised variant — contact MicroBT to confirm' },
  { name: 'Antminer S21 Pro Immersion',   cooling_type: 'immersion', default_hashrate_th: 270, power_watts: 3300, spec_confidence: 'pending_verification', notes: 'Estimated from air-cooled equivalent — pending manufacturer confirmation' },
]

// ─── Hosting providers ────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().split('T')[0]

const PROVIDERS = [
  {
    name: 'Abundant Miners',
    website: 'https://abundantminers.com',
    locations: ['United States'],
    supported_cooling: ['air'],
    monthly_fee_air: 225,
    pricing_status: 'verified',
    deposit_amount: 500,
    deposit_description: '$500 deposit covers months 11 and 12 of your 12-month contract',
    deposit_status: 'verified',
    contract_terms: '12-month contract',
    contract_status: 'verified',
    key_features: ['#1 Rated for Air-Cooled Miners', 'Transparent pricing', 'US-based operations', 'Hydro & Immersion coming ~2027'],
    affiliate_program_available: true,
    affiliate_url: 'https://abundantmines.com/ref/72/',
    is_primary: true,
    verification_status: 'verified',
    verification_source_url: 'https://abundantminers.com',
    verification_date: TODAY,
    rating: 5,
    sort_order: 1,
    hydro_immersion_available_date: '~2027',
  },
  {
    name: 'Compass Mining',
    website: 'https://compassmining.io',
    locations: ['United States', 'Canada', 'Finland', 'Iceland', 'Norway'],
    supported_cooling: ['air', 'immersion'],
    pricing_status: 'contact_required',
    deposit_status: 'unverified',
    contract_status: 'unverified',
    key_features: ['Multiple global locations', 'Marketplace model', 'Air and immersion options', 'Established 2019'],
    affiliate_program_available: true,
    is_primary: false,
    verification_status: 'verified',
    verification_source_url: 'https://compassmining.io',
    verification_date: TODAY,
    rating: 4,
    sort_order: 2,
  },
  {
    name: 'Core Scientific',
    website: 'https://corescientific.com',
    locations: ['Texas', 'Georgia', 'North Dakota', 'Kentucky'],
    supported_cooling: ['air', 'immersion'],
    pricing_status: 'contact_required',
    deposit_status: 'unverified',
    contract_status: 'unverified',
    key_features: ['Publicly traded (CORZ)', 'Enterprise-scale operations', 'Multiple US data centers', 'Air and immersion cooling'],
    affiliate_program_available: false,
    is_primary: false,
    verification_status: 'verified',
    verification_source_url: 'https://corescientific.com',
    verification_date: TODAY,
    rating: 4,
    sort_order: 3,
  },
  {
    name: 'Blockware Solutions',
    website: 'https://blockwaresolutions.com',
    locations: ['United States'],
    supported_cooling: ['air'],
    pricing_status: 'contact_required',
    deposit_status: 'unverified',
    contract_status: 'unverified',
    key_features: ['Mining intelligence reports', 'Hardware + hosting bundles', 'US-based'],
    affiliate_program_available: false,
    is_primary: false,
    verification_status: 'verified',
    verification_source_url: 'https://blockwaresolutions.com',
    verification_date: TODAY,
    rating: 3,
    sort_order: 4,
  },
  {
    name: 'Sabre56',
    website: 'https://sabre56.com',
    locations: ['United States', 'Iceland'],
    supported_cooling: ['hydro', 'immersion'],
    pricing_status: 'contact_required',
    deposit_status: 'unverified',
    contract_status: 'unverified',
    key_features: ['Immersion cooling specialist', 'Hydro cooling available', 'Renewable energy locations', 'High-density deployments'],
    affiliate_program_available: false,
    is_primary: false,
    verification_status: 'verified',
    verification_source_url: 'https://sabre56.com',
    verification_date: TODAY,
    rating: 4,
    sort_order: 5,
  },
  {
    name: 'Bit5ive',
    website: 'https://bit5ive.com',
    locations: ['United States'],
    supported_cooling: ['air', 'immersion'],
    pricing_status: 'contact_required',
    deposit_status: 'unverified',
    contract_status: 'unverified',
    key_features: ['Immersion cooling pods', 'Air and immersion options', 'Modular deployment', 'US-based'],
    affiliate_program_available: false,
    is_primary: false,
    verification_status: 'verified',
    verification_source_url: 'https://bit5ive.com',
    verification_date: TODAY,
    rating: 3,
    sort_order: 6,
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg: string) { process.stdout.write(msg) }
function ok()  { console.log(' ✓') }
function fail(err: unknown) { console.log(' ✗'); console.error('  ', err); process.exit(1) }

// ─── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('\n🌱  LMC Mining — seed script\n')

  // ── Miners ──
  log('  Clearing existing miners ...')
  const { error: delMiners } = await supabase.from('miners').delete().neq('id', 0)
  if (delMiners) fail(delMiners)
  ok()

  log(`  Inserting ${MINERS.length} miners ...`)
  const { error: insMiners } = await supabase
    .from('miners')
    .insert(MINERS.map(m => ({ ...m, algorithm: 'SHA-256', is_active: true })))
  if (insMiners) fail(insMiners)
  ok()

  // ── Hosting providers ──
  log('  Clearing existing hosting providers ...')
  const { error: delProv } = await supabase.from('hosting_providers').delete().neq('id', 0)
  if (delProv) fail(delProv)
  ok()

  log(`  Inserting ${PROVIDERS.length} hosting providers ...`)
  const { error: insProv } = await supabase
    .from('hosting_providers')
    .insert(PROVIDERS.map(p => ({ ...p, is_active: true })))
  if (insProv) fail(insProv)
  ok()

  // ── Verify counts ──
  const { count: minerCount } = await supabase
    .from('miners').select('*', { count: 'exact', head: true })
  const { count: provCount } = await supabase
    .from('hosting_providers').select('*', { count: 'exact', head: true })
  const { count: verifiedProvCount } = await supabase
    .from('hosting_providers')
    .select('*', { count: 'exact', head: true })
    .eq('verification_status', 'verified')

  console.log('\n  Results:')
  console.log(`    Miners inserted:                ${minerCount}`)
  console.log(`    Hosting providers inserted:     ${provCount}`)
  console.log(`    Verified providers:             ${verifiedProvCount}`)

  const airMiners   = MINERS.filter(m => m.cooling_type === 'air').length
  const hydroMiners = MINERS.filter(m => m.cooling_type === 'hydro').length
  const immerMiners = MINERS.filter(m => m.cooling_type === 'immersion').length
  console.log(`    Air miners:                     ${airMiners}`)
  console.log(`    Hydro miners:                   ${hydroMiners}`)
  console.log(`    Immersion miners:               ${immerMiners}`)

  if ((verifiedProvCount ?? 0) < 5) {
    console.error('\n⚠️   WARNING: fewer than 5 verified providers — MVP requirement not met.\n')
    process.exit(1)
  }

  if ((minerCount ?? 0) < 10) {
    console.error('\n⚠️   WARNING: fewer than 10 miners — MVP requirement not met.\n')
    process.exit(1)
  }

  console.log('\n✅  Seed complete — all MVP requirements satisfied.\n')
}

seed().catch(err => { console.error('\n❌  Seed failed:', err); process.exit(1) })
