'use client'

import { useEffect, useState } from 'react'

// Terminal theme switch. Dark is the default look (Jacob 2026-08-06); the class
// lands on <html> so the `dark:` variant in globals.css applies everywhere, and
// the choice persists per device.

export default function ThemeToggle() {
  const [dark, setDark] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('lmc-theme')
    const wantDark = saved ? saved === 'dark' : true
    setDark(wantDark)
    document.documentElement.classList.toggle('lmc-dark', wantDark)
  }, [])

  function flip() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('lmc-dark', next)
    localStorage.setItem('lmc-theme', next ? 'dark' : 'light')
  }

  return (
    <button
      onClick={flip}
      title={dark ? 'switch to light' : 'switch to dark'}
      className="rounded-full border border-neutral-300 px-2 py-0.5 text-[12px] transition-colors hover:border-amber-500 dark:border-white/15 dark:text-neutral-300 dark:hover:border-amber-400"
    >
      {dark ? '☀' : '☾'}
    </button>
  )
}
