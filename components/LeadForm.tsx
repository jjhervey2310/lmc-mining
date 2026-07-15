'use client'

import { useState, FormEvent } from 'react'

interface FieldConfig {
  name: string
  label: string
  type: 'text' | 'email' | 'textarea' | 'select'
  required?: boolean
  placeholder?: string
  options?: { value: string; label: string }[]
}

interface LeadFormProps {
  leadType: 'deal_review' | 'hosting_match' | 'audit_inquiry'
  fields: FieldConfig[]
  submitLabel: string
  successMessage: string
  onSuccess?: () => void
}

export default function LeadForm({ leadType, fields, submitLabel, successMessage, onSuccess }: LeadFormProps) {
  const [formState, setFormState] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formState.name,
          email: formState.email,
          lead_type: leadType,
          form_data: formState,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submission failed')

      setSubmitted(true)
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div
        className="rounded-xl p-8 text-center"
        style={{ background: '#00d4aa10', border: '1px solid #00d4aa30' }}
      >
        <div className="text-4xl mb-4">✓</div>
        <h3 className="text-xl font-semibold text-white mb-3">Submitted!</h3>
        <p className="text-gray-300 leading-relaxed">{successMessage}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fields.map((field) => (
        <div key={field.name}>
          <label htmlFor={field.name} className="block text-sm font-medium text-gray-300 mb-1.5">
            {field.label}
            {field.required && <span className="text-red-400 ml-1">*</span>}
          </label>

          {field.type === 'textarea' ? (
            <textarea
              id={field.name}
              name={field.name}
              required={field.required}
              placeholder={field.placeholder}
              rows={4}
              className="w-full rounded-lg px-3 py-2.5 text-sm resize-y"
              style={{ background: '#1f2937', color: '#e2e8f0', border: '1px solid #374151' }}
              value={formState[field.name] || ''}
              onChange={(e) => setFormState((s) => ({ ...s, [field.name]: e.target.value }))}
            />
          ) : field.type === 'select' ? (
            <select
              id={field.name}
              name={field.name}
              required={field.required}
              className="w-full rounded-lg px-3 py-2.5 text-sm"
              style={{ background: '#1f2937', color: '#e2e8f0', border: '1px solid #374151' }}
              value={formState[field.name] || ''}
              onChange={(e) => setFormState((s) => ({ ...s, [field.name]: e.target.value }))}
            >
              <option value="">Select...</option>
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={field.type}
              id={field.name}
              name={field.name}
              required={field.required}
              placeholder={field.placeholder}
              className="w-full rounded-lg px-3 py-2.5 text-sm"
              style={{ background: '#1f2937', color: '#e2e8f0', border: '1px solid #374151' }}
              value={formState[field.name] || ''}
              onChange={(e) => setFormState((s) => ({ ...s, [field.name]: e.target.value }))}
            />
          )}
        </div>
      ))}

      {error && (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{ background: '#ff475710', border: '1px solid #ff475730', color: '#ff4757' }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 rounded-lg font-semibold text-sm transition-opacity disabled:opacity-60"
        style={{ background: '#00d4aa', color: '#0a0e17' }}
      >
        {submitting ? 'Submitting...' : submitLabel}
      </button>
    </form>
  )
}
