import { useEffect, useMemo, useRef } from 'react'
import Graph from 'graphology'
import Sigma from 'sigma'
import { ehDocente, type Comunidades, type Rede } from './lib/rede'
import { useStore } from './store'

export const PALETA = ['#3ea3af', '#ff1d44', '#12373d', '#c5cf7a', '#8fcdd4', '#e07a8b', '#6b8e3a', '#f0a35e', '#7f6fb3', '#2a6f7a', '#d9b13b', '#a6a6a6']
const AREA: Record<string, string> = { 'Matemática': '#3ea3af', 'Computação': '#ff1d44', Externo: '#9fb4b1' }

interface CoresTema { ink: string; edge: string; sel: string; dim: string }
const leCores = (): CoresTema => {
  const st = getComputedStyle(document.documentElement)
  return {
    ink: st.getPropertyValue('--ink').trim(),
    edge: st.getPropertyValue('--edge').trim(),
    sel: st.getPropertyValue('--sel').trim(),
    dim: st.getPropertyValue('--dim').trim(),
  }
}

export function NetworkView({ rede, w, com }: { rede: Rede; w: Float64Array; com: Comunidades }) {
  const el = useRef<HTMLDivElement>(null)
  const sg = useRef<Sigma | null>(null)
  const grafoRef = useRef<Graph | null>(null)
  const coresRef = useRef<CoresTema>(leCores())
  const { sel, modo } = useStore()

  const wmax = useMemo(() => {
    let m = 0
    for (let i = 0; i < w.length; i++) if (w[i] > m) m = w[i]
    return m || 1
  }, [w])

  const viz = useMemo(() => {
    const g = grafoRef.current
    if (sel === null || !g) return null
    return new Set(g.neighbors(String(sel)).map(Number))
  }, [sel, rede])

  const live = useRef({ w, wmax, com, sel, viz, modo })
  live.current = { w, wmax, com, sel, viz, modo }

  useEffect(() => {
    const N = rede.nos.length, E = rede.arestas.length
    const g = new Graph({ type: 'undirected' })
    const grau = new Float32Array(N)
    for (let k = 0; k < E; k++) { const a = rede.arestas[k]; grau[a[0]]++; grau[a[1]]++ }
    let gmax = 0
    for (let i = 0; i < N; i++) if (grau[i] > gmax) gmax = grau[i]
    if (gmax === 0) gmax = 1

    const isDoc = new Uint8Array(N)
    const nodeSizes = new Float32Array(N)
    const areaColors = new Array<string>(N)
    const labels = new Array<string>(N)

    for (let i = 0; i < N; i++) {
      const n = rede.nos[i], doc = ehDocente(rede, i)
      isDoc[i] = doc ? 1 : 0
      nodeSizes[i] = doc ? 5 + 11 * Math.sqrt(grau[i] / gmax) : 1.8
      areaColors[i] = doc ? (AREA[rede.camadas[n[1]]] ?? AREA.Externo) : AREA.Externo
      labels[i] = doc ? n[0] : ''
      g.addNode(String(i), { x: n[3], y: n[4], size: nodeSizes[i], label: '' })
    }
    for (let k = 0; k < E; k++) {
      const a = rede.arestas[k]
      g.addEdgeWithKey(String(k), String(a[0]), String(a[1]), { size: 0.5 })
    }
    grafoRef.current = g
    coresRef.current = leCores()

    const s = new Sigma(g, el.current!, {
      allowInvalidContainer: true,
      renderEdgeLabels: false,
      labelFont: 'JetBrains Mono, monospace',
      labelSize: 11,
      labelColor: { color: coresRef.current.ink },
      minCameraRatio: 0.03,
      maxCameraRatio: 4,
      nodeReducer: (k, d) => {
        const i = +k, L = live.current, C = coresRef.current, doc = isDoc[i] === 1
        let color = doc
          ? (L.modo === 'comunidade' ? PALETA[(L.com.particao.get(i) ?? 0) % PALETA.length] : areaColors[i])
          : AREA.Externo
        let label = labels[i]
        if (L.sel !== null && i !== L.sel && !L.viz?.has(i)) { color = C.dim; label = '' }
        return { ...d, color, label, forceLabel: i === L.sel, size: nodeSizes[i] }
      },
      edgeReducer: (k, d) => {
        const idx = +k, a = rede.arestas[idx], L = live.current, C = coresRef.current
        const size = 0.3 + 1.7 * (L.w[idx] / L.wmax)
        if (L.sel === null) return { ...d, size, color: C.edge }
        return a[0] === L.sel || a[1] === L.sel ? { ...d, size: size + 0.6, color: C.sel } : { ...d, size, color: C.dim }
      },
    })

    s.on('clickNode', ({ node }) => useStore.getState().seleciona(+node))
    s.on('clickStage', () => useStore.getState().seleciona(null))

    const ro = new ResizeObserver(() => { s.resize(); s.refresh() })
    ro.observe(el.current!)

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onTema = () => {
      coresRef.current = leCores()
      s.setSetting('labelColor', { color: coresRef.current.ink })
      s.refresh()
    }
    mq.addEventListener('change', onTema)
    sg.current = s

    return () => {
      mq.removeEventListener('change', onTema)
      ro.disconnect()
      grafoRef.current = null
      s.kill()
    }
  }, [rede])

  useEffect(() => { sg.current?.refresh() }, [w, wmax, com, sel, modo])
  return <div ref={el} className="canvas" />
}
