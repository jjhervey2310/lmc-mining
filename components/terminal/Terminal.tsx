'use client'

// The charting terminal.
//
// Rendering runs on TradingView's Apache-2.0 lightweight-charts engine; the
// data, the derived mining series, the indicators and the drawing tools are
// all ours. The engine is deliberately kept behind this component so the rest
// of the app never imports it directly.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  type UTCTimestamp,
} from 'lightweight-charts'
import { DEFAULT_SYMBOL, DEFAULT_TIMEFRAME, getSymbol, type ChartSymbol } from '@/lib/chart/symbols'
import type { Candle, Timeframe } from '@/lib/chart/types'
import { bollinger, ema, macd, rsi, sma, vwap } from '@/lib/chart/indicators'
import {
  loadDrawings,
  saveDrawings,
  type Drawing,
  type DrawingTool,
} from '@/lib/chart/drawings'
import DrawingCanvas from './DrawingCanvas'
import DrawingToolbar from './DrawingToolbar'
import SymbolPicker from './SymbolPicker'

const ORANGE = '#f7931a'
const UP = '#22c55e'
const DOWN = '#ef4444'

type IndicatorId = 'sma20' | 'sma50' | 'ema21' | 'bb' | 'vwap' | 'volume' | 'rsi' | 'macd'

interface IndicatorDef {
  id: IndicatorId
  label: string
  /** 'pane' indicators get their own sub-pane below the price chart. */
  kind: 'overlay' | 'pane'
  needsVolume?: boolean
  intradayOnly?: boolean
}

const INDICATORS: IndicatorDef[] = [
  { id: 'sma20', label: 'SMA 20', kind: 'overlay' },
  { id: 'sma50', label: 'SMA 50', kind: 'overlay' },
  { id: 'ema21', label: 'EMA 21', kind: 'overlay' },
  { id: 'bb', label: 'Bollinger', kind: 'overlay' },
  { id: 'vwap', label: 'VWAP', kind: 'overlay', needsVolume: true, intradayOnly: true },
  { id: 'volume', label: 'Volume', kind: 'pane', needsVolume: true },
  { id: 'rsi', label: 'RSI 14', kind: 'pane' },
  { id: 'macd', label: 'MACD', kind: 'pane' },
]

const isIntraday = (tf: Timeframe) => tf === '1h' || tf === '4h'

/** Shared empty array so "no data" keeps a stable identity across renders. */
const EMPTY_CANDLES: Candle[] = []

export default function Terminal() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [chart, setChart] = useState<IChartApi | null>(null)
  const [mainSeries, setMainSeries] = useState<ISeriesApi<SeriesType> | null>(null)

  const [symbol, setSymbol] = useState<ChartSymbol>(() => getSymbol(DEFAULT_SYMBOL)!)
  const [timeframe, setTimeframe] = useState<Timeframe>(DEFAULT_TIMEFRAME)
  // One keyed result rather than separate candles/loading/error states: loading
  // is then *derived* from whether the loaded key matches the requested one, so
  // switching symbols can never render the previous symbol's bars under the new
  // symbol's scale while the fetch is in flight.
  const [result, setResult] = useState<{ key: string; candles: Candle[]; error: string | null }>(
    { key: '', candles: EMPTY_CANDLES, error: null },
  )
  const viewKey = `${symbol.id}:${timeframe}`
  const isFresh = result.key === viewKey
  const candles = isFresh ? result.candles : EMPTY_CANDLES
  const error = isFresh ? result.error : null
  const loading = !isFresh

  const [enabled, setEnabled] = useState<Set<IndicatorId>>(new Set())
  const [tool, setTool] = useState<DrawingTool>('cursor')
  const [drawings, setDrawings] = useState<Drawing[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [color, setColor] = useState<string>(ORANGE)
  const [legend, setLegend] = useState<Candle | null>(null)

  // Series created for indicators, torn down and rebuilt as a unit so pane
  // indices can never drift out of sync with what's on screen.
  const extraSeriesRef = useRef<ISeriesApi<SeriesType>[]>([])
  const mainSeriesRef = useRef<ISeriesApi<SeriesType> | null>(null)
  const paneCountRef = useRef(1)
  const lastViewKeyRef = useRef<string>('')

  const hasVolume = useMemo(() => candles.some((c) => (c.volume ?? 0) > 0), [candles])

  const priceFormatter = useCallback(
    (v: number): string => {
      if (!Number.isFinite(v)) return '—'
      if (symbol.unit) return `${v.toFixed(symbol.precision)}${symbol.unit}`
      return `$${v.toLocaleString('en-US', {
        minimumFractionDigits: symbol.precision,
        maximumFractionDigits: symbol.precision,
      })}`
    },
    [symbol],
  )

  // ── Load bars ─────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false

    fetch(`/api/chart/ohlc?symbol=${encodeURIComponent(symbol.id)}&tf=${timeframe}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data?.error) {
          setResult({ key: viewKey, candles: EMPTY_CANDLES, error: data.error })
          return
        }
        const raw: Candle[] = Array.isArray(data?.candles) ? data.candles : []
        // The engine throws on unsorted or duplicated timestamps, which would
        // take down the whole page over one bad upstream bar.
        const seen = new Set<number>()
        const clean = raw
          .filter((c) => Number.isFinite(c?.time) && Number.isFinite(c?.close))
          .sort((a, b) => a.time - b.time)
          .filter((c) => (seen.has(c.time) ? false : (seen.add(c.time), true)))
        setResult({
          key: viewKey,
          candles: clean.length ? clean : EMPTY_CANDLES,
          error: clean.length ? null : 'No data available for this symbol',
        })
      })
      .catch(() => {
        if (!cancelled) {
          setResult({ key: viewKey, candles: EMPTY_CANDLES, error: 'Could not reach the data feed' })
        }
      })

    return () => { cancelled = true }
  }, [viewKey, symbol.id, timeframe])

  // Drawings are scoped per symbol and survive reloads.
  useEffect(() => {
    setDrawings(loadDrawings(symbol.id))
    setSelectedId(null)
  }, [symbol])

  const updateDrawings = useCallback(
    (next: Drawing[]) => {
      setDrawings(next)
      saveDrawings(symbol.id, next)
    },
    [symbol.id],
  )

  // A symbol that can't serve the current timeframe falls back to daily.
  useEffect(() => {
    if (!symbol.timeframes.includes(timeframe)) setTimeframe(symbol.timeframes[0])
  }, [symbol, timeframe])

  // Drop indicators the current data can't support (no volume, or daily bars).
  useEffect(() => {
    setEnabled((prev) => {
      const next = new Set(prev)
      let changed = false
      for (const def of INDICATORS) {
        if (!next.has(def.id)) continue
        if ((def.needsVolume && !hasVolume) || (def.intradayOnly && !isIntraday(timeframe))) {
          next.delete(def.id)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [hasVolume, timeframe])

  // ── Create the chart once ─────────────────────────────────────────────

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const c = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#0a0a0a' },
        textColor: '#9ca3af',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: '#171717' },
        horzLines: { color: '#171717' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#3f3f3f', width: 1, style: 3, labelBackgroundColor: '#f7931a' },
        horzLine: { color: '#3f3f3f', width: 1, style: 3, labelBackgroundColor: '#f7931a' },
      },
      rightPriceScale: { borderColor: '#222222', scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: '#222222', rightOffset: 6 },
    })

    setChart(c)
    return () => {
      c.remove()
      extraSeriesRef.current = []
      mainSeriesRef.current = null
      paneCountRef.current = 1
      lastViewKeyRef.current = ''
      setChart(null)
      setMainSeries(null)
    }
  }, [])

  // ── Build the series layer ────────────────────────────────────────────

  useEffect(() => {
    if (!chart || !candles.length) return

    // Keep the user's zoom when only the indicator set changed.
    const viewKey = `${symbol.id}:${timeframe}`
    const keepView = viewKey === lastViewKeyRef.current
    const previousRange = keepView ? chart.timeScale().getVisibleLogicalRange() : null

    for (const s of extraSeriesRef.current) {
      try { chart.removeSeries(s) } catch { /* already gone with its pane */ }
    }
    extraSeriesRef.current = []
    for (let i = paneCountRef.current - 1; i >= 1; i--) {
      try { chart.removePane(i) } catch { /* pane already collapsed */ }
    }
    paneCountRef.current = 1

    // Tracked on a ref as well as in state: removing the old series must not
    // happen inside a state updater, which StrictMode may invoke twice.
    if (mainSeriesRef.current) {
      try { chart.removeSeries(mainSeriesRef.current) } catch { /* disposed */ }
      mainSeriesRef.current = null
    }

    const minMove = 1 / 10 ** symbol.precision
    const priceFormat = symbol.unit
      ? ({ type: 'custom', formatter: priceFormatter, minMove } as const)
      : ({ type: 'price', precision: symbol.precision, minMove } as const)

    // Mining metrics have no intraday OHLC, so they render as an area series
    // rather than pretending to be candles.
    const main =
      symbol.shape === 'candlestick'
        ? chart.addSeries(CandlestickSeries, {
            upColor: UP, downColor: DOWN, borderUpColor: UP, borderDownColor: DOWN,
            wickUpColor: UP, wickDownColor: DOWN, priceFormat,
          })
        : chart.addSeries(AreaSeries, {
            lineColor: ORANGE, topColor: 'rgba(247,147,26,0.28)', bottomColor: 'rgba(247,147,26,0.02)',
            lineWidth: 2, priceFormat,
          })

    if (symbol.shape === 'candlestick') {
      main.setData(candles.map((c) => ({
        time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close,
      })))
    } else {
      main.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.close })))
    }
    mainSeriesRef.current = main
    setMainSeries(main)

    const addLine = (
      data: { time: number; value: number }[],
      lineColor: string,
      paneIndex = 0,
      lineWidth: 1 | 2 = 1,
    ) => {
      if (!data.length) return null
      const s = chart.addSeries(
        LineSeries,
        { color: lineColor, lineWidth, priceLineVisible: false, lastValueVisible: paneIndex > 0, crosshairMarkerVisible: false },
        paneIndex,
      )
      s.setData(data.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })))
      extraSeriesRef.current.push(s)
      return s
    }

    // Overlays on the price pane.
    if (enabled.has('sma20')) addLine(sma(candles, 20), '#60a5fa')
    if (enabled.has('sma50')) addLine(sma(candles, 50), '#a78bfa')
    if (enabled.has('ema21')) addLine(ema(candles, 21), '#22d3ee')
    if (enabled.has('bb')) {
      const b = bollinger(candles, 20, 2)
      addLine(b.upper, '#4b5563')
      addLine(b.middle, '#6b7280')
      addLine(b.lower, '#4b5563')
    }
    if (enabled.has('vwap') && hasVolume && isIntraday(timeframe)) {
      addLine(vwap(candles), '#fbbf24', 0, 2)
    }

    // Volume shares the price pane on its own hidden scale, pinned to the
    // bottom fifth so it never competes with price for vertical space.
    if (enabled.has('volume') && hasVolume) {
      const vol = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: '',
        lastValueVisible: false,
        priceLineVisible: false,
      })
      vol.setData(candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume ?? 0,
        color: c.close >= c.open ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)',
      })))
      vol.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })
      extraSeriesRef.current.push(vol)
    }

    // Sub-panes.
    if (enabled.has('rsi')) {
      const paneIndex = paneCountRef.current++
      const s = addLine(rsi(candles, 14), '#e879f9', paneIndex, 2)
      if (s) {
        for (const [level, lineColor] of [[70, '#ef4444'], [30, '#22c55e']] as const) {
          s.createPriceLine({ price: level, color: lineColor, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '' })
        }
        try { chart.panes()[paneIndex]?.setStretchFactor(0.28) } catch { /* engine handles layout */ }
      } else {
        paneCountRef.current--
      }
    }

    if (enabled.has('macd')) {
      const m = macd(candles, 12, 26, 9)
      if (m.macd.length) {
        const paneIndex = paneCountRef.current++
        const hist = chart.addSeries(
          HistogramSeries,
          { priceFormat: { type: 'price', precision: 2, minMove: 0.01 }, priceLineVisible: false },
          paneIndex,
        )
        hist.setData(m.histogram.map((p) => ({
          time: p.time as UTCTimestamp,
          value: p.value,
          color: p.value >= 0 ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)',
        })))
        extraSeriesRef.current.push(hist)
        addLine(m.macd, '#22d3ee', paneIndex, 2)
        addLine(m.signal, '#f97316', paneIndex, 1)
        try { chart.panes()[paneIndex]?.setStretchFactor(0.28) } catch { /* engine handles layout */ }
      }
    }

    if (previousRange) chart.timeScale().setVisibleLogicalRange(previousRange)
    else chart.timeScale().fitContent()
    lastViewKeyRef.current = viewKey
  }, [chart, candles, symbol, timeframe, enabled, hasVolume, priceFormatter])

  // ── Crosshair legend ──────────────────────────────────────────────────

  useEffect(() => {
    if (!chart || !mainSeries) return
    const handler = (param: Parameters<Parameters<IChartApi['subscribeCrosshairMove']>[0]>[0]) => {
      if (!param.time) {
        setLegend(null)
        return
      }
      const bar = param.seriesData.get(mainSeries) as
        | { open?: number; high?: number; low?: number; close?: number; value?: number }
        | undefined
      if (!bar) {
        setLegend(null)
        return
      }
      const close = bar.close ?? bar.value ?? 0
      setLegend({
        time: param.time as number,
        open: bar.open ?? close,
        high: bar.high ?? close,
        low: bar.low ?? close,
        close,
      })
    }
    chart.subscribeCrosshairMove(handler)
    return () => chart.unsubscribeCrosshairMove(handler)
  }, [chart, mainSeries])

  // Drawing tools need the chart to hold still while a shape is dragged out.
  useEffect(() => {
    if (!chart) return
    const interactive = tool === 'cursor'
    chart.applyOptions({
      handleScroll: interactive,
      handleScale: interactive,
    })
  }, [chart, tool])

  // ── Derived display values ────────────────────────────────────────────

  const last = candles.length ? candles[candles.length - 1] : null
  const prev = candles.length > 1 ? candles[candles.length - 2] : null
  const changePct = last && prev && prev.close ? ((last.close - prev.close) / prev.close) * 100 : null
  const shown = legend ?? last

  const availableIndicators = INDICATORS.filter(
    (d) => !(d.needsVolume && !hasVolume) && !(d.intradayOnly && !isIntraday(timeframe)),
  )

  const toggleIndicator = (id: IndicatorId) => {
    setEnabled((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-[#222] bg-[#111]">
      {/* Header: symbol, price, timeframe */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#222] px-3 py-2.5">
        <SymbolPicker value={symbol} onChange={setSymbol} />

        <div className="flex items-baseline gap-2">
          <span className="font-mono text-lg font-bold text-white">
            {last ? priceFormatter(last.close) : '—'}
          </span>
          {changePct !== null && (
            <span className={`font-mono text-xs font-bold ${changePct >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
            </span>
          )}
        </div>

        <div className="flex gap-0.5 rounded-lg border border-[#222] bg-[#0a0a0a] p-0.5">
          {symbol.timeframes.map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setTimeframe(tf)}
              className={`rounded px-2.5 py-1 font-mono text-xs font-bold transition-colors ${
                timeframe === tf ? 'bg-[#f7931a] text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => chart?.timeScale().fitContent()}
          className="rounded-lg border border-[#222] px-2.5 py-1 text-xs text-gray-400 transition-colors hover:border-[#333] hover:text-white"
        >
          Reset view
        </button>

        {/* OHLC readout follows the crosshair, falling back to the last bar. */}
        {shown && symbol.shape === 'candlestick' && (
          <div className="ml-auto hidden gap-3 font-mono text-xs text-gray-500 xl:flex">
            <span>O <span className="text-gray-300">{priceFormatter(shown.open)}</span></span>
            <span>H <span className="text-gray-300">{priceFormatter(shown.high)}</span></span>
            <span>L <span className="text-gray-300">{priceFormatter(shown.low)}</span></span>
            <span>C <span className="text-gray-300">{priceFormatter(shown.close)}</span></span>
          </div>
        )}
      </div>

      {/* Indicators */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-[#222] px-3 py-2">
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-gray-600">Indicators</span>
        {availableIndicators.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => toggleIndicator(d.id)}
            aria-pressed={enabled.has(d.id)}
            className={`rounded-md border px-2 py-1 font-mono text-[11px] transition-colors ${
              enabled.has(d.id)
                ? 'border-[#f7931a] bg-[#f7931a]/15 text-[#f7931a]'
                : 'border-[#222] text-gray-500 hover:border-[#333] hover:text-gray-300'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Toolbar + chart */}
      <div className="flex flex-col lg:flex-row">
        <DrawingToolbar
          tool={tool}
          onToolChange={setTool}
          color={color}
          onColorChange={setColor}
          drawingCount={drawings.length}
          hasSelection={selectedId !== null}
          onDeleteSelected={() => {
            if (!selectedId) return
            updateDrawings(drawings.filter((d) => d.id !== selectedId))
            setSelectedId(null)
          }}
          onClearAll={() => { updateDrawings([]); setSelectedId(null) }}
        />

        <div className="relative min-w-0 flex-1">
          <div ref={containerRef} className="h-[420px] w-full sm:h-[520px] lg:h-[600px]" />

          <DrawingCanvas
            chart={chart}
            series={mainSeries}
            candles={candles}
            tool={tool}
            drawings={drawings}
            onChange={updateDrawings}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onCommit={() => setTool('select')}
            color={color}
            priceFormatter={priceFormatter}
          />

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]/70">
              <span className="font-mono text-sm text-gray-500">Loading {symbol.label}…</span>
            </div>
          )}

          {!loading && error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-[#0a0a0a]/85">
              <span className="font-mono text-sm text-red-400">{error}</span>
              <span className="text-xs text-gray-600">Try another symbol or timeframe.</span>
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#222] px-3 py-2 text-[11px] text-gray-600">
        <span>{candles.length.toLocaleString()} bars</span>
        <span>{drawings.length} drawing{drawings.length === 1 ? '' : 's'}</span>
        <span className="hidden sm:inline">
          {tool === 'cursor'
            ? 'Pan mode — scroll to zoom, drag to pan'
            : tool === 'select'
              ? 'Select mode — click a drawing to move it, Del to remove'
              : 'Drag on the chart to place the shape'}
        </span>
        <span className="ml-auto">
          {symbol.kind === 'mining' ? 'Derived from mempool.space + Kraken' : symbol.kind === 'crypto' ? 'Kraken' : 'Yahoo Finance'}
        </span>
      </div>
    </div>
  )
}
