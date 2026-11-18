import { useEffect, useMemo, useRef } from 'react'
import Graph from 'graphology'
import Sigma from 'sigma'
import { ehDocente, layoutEgocentrico, type Comunidades, type Rede, type RedeFiltrada } from './lib/rede'
import { AREA_CORES, CATEGORIA_CORES, PALETA } from './lib/rotulos'
import { useStore } from './store'

export interface CameraCtrl {
  zoomIn: () => void
  zoomOut: () => void
  reset: () => void
  focusNode: (idx: number) => void
  exportPNG: (legenda: { cor: string; label: string }[]) => void
}

interface CoresTema {
  ink: string
  edge: string
  edgeExt: string
  extDot: string
  sel: string
  dim: string
}
const leCores = (): CoresTema => {
  const st = getComputedStyle(document.documentElement)
  return {
    ink: st.getPropertyValue('--ink').trim(),
    edge: st.getPropertyValue('--edge').trim(),
    edgeExt: st.getPropertyValue('--edge-ext').trim(),
    extDot: st.getPropertyValue('--ext-dot').trim(),
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
  const { sel, modoCor, modoTamanho, grupoRealcado, visao } = useStore()

  const { wmax, gmaxVis, fmaxVis } = useMemo(() => {
    let wm = 0,
      gm = 0,
      fm = 0
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
  const onCameraReadyRef = useRef(onCameraReady)
  useEffect(() => {
    onCameraReadyRef.current = onCameraReady
  }, [onCameraReady])

  useEffect(() => {
    const N = rede.nos.length,
      E = rede.arestas.length
    const g = new Graph({ type: 'undirected' })

    const isDoc = new Uint8Array(N)
    const isEdgeDD = new Uint8Array(E)
    const areaColors = new Array<string>(N)
    const catColors = new Array<string>(N)
    const labels = new Array<string>(N)

    for (let i = 0; i < N; i++) {
      const n = rede.nos[i],
        doc = ehDocente(rede, i)
      isDoc[i] = doc ? 1 : 0
      areaColors[i] = doc ? (AREA_CORES[rede.camadas[n[1]]] ?? AREA_CORES.Externo) : AREA_CORES.Externo
      catColors[i] = CATEGORIA_CORES[rede.categorias[n[2]]] ?? AREA_CORES.Externo
      labels[i] = doc ? n[0] : ''
      g.addNode(String(i), { x: n[3], y: n[4], size: 2, label: '', zIndex: doc ? 2 : 0 })
    }
    for (let k = 0; k < E; k++) {
      const a = rede.arestas[k]
      if (isDoc[a[0]] && isDoc[a[1]]) isEdgeDD[k] = 1
      g.addEdgeWithKey(String(k), String(a[0]), String(a[1]), { size: 0.5 })
    }
    grafoRef.current = g
    coresRef.current = leCores()

    let hoverId: number | null = null
    let hoverViz: Set<number> | null = null

    const s = new Sigma(g, el.current!, {
      allowInvalidContainer: true,
      renderEdgeLabels: false,
      zIndex: true,
      labelFont: 'JetBrains Mono, monospace',
      labelWeight: '500',
      labelSize: 11,
      labelDensity: 0.45,
      labelGridCellSize: 90,
      labelRenderedSizeThreshold: 5,
      labelColor: { color: coresRef.current.ink },
      minCameraRatio: 0.03,
      maxCameraRatio: 4,
      nodeReducer: (k, d) => {
        const i = +k,
          L = live.current,
          C = coresRef.current
        if (!L.filtrada.nosVisiveis[i]) return { ...d, hidden: true }
        const doc = isDoc[i] === 1
        const foco = L.sel ?? hoverId
        const focoViz = L.sel !== null ? L.viz : hoverViz

        let color = C.extDot
        if (L.modoCor === 'categoria') color = doc || foco !== null ? catColors[i] : C.extDot
        else if (doc)
          color = L.modoCor === 'comunidade' ? PALETA[(L.com.particao.get(i) ?? 0) % PALETA.length] : areaColors[i]

        let label = labels[i]
        let zIndex = doc ? 2 : 0

        if (foco !== null) {
          if (i === foco || focoViz?.has(i)) {
            if (!doc) {
              color = L.modoCor === 'categoria' ? catColors[i] : AREA_CORES.Externo
              label = rede.nos[i][0]
            }
            zIndex = i === foco ? 4 : 3
          } else {
            color = C.dim
            label = ''
            zIndex = 0
          }
        } else if (L.grupoRealcado !== null) {
          const emGrupo = doc && L.com.particao.get(i) === L.grupoRealcado
          if (!emGrupo) {
            color = C.dim
            label = ''
            zIndex = 0
          } else {
            zIndex = 3
          }
        }

        let size = doc ? 6 : 1.35
        if (L.modoTamanho === 'grau') {
          size = doc ? 5 + 10 * Math.sqrt(L.filtrada.grauVisivel[i] / L.gmaxVis) : 1.35
        } else if (L.modoTamanho === 'forca') {
          size = doc ? 5 + 10 * Math.sqrt(L.filtrada.forcaVisivel[i] / L.fmaxVis) : 1.35
        }
        if (foco !== null && !doc && focoViz?.has(i)) size = 3.2
        if (i === foco) size = Math.max(size, 9)

        return { ...d, hidden: false, color, label, forceLabel: i === foco, size, zIndex }
      },
      edgeReducer: (k, d) => {
        const idx = +k,
          L = live.current,
          C = coresRef.current
        if (!L.filtrada.arestasVisiveis[idx]) return { ...d, hidden: true }
        const a = rede.arestas[idx]
        const dd = isEdgeDD[idx] === 1
        const foco = L.sel ?? hoverId
        const ratio = L.w[idx] / L.wmax
        const size = dd ? 0.5 + 1.8 * ratio : 0.25 + 0.9 * ratio

        if (foco !== null) {
          if (a[0] === foco || a[1] === foco) {
            return { ...d, hidden: false, size: size + 0.8, color: C.sel }
          }
          return { ...d, hidden: true }
        }
        if (L.grupoRealcado !== null) {
          const g0 = L.com.particao.get(a[0]),
            g1 = L.com.particao.get(a[1])
          return g0 === L.grupoRealcado && g1 === L.grupoRealcado
            ? { ...d, hidden: false, size: size + 0.6, color: C.sel }
            : { ...d, hidden: false, size, color: C.dim }
        }
        return { ...d, hidden: false, size, color: dd ? C.edge : C.edgeExt }
      },
    })

    s.on('enterNode', ({ node }) => {
      const id = +node
      hoverId = id
      const vizSet = new Set<number>()
      const L = live.current
      for (let k = 0; k < E; k++) {
        if (!L.filtrada.arestasVisiveis[k]) continue
        const a = rede.arestas[k]
        if (a[0] === id) vizSet.add(a[1])
        else if (a[1] === id) vizSet.add(a[0])
      }
      hoverViz = vizSet
      if (el.current) el.current.style.cursor = 'pointer'
      s.refresh()
    })
    s.on('leaveNode', () => {
      hoverId = null
      hoverViz = null
      if (el.current) el.current.style.cursor = 'default'
      s.refresh()
    })
    s.on('clickNode', ({ node }) => useStore.getState().seleciona(+node))
    s.on('clickStage', () => useStore.getState().seleciona(null))

    const ro = new ResizeObserver(() => {
      s.resize()
      s.refresh()
    })
    ro.observe(el.current!)

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onTema = () => {
      coresRef.current = leCores()
      s.setSetting('labelColor', { color: coresRef.current.ink })
      s.refresh()
    }
    mq.addEventListener('change', onTema)
    sg.current = s

    onCameraReadyRef.current?.({
      zoomIn: () => s.getCamera().animatedZoom({ duration: 200 }),
      zoomOut: () => s.getCamera().animatedUnzoom({ duration: 200 }),
      reset: () => s.getCamera().animatedReset({ duration: 250 }),
      focusNode: (idx: number) => {
        const pos = s.getNodeDisplayData(String(idx))
        if (pos) s.getCamera().animate({ x: pos.x, y: pos.y, ratio: 0.25 }, { duration: 350 })
      },
      exportPNG: (legenda: { cor: string; label: string }[]) => {
        const container = el.current
        if (!container) return
        const canvases = container.querySelectorAll('canvas')
        if (canvases.length === 0) return
        const w = container.clientWidth || 1200,
          h = container.clientHeight || 800
        const out = document.createElement('canvas')
        out.width = w
        out.height = h
        const ctx = out.getContext('2d')
        if (!ctx) return
        const st = getComputedStyle(document.documentElement)
        ctx.fillStyle = st.getPropertyValue('--bg').trim() || '#f0f6b9'
        ctx.fillRect(0, 0, w, h)
        canvases.forEach((c) => {
          try {
            ctx.drawImage(c, 0, 0, w, h)
          } catch {
            /* ignore empty canvas */
          }
        })
        // Legenda no canto inferior esquerdo
        const pad = 12,
          lh = 18
        const boxH = pad * 2 + legenda.length * lh + 20
        const boxW = 240
        ctx.fillStyle = st.getPropertyValue('--card').trim() || 'rgba(255,255,255,0.85)'
        ctx.fillRect(16, h - boxH - 16, boxW, boxH)
        ctx.strokeStyle = st.getPropertyValue('--line').trim() || 'rgba(18,55,61,0.2)'
        ctx.strokeRect(16, h - boxH - 16, boxW, boxH)
        ctx.font = '12px "Instrument Sans", sans-serif'
        const ink = st.getPropertyValue('--ink').trim() || '#12373d'
        legenda.forEach((item, idx) => {
          const yy = h - boxH - 16 + pad + idx * lh + 10
          ctx.fillStyle = item.cor
          ctx.beginPath()
          ctx.arc(28, yy - 4, 4.5, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = ink
          ctx.fillText(item.label, 40, yy)
        })
        ctx.font = '10px "JetBrains Mono", monospace'
        ctx.fillStyle = st.getPropertyValue('--muted').trim() || '#4f6f73'
        ctx.fillText('Evidência relacional; não mede mérito.', 24, h - 24)
        const a = document.createElement('a')
        a.href = out.toDataURL('image/png')
        a.download = 'rede_imc.png'
        a.click()
      },
    })

    return () => {
      mq.removeEventListener('change', onTema)
      ro.disconnect()
      grafoRef.current = null
      s.kill()
    }
  }, [rede])

  // Recalcula o layout apenas na visão egocêntrica e restaura as coordenadas originais ao sair dela
  useEffect(() => {
    const g = grafoRef.current,
      s = sg.current
    if (!g || !s) return
    if (visao === 'ego' && sel !== null) {
      const pos = layoutEgocentrico(rede, filtrada.nosVisiveis, sel)
      pos.forEach(([x, y], idx) => {
        const k = String(idx)
        if (g.hasNode(k)) {
          g.setNodeAttribute(k, 'x', x)
          g.setNodeAttribute(k, 'y', y)
        }
      })
      s.getCamera().animatedReset({ duration: 200 })
    } else {
      for (let i = 0; i < rede.nos.length; i++) {
        const k = String(i),
          n = rede.nos[i]
        if (g.hasNode(k)) {
          g.setNodeAttribute(k, 'x', n[3])
          g.setNodeAttribute(k, 'y', n[4])
        }
      }
    }
    s.refresh()
  }, [visao, sel, rede, filtrada.nosVisiveis])

  useEffect(() => {
    live.current = { w, wmax, gmaxVis, fmaxVis, filtrada, com, sel, viz, modoCor, modoTamanho, grupoRealcado }
    sg.current?.refresh()
  }, [w, wmax, gmaxVis, fmaxVis, filtrada, com, sel, viz, modoCor, modoTamanho, grupoRealcado])
  return <div ref={el} className="canvas" aria-label="Grafo da rede de cooperação científica do IMC" />
}
