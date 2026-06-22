-- ============================================================
-- LMC Mining MVP Seed Data
-- Run AFTER schema.sql
-- ============================================================

-- ============================================================
-- AIR-COOLED MINERS (Verified specs from manufacturer datasheets)
-- ============================================================
INSERT INTO miners (name, algorithm, cooling_type, default_hashrate_th, power_watts, spec_confidence, notes) VALUES
('Antminer S21 Pro', 'SHA-256', 'air', 234, 3510, 'verified', 'Bitmain flagship air-cooled miner as of 2024'),
('Antminer S21', 'SHA-256', 'air', 200, 3500, 'verified', 'Bitmain S21 series standard model'),
('Antminer S19 XP', 'SHA-256', 'air', 140, 3010, 'verified', 'High-efficiency S19 generation'),
('Antminer S19j Pro+', 'SHA-256', 'air', 122, 3355, 'verified', NULL),
('Antminer S19j Pro', 'SHA-256', 'air', 100, 3050, 'verified', NULL),
('Antminer S19 Pro', 'SHA-256', 'air', 110, 3250, 'verified', NULL),
('Canaan Avalon A1566', 'SHA-256', 'air', 150, 3420, 'verified', 'Canaan top-of-range A1566'),
('Canaan Avalon A1466', 'SHA-256', 'air', 130, 3230, 'verified', NULL),
('Canaan Avalon A1366', 'SHA-256', 'air', 110, 3250, 'verified', NULL),
('Whatsminer M60S', 'SHA-256', 'air', 170, 3400, 'verified', 'MicroBT Whatsminer M60S');

-- ============================================================
-- HYDRO-COOLED MINERS
-- Specs from Bitmain official datasheets where available
-- pending_verification used where exact spec unconfirmed
-- ============================================================
INSERT INTO miners (name, algorithm, cooling_type, default_hashrate_th, power_watts, spec_confidence, notes) VALUES
('Antminer S21 Pro Hydro', 'SHA-256', 'hydro', 335, 5360, 'verified', 'Bitmain S21 Pro hydro variant — liquid cooling required'),
('Antminer S21 Hydro', 'SHA-256', 'hydro', 319, 5360, 'verified', 'Bitmain S21 hydro variant'),
('Antminer S19 XP Hydro', 'SHA-256', 'hydro', 255, 5346, 'verified', 'S19 XP hydro variant — significantly higher hash than air'),
('Antminer S19 Pro+ Hydro', 'SHA-256', 'hydro', 198, 5445, 'verified', 'S19 Pro+ hydro cooling variant'),
('Whatsminer M63S Hydro', 'SHA-256', 'hydro', 390, 7215, 'pending_verification', 'Using published MicroBT specs — verify with manufacturer for latest revision');

-- ============================================================
-- IMMERSION-COOLED MINERS
-- ============================================================
INSERT INTO miners (name, algorithm, cooling_type, default_hashrate_th, power_watts, spec_confidence, notes) VALUES
('Antminer S19 XP Immersion', 'SHA-256', 'immersion', 255, 2900, 'pending_verification', 'Immersion variant estimated from air-cooled equivalent with typical 10-15% power reduction — verify with Bitmain for exact spec'),
('Whatsminer M50S++ Immersion', 'SHA-256', 'immersion', 230, 3600, 'pending_verification', 'Immersion-optimized variant — contact MicroBT to confirm spec'),
('Antminer S21 Pro Immersion', 'SHA-256', 'immersion', 270, 3300, 'pending_verification', 'Immersion variant spec estimated from air-cooled equivalent — pending manufacturer confirmation');

-- ============================================================
-- HOSTING PROVIDERS
-- ============================================================

-- PRIMARY: Abundant Miners (VERIFIED)
INSERT INTO hosting_providers (
  name, website, locations, supported_cooling,
  monthly_fee_air, pricing_status,
  deposit_amount, deposit_description, deposit_status,
  contract_terms, contract_status,
  key_features,
  affiliate_program_available, affiliate_url,
  is_primary,
  verification_status, verification_source_url, verification_date,
  rating, sort_order,
  hydro_immersion_available_date
) VALUES (
  'Abundant Miners',
  'https://abundantminers.com',
  ARRAY['United States'],
  ARRAY['air'],
  225.00,
  'verified',
  500.00,
  '$500 deposit covers months 11 and 12 of your 12-month contract',
  'verified',
  '12-month contract',
  'verified',
  ARRAY['#1 Rated for Air-Cooled Miners', 'Transparent pricing', 'US-based operations', 'Professional support', 'Hydro & Immersion coming ~2027'],
  true,
  NULL,
  true,
  'verified',
  'https://abundantminers.com',
  '2026-06-07',
  5,
  1,
  '~2027'
);

-- Compass Mining (VERIFIED — contact for pricing)
INSERT INTO hosting_providers (
  name, website, locations, supported_cooling,
  pricing_status,
  deposit_status, contract_status,
  key_features,
  affiliate_program_available,
  is_primary,
  verification_status, verification_source_url, verification_date,
  rating, sort_order
) VALUES (
  'Compass Mining',
  'https://compassmining.io',
  ARRAY['United States', 'Canada', 'Finland', 'Iceland', 'Norway'],
  ARRAY['air', 'immersion'],
  'contact_required',
  'unverified',
  'unverified',
  ARRAY['Multiple global locations', 'Marketplace model', 'Air and immersion options', 'Established 2019'],
  true,
  false,
  'verified',
  'https://compassmining.io',
  '2026-06-07',
  4,
  2
);

-- Core Scientific (VERIFIED — enterprise, contact for pricing)
INSERT INTO hosting_providers (
  name, website, locations, supported_cooling,
  pricing_status,
  deposit_status, contract_status,
  key_features,
  affiliate_program_available,
  is_primary,
  verification_status, verification_source_url, verification_date,
  rating, sort_order
) VALUES (
  'Core Scientific',
  'https://corescientific.com',
  ARRAY['Texas', 'Georgia', 'North Dakota', 'Kentucky'],
  ARRAY['air', 'immersion'],
  'contact_required',
  'unverified',
  'unverified',
  ARRAY['Publicly traded (CORZ)', 'Enterprise-scale operations', 'Multiple US data centers', 'Air and immersion cooling'],
  false,
  false,
  'verified',
  'https://corescientific.com',
  '2026-06-07',
  4,
  3
);

-- Blockware Solutions (VERIFIED — contact for pricing)
INSERT INTO hosting_providers (
  name, website, locations, supported_cooling,
  pricing_status,
  deposit_status, contract_status,
  key_features,
  affiliate_program_available,
  is_primary,
  verification_status, verification_source_url, verification_date,
  rating, sort_order
) VALUES (
  'Blockware Solutions',
  'https://blockwaresolutions.com',
  ARRAY['United States'],
  ARRAY['air'],
  'contact_required',
  'unverified',
  'unverified',
  ARRAY['Mining intelligence reports', 'Hardware + hosting bundles', 'Miner brokerage', 'US-based'],
  false,
  false,
  'verified',
  'https://blockwaresolutions.com',
  '2026-06-07',
  3,
  4
);

-- Sabre56 (VERIFIED — immersion/hydro specialist, contact for pricing)
INSERT INTO hosting_providers (
  name, website, locations, supported_cooling,
  pricing_status,
  deposit_status, contract_status,
  key_features,
  affiliate_program_available,
  is_primary,
  verification_status, verification_source_url, verification_date,
  rating, sort_order
) VALUES (
  'Sabre56',
  'https://sabre56.com',
  ARRAY['United States', 'Iceland'],
  ARRAY['hydro', 'immersion'],
  'contact_required',
  'unverified',
  'unverified',
  ARRAY['Immersion cooling specialist', 'Hydro cooling available', 'Renewable energy locations', 'High-density deployments'],
  false,
  false,
  'verified',
  'https://sabre56.com',
  '2026-06-07',
  4,
  5
);

-- Bit5ive (VERIFIED — immersion specialist, contact for pricing)
INSERT INTO hosting_providers (
  name, website, locations, supported_cooling,
  pricing_status,
  deposit_status, contract_status,
  key_features,
  affiliate_program_available,
  is_primary,
  verification_status, verification_source_url, verification_date,
  rating, sort_order
) VALUES (
  'Bit5ive',
  'https://bit5ive.com',
  ARRAY['United States'],
  ARRAY['air', 'immersion'],
  'contact_required',
  'unverified',
  'unverified',
  ARRAY['Immersion cooling pods', 'Air and immersion options', 'US-based', 'Modular deployment'],
  false,
  false,
  'verified',
  'https://bit5ive.com',
  '2026-06-07',
  3,
  6
);
