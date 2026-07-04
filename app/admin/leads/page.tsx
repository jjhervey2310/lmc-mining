import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
}

type Lead = {
  id: string
  email: string
  name: string | null
  lead_type: string
  source: string | null
  notes: string | null
  status: string | null
  sent_emails: string[] | null
  created_at: string
}

function badge(type: string) {
  const colors: Record<string, string> = {
    email_capture: '#1e40af',
    audit_inquiry: '#7c3aed',
    deal_analyzer: '#065f46',
    default: '#374151',
  }
  const bg = colors[type] ?? colors.default
  return (
    <span style={{ background: bg, color: '#fff', fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {type.replace('_', ' ')}
    </span>
  )
}

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ secret?: string }>
}) {
  const adminSecret = process.env.ADMIN_SECRET
  const params = await searchParams
  if (adminSecret && params.secret !== adminSecret) {
    notFound()
  }

  const supabase = createServiceClient()
  if (!supabase) {
    return (
      <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#fff', background: '#0a0a0a', minHeight: '100vh' }}>
        <h1 style={{ color: '#ef4444' }}>Supabase not configured</h1>
        <p style={{ color: '#94a3b8' }}>Set SUPABASE_SERVICE_ROLE_KEY in your environment variables.</p>
      </div>
    )
  }

  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, email, name, lead_type, source, notes, status, sent_emails, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    return (
      <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#fff', background: '#0a0a0a', minHeight: '100vh' }}>
        <h1 style={{ color: '#ef4444' }}>Database error</h1>
        <pre style={{ color: '#94a3b8', fontSize: 13 }}>{JSON.stringify(error, null, 2)}</pre>
      </div>
    )
  }

  const rows = (leads ?? []) as Lead[]
  const counts = rows.reduce<Record<string, number>>((acc, l) => {
    acc[l.lead_type] = (acc[l.lead_type] ?? 0) + 1
    return acc
  }, {})

  return (
    <div style={{ padding: 32, fontFamily: 'sans-serif', background: '#0a0e17', minHeight: '100vh', color: '#e2e8f0' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ color: '#f59e0b', fontSize: 24, fontWeight: 700, margin: 0 }}>⚡ LMC Mining — Leads</h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: '4px 0 0' }}>
            {rows.length} total leads
            {Object.entries(counts).map(([type, n]) => ` · ${n} ${type.replace('_', ' ')}`).join('')}
          </p>
        </div>

        <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #1e293b' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#111827' }}>
                {['Date', 'Email', 'Name', 'Type', 'Source', 'Sequence', 'Notes', 'Status'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 12, borderBottom: '1px solid #1e293b', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((lead, i) => (
                <tr key={lead.id} style={{ background: i % 2 === 0 ? '#0d1117' : '#0a0e17', borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '10px 14px', color: '#64748b', whiteSpace: 'nowrap', fontSize: 12 }}>
                    {new Date(lead.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    <br />
                    <span style={{ color: '#374151', fontSize: 11 }}>
                      {new Date(lead.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', color: '#e2e8f0', fontWeight: 500 }}>{lead.email}</td>
                  <td style={{ padding: '10px 14px', color: '#94a3b8' }}>{lead.name ?? '—'}</td>
                  <td style={{ padding: '10px 14px' }}>{badge(lead.lead_type)}</td>
                  <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {lead.source ?? '—'}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12 }}>
                    {Array.isArray(lead.sent_emails) && lead.sent_emails.length > 0
                      ? lead.sent_emails.join(', ')
                      : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {lead.notes ?? '—'}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ color: lead.status === 'new' ? '#00d4aa' : '#64748b', fontSize: 12 }}>
                      {lead.status ?? '—'}
                    </span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#374151' }}>
                    No leads yet. Submit a form on the site to see them here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {adminSecret && (
          <p style={{ marginTop: 16, color: '#1f2937', fontSize: 12, textAlign: 'center' }}>
            Protected by ADMIN_SECRET · /admin/leads?secret=your_secret
          </p>
        )}
      </div>
    </div>
  )
}

export const dynamic = 'force-dynamic'
