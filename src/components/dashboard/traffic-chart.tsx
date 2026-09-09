import { useEffect, useRef } from 'react'

import { useTrafficData } from '@/hooks/use-traffic-data'
import parseTraffic from '@/utils/parse-traffic'

type Sample = { down: number; up: number; timestamp: number }

const MAX_SAMPLES = 60

export const TrafficChart = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const samplesRef = useRef<Sample[]>([])
  const drawRef = useRef<() => void>(() => {})
  const { response: { data: traffic } } = useTrafficData()

  useEffect(() => {
    const samples = samplesRef.current
    samples.push({
      down: Math.max(0, traffic?.down ?? 0),
      up: Math.max(0, traffic?.up ?? 0),
      timestamp: Date.now(),
    })
    if (samples.length > MAX_SAMPLES) samples.splice(0, samples.length - MAX_SAMPLES)
    drawRef.current()
  }, [traffic])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    let frame: number | undefined
    let size = { width: 0, height: 0, ratio: 0 }

    const resizeIfNeeded = () => {
      const rect = canvas.getBoundingClientRect()
      const ratio = window.devicePixelRatio || 1
      if (
        rect.width === size.width &&
        rect.height === size.height &&
        ratio === size.ratio
      ) {
        return rect
      }
      size = { width: rect.width, height: rect.height, ratio }
      canvas.width = Math.max(1, Math.round(rect.width * ratio))
      canvas.height = Math.max(1, Math.round(rect.height * ratio))
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      return rect
    }

    const draw = () => {
      frame = undefined
      const rect = resizeIfNeeded()
      if (rect.width <= 0 || rect.height <= 0) return

      const width = rect.width
      const height = rect.height
      const left = 42
      const bottom = 18
      const top = 8
      const plotWidth = Math.max(1, width - left - 10)
      const plotHeight = Math.max(1, height - top - bottom)
      const samples = samplesRef.current
      const maxRate = Math.max(1, ...samples.flatMap((sample) => [sample.down, sample.up]))

      context.clearRect(0, 0, width, height)
      context.font = '10px sans-serif'
      context.fillStyle = 'var(--text-muted, #7b93b2)'
      context.textAlign = 'right'
      context.textBaseline = 'middle'
      ;[1, 0.5, 0].forEach((ratio) => {
        const y = top + plotHeight * (1 - ratio)
        const [value, unit] = parseTraffic(maxRate * ratio)
        context.fillText(ratio === 0 ? '0' : `${value} ${unit}/s`, left - 7, y)
        context.beginPath()
        context.setLineDash([3, 4])
        context.strokeStyle = 'rgba(56, 189, 248, 0.16)'
        context.moveTo(left, y)
        context.lineTo(left + plotWidth, y)
        context.stroke()
      })
      context.setLineDash([])

      const drawSeries = (key: 'down' | 'up', stroke: string, fill: string) => {
        if (samples.length < 2) return
        const step = plotWidth / Math.max(1, samples.length - 1)
        context.beginPath()
        samples.forEach((sample, index) => {
          const x = left + index * step
          const y = top + plotHeight * (1 - Math.min(1, sample[key] / maxRate))
          if (index === 0) context.moveTo(x, y)
          else context.lineTo(x, y)
        })
        context.lineTo(left + plotWidth, top + plotHeight)
        context.lineTo(left, top + plotHeight)
        context.closePath()
        context.fillStyle = fill
        context.fill()

        context.beginPath()
        samples.forEach((sample, index) => {
          const x = left + index * step
          const y = top + plotHeight * (1 - Math.min(1, sample[key] / maxRate))
          if (index === 0) context.moveTo(x, y)
          else context.lineTo(x, y)
        })
        context.strokeStyle = stroke
        context.lineWidth = 1.8
        context.stroke()
      }

      drawSeries('down', '#00d2ff', 'rgba(0, 210, 255, 0.18)')
      drawSeries('up', '#e879f9', 'rgba(232, 121, 249, 0.14)')
    }

    const scheduleDraw = () => {
      if (frame === undefined) frame = window.requestAnimationFrame(draw)
    }

    drawRef.current = scheduleDraw
    const observer = new ResizeObserver(scheduleDraw)
    observer.observe(canvas.parentElement ?? canvas)
    scheduleDraw()

    return () => {
      observer.disconnect()
      if (frame !== undefined) window.cancelAnimationFrame(frame)
      if (drawRef.current === scheduleDraw) drawRef.current = () => {}
    }
  }, [])

  const [downValue, downUnit] = parseTraffic(traffic?.down ?? 0)
  const [upValue, upUnit] = parseTraffic(traffic?.up ?? 0)

  return (
    <section className="card card-traffic" aria-label="Real-time traffic">
      <div className="traffic-header">
        <div className="traffic-title-group">
          <span className="traffic-title">实时流量</span>
          <span className="traffic-legend">下载 / 上传</span>
        </div>
      </div>
      <div className="traffic-rates">
        <span className="rate-badge rate-down">↓ {downValue} {downUnit}/s</span>
        <span className="rate-badge rate-up">↑ {upValue} {upUnit}/s</span>
      </div>
      <div className="traffic-canvas-wrap">
        <canvas ref={canvasRef} aria-label="Traffic history, last 60 samples" />
      </div>
    </section>
  )
}
