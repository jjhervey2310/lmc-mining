'use client'
import { useEffect } from 'react'
import { lightningEngine } from '@/lib/lightning-engine'

export default function LightningInit() {
  useEffect(() => {
    lightningEngine.init()
    // Never destroy — engine persists for the entire session
  }, [])
  return null
}
