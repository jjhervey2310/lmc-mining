'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div
      className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center"
      style={{ color: '#e2e8f0' }}
    >
      <div className="text-4xl mb-4" style={{ color: '#f7931a' }}>⚡</div>
      <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
      <p className="text-sm text-gray-400 mb-6 max-w-sm">
        An error occurred loading this page. Try refreshing or click below to retry.
      </p>
      <button
        onClick={reset}
        className="px-5 py-2 rounded-lg text-sm font-semibold"
        style={{ background: '#f7931a', color: '#000' }}
      >
        Try again
      </button>
    </div>
  )
}
