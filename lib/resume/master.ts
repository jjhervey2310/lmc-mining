// Master résumé fact-base — the single source of truth for every tailored CV.
//
// Jacob's recruiter (2026-08-12): "we need to start tailoring the CV to the
// position." Tailoring here means SELECTION and WORDING, never invention.
//
// Every fact below is lifted from Jacob's own résumés:
//   ~/Desktop/Jacob's/Jacob Hervey Resume .pdf   (the long, full-voice master)
//   ~/Desktop/New Resume.pdf                     (2026-08-11 condensed version)
//   ~/Desktop/JACOB James HERVEY_Director, Procurement_20260810.pdf (his own tailor)
// Where the versions differ, the union is kept — he has used all of these claims.
//
// The tailor may reorder, drop, merge and reword these to mirror a posting's
// language. It may NOT add a number, employer, tool, date or credential that is
// not here. If a real claim changes, change it HERE — nothing else in the
// pipeline holds résumé content.

export interface Fact {
  /** stable id so the model can cite what it selected */
  id: string
  text: string
  /** lowercase themes — used only to help the model choose, never printed */
  tags: string[]
}

export interface Role {
  id: string
  title: string
  employer: string
  location: string
  dates: string
  /** one-line context under the role heading; printed only when it helps */
  context?: string
  facts: Fact[]
}

export const CONTACT = {
  name: 'JACOB JAMES HERVEY',
  location: 'Denver, CO',
  email: 'jjhervey1@gmail.com',
  phone: '720-206-7962',
  status: 'US Citizen',
}

/** Never contradicted, whatever the posting. */
export const BASE_TRUTHS = [
  '13 years running businesses end to end as a CEO, COO, GM and Head of Operations',
  'Led a 75 person function with about 50 direct reports',
  'Owned full P&Ls',
  'Built a business from zero to $2M+ revenue',
  'Worked across US, Northern Irish and Irish business environments with a European supplier base',
]

/** The line he leans on when the posting cares about logistics of hiring. */
export const AVAILABILITY =
  'US citizen, based in Denver, available immediately. No sponsorship required.'

/** Skills he can honestly claim. The tailor picks ~11 and orders them to match
 *  the posting; it may not append a skill that is not on this list. */
export const SKILL_POOL = [
  'Operations Management', 'Procurement', 'Strategic Sourcing', 'Supply Chain',
  'P&L Management', 'Supplier Negotiation', 'Vendor Management', 'Contract Negotiation',
  'Inventory Management', 'Logistics', 'Cost Reduction', 'Margin Improvement',
  'Process Improvement', 'Team Leadership', 'Hiring & Training', 'Budgeting & Forecasting',
  'Demand & Production Planning', 'ERP Systems', 'CRM Systems', 'Warehouse & Stock Control',
  'Excel & Google Sheets', 'Automated Reporting', 'AI & Workflow Automation',
  'KPI Reporting', 'Change Management', 'Cross-functional Leadership',
  'Customer Fulfilment', 'Continuous Improvement', 'Multi-site Operations',
  'International Sourcing',
]

export const ROLES: Role[] = [
  {
    id: 'tilestyle',
    title: 'Head of Operations & Procurement',
    employer: 'TileStyle',
    location: 'Dublin',
    dates: 'Jan 2022 – May 2026',
    context: 'Family-owned tile, bathroom and flooring retailer trading over 40 years. Reported to the CEO.',
    facts: [
      { id: 'ts-spend', text: 'Ran approximately €5M of procurement spend a month, around €60M a year, across 50 to 100 suppliers, most of it inbound from Italy, Germany and Spain.', tags: ['procurement', 'sourcing', 'supplier', 'spend', 'budget', 'international', 'category'] },
      { id: 'ts-team', text: 'Led a 75 person operations and logistics function, about 50 of them reporting to me, working directly to the CEO.', tags: ['leadership', 'operations', 'logistics', 'team', 'management', 'field'] },
      { id: 'ts-deadstock', text: 'Recovered tens of thousands of euro of dead stock that had sat unsold in the warehouse without being flagged, cleared it and turned it back into cash.', tags: ['inventory', 'cost', 'cash', 'working capital', 'analysis', 'warehouse', 'turnaround'] },
      { id: 'ts-leadtime', text: 'Ran the logistics operation and team, holding inbound lead times down across three countries of European supply.', tags: ['logistics', 'lead time', 'supply chain', 'freight', 'international', 'delivery'] },
      { id: 'ts-process', text: 'Replaced informal handoffs in ordering and fulfilment with documented processes the team could run without me.', tags: ['process', 'sop', 'documentation', 'operations', 'fulfilment', 'scale', 'systems'] },
      { id: 'ts-margin', text: 'Tracked margin by category rather than in aggregate, so cost movement showed up before it reached the P&L.', tags: ['margin', 'finance', 'reporting', 'analytics', 'kpi', 'cost', 'pnl'] },
      { id: 'ts-terms', text: 'Managed supplier sourcing, negotiation, contracts, payment terms and ongoing supplier performance across a significant European supply base.', tags: ['negotiation', 'contracts', 'vendor', 'supplier', 'terms', 'performance', 'compliance'] },
    ],
  },
  {
    id: 'emerald',
    title: 'CEO & COO',
    employer: 'Emerald Farm',
    location: '',
    dates: 'Nov 2020 – Aug 2026',
    facts: [
      { id: 'em-build', text: 'Built the business from nothing with no outside funding: supply chain, procurement, staffing and production planning.', tags: ['founder', 'startup', 'build', 'operations', 'staffing', 'production', 'scale'] },
      { id: 'em-growth', text: 'Grew revenue from zero to over $2M in six years while holding gross margins between 40% and 60%.', tags: ['growth', 'revenue', 'margin', 'pnl', 'finance', 'scale'] },
      { id: 'em-team', text: 'Led a team of 4 and owned the P&L end to end.', tags: ['leadership', 'team', 'pnl', 'management'] },
      { id: 'em-retail', text: 'Won national retail listings with Boots, Holland & Barrett and Chemist Warehouse.', tags: ['sales', 'business development', 'retail', 'partnerships', 'accounts', 'customer', 'growth'] },
      { id: 'em-distributor', text: 'Restructured onto a distributor model that took over marketing and sales, reducing my side to fulfilment oversight.', tags: ['strategy', 'change', 'delegation', 'systems', 'restructure', 'channel'] },
      { id: 'em-exit', text: 'Agreed the sale of the business in 2026.', tags: ['exit', 'strategy', 'ownership'] },
    ],
  },
  {
    id: 'fontana',
    title: 'General Manager',
    employer: 'Fontana',
    location: 'Holywood, Co. Down, Northern Ireland',
    dates: 'Sep 2016 – Jun 2020',
    facts: [
      { id: 'fo-scale', text: 'Ran the full operation of a Michelin Guide listed restaurant with a team of 50 across multiple departments.', tags: ['leadership', 'team', 'operations', 'service', 'quality', 'multi-department', 'hospitality'] },
      { id: 'fo-growth', text: 'Increased revenue 20–30% and improved margins 5–10%.', tags: ['growth', 'revenue', 'margin', 'turnaround', 'pnl'] },
      { id: 'fo-own', text: 'Owned procurement, supplier negotiation, staffing and daily service standards.', tags: ['procurement', 'negotiation', 'staffing', 'standards', 'customer', 'operations'] },
      { id: 'fo-training', text: 'Built training and operating routines that kept high-volume service consistent through a growth phase.', tags: ['training', 'process', 'consistency', 'scale', 'hiring', 'quality', 'sop'] },
      { id: 'fo-cost', text: 'Cut labour, food and waste costs through better purchasing and supplier terms while owning budgets.', tags: ['cost', 'budget', 'procurement', 'efficiency', 'waste', 'labour'] },
    ],
  },
  {
    id: 'sonoma',
    title: 'Chief Operating Officer',
    employer: 'Sonoma Hills Farm',
    location: 'California',
    dates: 'Jan 2013 – Aug 2016',
    facts: [
      { id: 'so-build', text: 'Joined an early-stage agricultural start-up and built its operations function from the ground up.', tags: ['startup', 'build', 'operations', 'systems', 'scale', 'greenfield'] },
      { id: 'so-growth', text: 'Helped more than double revenue by increasing capacity and building the operating systems required to scale.', tags: ['growth', 'revenue', 'capacity', 'scale', 'systems'] },
      { id: 'so-plan', text: 'Managed production schedules, supply chain logistics and delivery timing so the product reached the market on schedule.', tags: ['planning', 'production', 'logistics', 'delivery', 'supply chain', 'scheduling'] },
      { id: 'so-team', text: 'Led about 10 people across procurement, inventory, production, logistics and supplier management.', tags: ['leadership', 'procurement', 'inventory', 'logistics', 'team'] },
      { id: 'so-founders', text: 'Worked directly with the founders to turn an idea into a working commercial operation.', tags: ['strategy', 'executive', 'stakeholder', 'founder', 'commercial'] },
    ],
  },
]

/** Closing section. The tailor picks the two or three that fit the posting. */
export const SYSTEMS_FACTS: Fact[] = [
  { id: 'sy-erp', text: 'ERP-based purchasing and stock control, with my own reporting built on top: automated pipelines that pull supplier and cost data daily and flag anything that has moved.', tags: ['erp', 'reporting', 'automation', 'data', 'systems', 'analytics'] },
  { id: 'sy-ai', text: 'Comfortable building automation and AI workflows to remove manual reporting work.', tags: ['ai', 'automation', 'technology', 'innovation', 'efficiency'] },
  { id: 'sy-region', text: 'Experience across US, Northern Irish and Irish business environments, with a European supplier base.', tags: ['international', 'global', 'multi-region', 'culture'] },
  { id: 'sy-avail', text: AVAILABILITY, tags: ['availability', 'relocation', 'work authorisation'] },
]

/** Flattened for the prompt. */
export function factSheet(): string {
  const lines: string[] = []
  for (const r of ROLES) {
    lines.push(`## ${r.id} — ${r.title} | ${r.employer}${r.location ? ', ' + r.location : ''} | ${r.dates}`)
    if (r.context) lines.push(`   (context line: ${r.context})`)
    for (const f of r.facts) lines.push(`   [${f.id}] ${f.text}   {${f.tags.join(', ')}}`)
  }
  lines.push('## systems')
  for (const f of SYSTEMS_FACTS) lines.push(`   [${f.id}] ${f.text}   {${f.tags.join(', ')}}`)
  return lines.join('\n')
}

export function findRole(id: string): Role | undefined {
  return ROLES.find((r) => r.id === id)
}
