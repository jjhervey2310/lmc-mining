-- ============================================================
-- LMC Mining MVP Database Schema
-- Run this in your Supabase SQL editor
-- ============================================================

-- Miners table
CREATE TABLE IF NOT EXISTS miners (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  algorithm TEXT DEFAULT 'SHA-256',
  cooling_type TEXT NOT NULL CHECK (cooling_type IN ('air', 'hydro', 'immersion')),
  default_hashrate_th NUMERIC NOT NULL,
  power_watts INTEGER NOT NULL,
  spec_confidence TEXT DEFAULT 'verified' CHECK (spec_confidence IN ('verified', 'pending_verification')),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Hosting providers table
CREATE TABLE IF NOT EXISTS hosting_providers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  website TEXT,
  locations TEXT[],
  supported_cooling TEXT[],
  monthly_fee_air NUMERIC,
  monthly_fee_hydro NUMERIC,
  monthly_fee_immersion NUMERIC,
  pricing_status TEXT DEFAULT 'verified' CHECK (pricing_status IN ('verified', 'contact_required', 'pending_verification')),
  deposit_amount NUMERIC,
  deposit_description TEXT,
  deposit_status TEXT DEFAULT 'verified' CHECK (deposit_status IN ('verified', 'unverified')),
  contract_terms TEXT,
  contract_status TEXT DEFAULT 'verified' CHECK (contract_status IN ('verified', 'unverified')),
  key_features TEXT[],
  affiliate_program_available BOOLEAN DEFAULT false,
  affiliate_url TEXT,
  affiliate_commission TEXT,
  is_primary BOOLEAN DEFAULT false,
  verification_status TEXT DEFAULT 'verified' CHECK (verification_status IN ('verified', 'pending_verification')),
  verification_source_url TEXT,
  verification_date DATE,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  sort_order INTEGER DEFAULT 0,
  hydro_immersion_available_date TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  lead_type TEXT NOT NULL CHECK (lead_type IN ('deal_review', 'hosting_match', 'email_capture', 'audit_inquiry')),
  form_data JSONB NOT NULL,
  extracted_entities JSONB,
  primary_concern TEXT,
  question_category TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'responded', 'converted', 'closed')),
  founder_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Affiliate clicks table
CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id SERIAL PRIMARY KEY,
  provider_name TEXT,
  destination_url TEXT NOT NULL,
  source_page TEXT,
  cooling_type_context TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Analytics events table
CREATE TABLE IF NOT EXISTS analytics_events (
  id SERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  event_data JSONB,
  page TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Knowledge vault table
CREATE TABLE IF NOT EXISTS knowledge_vault (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content JSONB,
  tags TEXT[],
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Hosting provider notes table
CREATE TABLE IF NOT EXISTS hosting_provider_notes (
  id SERIAL PRIMARY KEY,
  provider_name TEXT NOT NULL,
  cooling_support_notes TEXT,
  pricing_notes TEXT,
  service_notes TEXT,
  uptime_notes TEXT,
  support_notes TEXT,
  customer_feedback TEXT,
  audit_mentions INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Testimonials table
CREATE TABLE IF NOT EXISTS testimonials (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT,
  testimonial TEXT NOT NULL,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  source TEXT,
  is_displayed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Updated_at trigger for leads
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) - enable for production security
ALTER TABLE miners ENABLE ROW LEVEL SECURITY;
ALTER TABLE hosting_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE hosting_provider_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;

-- Public read policies for miners and hosting_providers
CREATE POLICY "Public read miners" ON miners FOR SELECT USING (true);
CREATE POLICY "Public read hosting_providers" ON hosting_providers FOR SELECT USING (true);
CREATE POLICY "Public read testimonials" ON testimonials FOR SELECT USING (is_displayed = true);

-- Service role insert policies (used by server-side API routes)
CREATE POLICY "Service insert leads" ON leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Service insert affiliate_clicks" ON affiliate_clicks FOR INSERT WITH CHECK (true);
CREATE POLICY "Service insert analytics_events" ON analytics_events FOR INSERT WITH CHECK (true);
