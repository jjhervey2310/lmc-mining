export const AFFILIATES = {
  ledger: {
    name: "Ledger",
    url: "https://shop.ledger.com/?r=e8ab22756ddf",
    type: "hardware_wallet",
    commission: "affiliate_commission",
    disclosure: "LMC earns commission from Ledger sales",
    cta: "Secure your mined BTC with Ledger"
  },
  abundant_mines: {
    name: "Abundant Mines",
    url: null,
    type: "hosting",
    commission: null,
    disclosure: "LMC operator at this facility"
  },
  simple_mining: {
    name: "Simple Mining",
    url: null,
    type: "hosting",
    commission: "2%"
  }
};

export function getAffiliateLink(provider: string) {
  return (AFFILIATES as Record<string, { url?: string | null; disclosure?: string | null }>)[provider]?.url || null;
}

export function getDisclosure(provider: string) {
  return (AFFILIATES as Record<string, { url?: string | null; disclosure?: string | null }>)[provider]?.disclosure || null;
}
