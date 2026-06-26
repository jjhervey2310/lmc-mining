-- LMC Mining v2 Phase 1 Migration
-- Run this in: https://supabase.com/dashboard/project/bngwwalucfirmcymqall/editor

-- Add new columns to miners table
ALTER TABLE miners ADD COLUMN IF NOT EXISTS release_date date;
ALTER TABLE miners ADD COLUMN IF NOT EXISTS market_price_usd numeric;
ALTER TABLE miners ADD COLUMN IF NOT EXISTS efficiency_j_per_th numeric;
ALTER TABLE miners ADD COLUMN IF NOT EXISTS noise_db integer;
ALTER TABLE miners ADD COLUMN IF NOT EXISTS dimensions text;
ALTER TABLE miners ADD COLUMN IF NOT EXISTS weight_kg numeric;
ALTER TABLE miners ADD COLUMN IF NOT EXISTS best_for text;
ALTER TABLE miners ADD COLUMN IF NOT EXISTS worst_for text;
ALTER TABLE miners ADD COLUMN IF NOT EXISTS rating numeric;
ALTER TABLE miners ADD COLUMN IF NOT EXISTS pros text[];
ALTER TABLE miners ADD COLUMN IF NOT EXISTS cons text[];
ALTER TABLE miners ADD COLUMN IF NOT EXISTS manufacturer text;
ALTER TABLE miners ADD COLUMN IF NOT EXISTS slug text unique;

-- Add new columns to hosting_providers table
ALTER TABLE hosting_providers ADD COLUMN IF NOT EXISTS slug text unique;
ALTER TABLE hosting_providers ADD COLUMN IF NOT EXISTS electricity_rate_kwh numeric;
ALTER TABLE hosting_providers ADD COLUMN IF NOT EXISTS setup_fee numeric;
ALTER TABLE hosting_providers ADD COLUMN IF NOT EXISTS insurance_included boolean default false;
ALTER TABLE hosting_providers ADD COLUMN IF NOT EXISTS pool_flexibility boolean default true;
ALTER TABLE hosting_providers ADD COLUMN IF NOT EXISTS firmware_flexibility boolean default true;
ALTER TABLE hosting_providers ADD COLUMN IF NOT EXISTS financing_available boolean default false;
ALTER TABLE hosting_providers ADD COLUMN IF NOT EXISTS min_units integer;
ALTER TABLE hosting_providers ADD COLUMN IF NOT EXISTS max_units integer;
ALTER TABLE hosting_providers ADD COLUMN IF NOT EXISTS best_for text;
ALTER TABLE hosting_providers ADD COLUMN IF NOT EXISTS uptime_guarantee numeric;
ALTER TABLE hosting_providers ADD COLUMN IF NOT EXISTS user_rating numeric;
ALTER TABLE hosting_providers ADD COLUMN IF NOT EXISTS review_count integer default 0;
ALTER TABLE hosting_providers ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE hosting_providers ADD COLUMN IF NOT EXISTS pros text[];
ALTER TABLE hosting_providers ADD COLUMN IF NOT EXISTS cons text[];

-- Create articles table
CREATE TABLE IF NOT EXISTS articles (
  id serial primary key,
  slug text unique not null,
  title text not null,
  meta_description text,
  content text not null,
  category text not null,
  tags text[],
  reading_time_minutes integer,
  is_published boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create mining_glossary table
CREATE TABLE IF NOT EXISTS mining_glossary (
  id serial primary key,
  term text unique not null,
  definition text not null,
  extended_explanation text,
  related_terms text[],
  created_at timestamptz default now()
);

-- Create deal_analyses table
CREATE TABLE IF NOT EXISTS deal_analyses (
  id serial primary key,
  lead_id integer references leads(id),
  miner_name text,
  hosting_provider text,
  electricity_rate numeric,
  monthly_fee numeric,
  hardware_cost numeric,
  profitability_score integer,
  hosting_score integer,
  risk_score integer,
  overall_score integer,
  verdict text,
  analysis_notes text,
  created_at timestamptz default now()
);

-- Create price_alerts table
CREATE TABLE IF NOT EXISTS price_alerts (
  id serial primary key,
  email text not null,
  alert_type text not null,
  threshold_value numeric,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Enable RLS on new tables
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE mining_glossary ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "Public read articles" ON articles FOR SELECT USING (is_published = true);
CREATE POLICY "Public read glossary" ON mining_glossary FOR SELECT USING (true);
CREATE POLICY "Service insert deal_analyses" ON deal_analyses FOR INSERT WITH CHECK (true);
CREATE POLICY "Service insert price_alerts" ON price_alerts FOR INSERT WITH CHECK (true);

-- Insert glossary terms
INSERT INTO mining_glossary (term, definition, extended_explanation) VALUES
('Hashrate', 'The speed at which a mining machine processes Bitcoin transactions, measured in terahashes per second (TH/s)', 'Higher hashrate means more chances to find a block and earn Bitcoin rewards. A machine with 200 TH/s attempts 200 trillion calculations per second.')
ON CONFLICT (term) DO NOTHING;

INSERT INTO mining_glossary (term, definition, extended_explanation) VALUES
('Terahash (TH/s)', 'One trillion hash computations per second — the standard unit for measuring Bitcoin miner performance', 'Modern miners range from 100 TH/s for older models to 300+ TH/s for the latest hardware.')
ON CONFLICT (term) DO NOTHING;

INSERT INTO mining_glossary (term, definition, extended_explanation) VALUES
('Network Difficulty', 'A measure of how hard it is to find a new Bitcoin block, automatically adjusted every 2016 blocks (approximately 2 weeks)', 'As more miners join the network difficulty increases making it harder for any individual miner to earn rewards. This is the biggest variable in long-term profitability.')
ON CONFLICT (term) DO NOTHING;

INSERT INTO mining_glossary (term, definition, extended_explanation) VALUES
('Block Reward', 'The amount of Bitcoin awarded to the miner who successfully adds a new block to the blockchain', 'Currently 3.125 BTC per block after the April 2024 halving. The next halving in 2028 will reduce this to 1.5625 BTC.')
ON CONFLICT (term) DO NOTHING;

INSERT INTO mining_glossary (term, definition, extended_explanation) VALUES
('J/TH (Joules per Terahash)', 'The efficiency rating of a Bitcoin miner — how much energy it uses to produce one terahash of mining power', 'Lower is better. The Antminer S21 Pro achieves approximately 15 J/TH making it one of the most efficient air-cooled miners available.')
ON CONFLICT (term) DO NOTHING;

INSERT INTO mining_glossary (term, definition, extended_explanation) VALUES
('Hashprice', 'The daily revenue generated per terahash of mining power, expressed in USD per TH/s per day', 'Hashprice combines BTC price and network difficulty into a single profitability metric. It fluctuates daily and is the fastest way to track mining economics.')
ON CONFLICT (term) DO NOTHING;

INSERT INTO mining_glossary (term, definition, extended_explanation) VALUES
('Breakeven', 'The point at which cumulative mining revenue equals the total cost of hardware plus hosting fees', 'A miner costing $8000 earning $25 per day net profit reaches breakeven in 320 days. Understanding breakeven is critical before any hardware purchase.')
ON CONFLICT (term) DO NOTHING;

INSERT INTO mining_glossary (term, definition, extended_explanation) VALUES
('Mining ROI', 'Return on Investment — the percentage return on your total mining capital over a given period', 'Calculated as total mining revenue minus total costs divided by initial hardware cost. A positive ROI means the operation is profitable.')
ON CONFLICT (term) DO NOTHING;

INSERT INTO mining_glossary (term, definition, extended_explanation) VALUES
('Bitcoin Halving', 'The event occurring every 210000 blocks (approximately 4 years) where the Bitcoin block reward is cut in half', 'Previous halvings occurred in 2012 2016 2020 and 2024. Each halving reduces new Bitcoin supply and historically precedes significant price increases.')
ON CONFLICT (term) DO NOTHING;

INSERT INTO mining_glossary (term, definition, extended_explanation) VALUES
('Mining Pool', 'A group of miners who combine their hashrate to increase their collective chances of earning block rewards', 'Solo mining is extremely unlikely to find blocks. Pools distribute rewards proportionally based on contributed hashrate. Popular pools include Foundry USA, Antpool, and F2Pool.')
ON CONFLICT (term) DO NOTHING;

INSERT INTO mining_glossary (term, definition, extended_explanation) VALUES
('kWh (Kilowatt Hour)', 'The standard unit for measuring electricity consumption and cost in mining operations', 'A miner using 3500 watts running for one hour consumes 3.5 kWh. At $0.07 per kWh that costs $0.245 per hour or $5.88 per day.')
ON CONFLICT (term) DO NOTHING;

INSERT INTO mining_glossary (term, definition, extended_explanation) VALUES
('ASIC Miner', 'Application-Specific Integrated Circuit — a computer chip designed exclusively for Bitcoin mining', 'Unlike GPUs which can mine multiple cryptocurrencies, ASICs are purpose-built for SHA-256 Bitcoin mining making them far more efficient.')
ON CONFLICT (term) DO NOTHING;

INSERT INTO mining_glossary (term, definition, extended_explanation) VALUES
('Air Cooling', 'The standard method of cooling Bitcoin miners using fans to move air across heat-generating components', 'Most cost-effective for small to medium operations. Requires good ventilation. Suitable for Antminer S19 and S21 series standard models.')
ON CONFLICT (term) DO NOTHING;

INSERT INTO mining_glossary (term, definition, extended_explanation) VALUES
('Hydro Cooling', 'A cooling method that circulates water or coolant through the miner to remove heat more efficiently than air', 'Allows higher overclocking, lower noise, and better efficiency. Requires more infrastructure investment. Supported by Antminer S21 Hydro series.')
ON CONFLICT (term) DO NOTHING;

INSERT INTO mining_glossary (term, definition, extended_explanation) VALUES
('Immersion Cooling', 'The most advanced cooling method where miners are submerged in non-conductive dielectric fluid', 'Dramatically extends hardware lifespan, enables maximum overclocking, lowest noise. Highest upfront infrastructure cost but best long-term economics at scale.')
ON CONFLICT (term) DO NOTHING;

-- ── Lightning Mines Launch: RLS on mining_glossary ──────────────────────────
-- Run in: https://supabase.com/dashboard/project/bngwwalucfirmcymqall/editor

ALTER TABLE public.mining_glossary ENABLE ROW LEVEL SECURITY;

CREATE POLICY public_read ON public.mining_glossary
  FOR SELECT TO anon USING (true);
