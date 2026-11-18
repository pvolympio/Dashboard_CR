import { useEffect, useMemo, useRef } from 'react'
import Graph from 'graphology'
import Sigma from 'sigma'
import { ehDocente, type Comunidades, type Rede, type RedeFiltrada } from './lib/rede'
import { AREA_CORES, CATEGORIA_CORES, PALETA } from './lib/rotulos'
import { useStore } from './store'

export interface CameraCtrl {
  zoomIn: () => void
  zoomOut: () => void
  reset: () => void
  focusNode: (idx: number) => void
}

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

export function NetworkView({
  rede,
  w,
  filtrada,
  com,
  onCameraReady,
}: {
  rede: Rede
  w: Float64Array
  filtrada: RedeFiltrada
  com: Comunidades
  onCameraReady?: (ctrl: CameraCtrl) => void
}) {
  const el = useRef<HTMLDivElement>(null)
  const sg = useRef<Sigma | null>(null)
  const grafoRef = useRef<Graph | null>(null)
  const coresRef = useRef<CoresTema>(leCores())
  const { sel, modoCor, modoTamanho, grupoRealcado } = useStore()

  const { wmax, gmaxVis, fmaxVis } = useMemo(() => {
    let wm = 0, gm = 0, fm = 0
    for (let k = 0; k < w.length; k++) if (filtrada.arestasVisiveis[k] && w[k] > wm) wm = w[k]
    for (let i = 0; i < rede.nos.length; i++) {
      if (!filtrada.nosVisiveis[i]) continue
      if (filtrada.grauVisivel[i] > gm) gm = filtrada.grauVisivel[i]
      if (filtrada.forcaVisivel[i] > fm) fm = filtrada.forcaVisivel[i]
    }
    return { wmax: wm || 1, gmaxVis: gm || 1, fmaxVis: fm || 1 }
  }, [w, filtrada, rede.nos.length])

  const viz = useMemo(() => {
    if (sel === null) return null
    const s = new Set<number>()
    for (let k = 0; k < rede.arestas.length; k++) {
      if (!filtrada.arestasVisiveis[k]) continue
      const a = rede.arestas[k]
      if (a[0] === sel) s.add(a[1])
      else if (a[1] === sel) s.add(a[0])
    }
    return s
  }, [sel, rede.arestas, filtrada.arestasVisiveis])

  const live = useRef({ w, wmax, gmaxVis, fmaxVis, filtrada, com, sel, viz, modoCor, modoTamanho, grupoRealcado })
  live.current = { w, wmax, gmaxVis, fmaxVis, filtrada, com, sel, viz, modoCor, modoTamanho, grupoRealcado }

  useEffect(() => {
    const N = rede.nos.length, E = rede.arestas.length
    const g = new Graph({ type: 'undirected' })

    const isDoc = new Uint8Array(N)
    const areaColors = new Array<string>(N)
    const catColors = new Array<string>(N)
    const labels = new Array<string>(N)

    for (let i = 0; i < N; i++) {
      const n = rede.nos[i], doc = ehDocente(rede, i)
      isDoc[i] = doc ? 1 : 0
      areaColors[i] = doc ? (AREA_CORES[rede.camadas[n[1]]] ?? AREA_CORES.Externo) : AREA_CORES.Externo
      catColors[i] = CATEGORIA_CORES[rede.categorias[n[2]]] ?? AREA_CORES.Externo
      labels[i] = doc ? n[0] : ''
      g.addNode(String(i), { x: n[3], y: n[4], size: 2, label: '' })
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
        const i = +k, L = live.current, C = coresRef.current
        if (!L.filtrada.nosVisiveis[i]) return { ...d, hidden: true }
        const doc = isDoc[i] === 1
        let color = AREA_CORES.Externo
        if (L.modoCor === 'categoria') color = catColors[i]
        else if (doc) color = L.modoCor === 'comunidade' ? PALETA[(L.com.particao.get(i) ?? 0) % PALETA.length] : areaColors[i]

        let label = labels[i]
        if (L.sel !== null && i !== L.sel && !L.viz?.has(i)) {
          color = C.dim
          label = ''
        } else if (L.sel === null && L.grupoRealcado !== null) {
          const emGrupo = doc && L.com.particao.get(i) === L.grupoRealcado
          if (!emGrupo) { color = C.dim; label = '' }
        }

        let size = doc ? 6 : 2.2
        if (L.modoTamanho === 'grau') {
          size = doc ? 5 + 11 * Math.sqrt(L.filtrada.grauVisivel[i] / L.gmaxVis) : 1.8
        } else if (L.modoTamanho === 'forca') {
          size = doc ? 5 + 11 * Math.sqrt(L.filtrada.forcaVisivel[i] / L.fmaxVis) : 1.8
        }

        return { ...d, hidden: false, color, label, forceLabel: i === L.sel, size }
      },
      edgeReducer: (k, d) => {
        const idx = +k, L = live.current, C = coresRef.current
        if (!L.filtrada.arestasVisiveis[idx]) return { ...d, hidden: true }
        const a = rede.arestas[idx]
        const size = 0.3 + 1.7 * (L.w[idx] / L.wmax)
        if (L.sel !== null) {
          return a[0] === L.sel || a[1] === L.sel
            ? { ...d, hidden: false, size: size + 0.6, color: C.sel }
            : { ...d, hidden: false, size, color: C.dim }
        }
        if (L.grupoRealcado !== null) {
          const g0 = L.com.particao.get(a[0]), g1 = L.com.particao.get(a[1])
          return g0 === L.grupoRealcado && g1 === L.grupoRealcado
            ? { ...d, hidden: false, size: size + 0.5, color: C.sel }
            : { ...d, hidden: false, size, color: C.dim }
        }
        return { ...d, hidden: false, size, color: C.edge }
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

    onCameraReady?.({
      zoomIn: () => s.getCamera().animatedZoom({ duration: 200 }),
      zoomOut: () => s.getCamera().animatedUnzoom({ duration: 200 }),
      reset: () => s.getCamera().animatedReset({ duration: 250 }),
      focusNode: (idx: number) => {
        const pos = s.getNodeDisplayData(String(idx))
        if (pos) s.getCamera().animate({ x: pos.x, y: pos.y, ratio: 0.25 }, { duration: 350 })
      },
    })

    return () => {
      mq.removeEventListener('change', onTema)
      ro.disconnect()
      grafoRef.current = null
      s.kill()
    }
  }, [rede])

  useEffect(() => { sg.current?.refresh() }, [w, wmax, gmaxVis, fmaxVis, filtrada, com, sel, modoCor, modoTamanho, grupoRealcado])
  return <div ref={el} className="canvas" aria-label="Grafo da rede de cooperação científica do IMC" />
}
