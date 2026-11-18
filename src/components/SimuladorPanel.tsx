import { useEffect, useMemo, useRef } from 'react'
import type { Rede } from '../lib/rede'
import {
  exportaSimulacaoCSV,
  LIMIAR_ALCANCE,
  LIMIAR_SD,
  proximoAfastamento,
  serieSimulacao,
  type Cenario,
  type MetricasSimulacao,
  type ReferenciaAleatoria,
} from '../lib/simulacao'
import type { SimWorkerRequest, SimWorkerResponse } from '../workers/simulacao.worker'
import { useStore } from '../store'

const CENARIOS: { id: Cenario; label: string }[] = [
  { id: 'grau', label: 'Grau D–D' },
  { id: 'exclusivos', label: 'Externos exclusivos' },
  { id: 'intermediacao', label: 'Intermediação' },
]

const fmt4 = (n: number) => n.toFixed(4).replace('.', ',')
const fmt3 = (n: number) => n.toFixed(3).replace('.', ',')

function baixaTexto(nome: string, conteudo: string, tipo = 'text/csv;charset=utf-8;') {
  const blob = new Blob([conteudo], { type: tipo })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}

function GraficoCurvas({ serie, refAleat }: { serie: MetricasSimulacao[]; refAleat: ReferenciaAleatoria | null }) {
  const W = 420,
    H = 148,
    PL = 34,
    PR = 12,
    PT = 10,
    PB = 22
  const iw = W - PL - PR,
    ih = H - PT - PB
  const x = (k: number) => PL + (k / 48) * iw
  const y = (v: number) => PT + (1 - Math.max(0, Math.min(1, v))) * ih

  const linha = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')

  const banda = (low: number[], high: number[]) => {
    const top = high.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
    const bot = [...low]
      .reverse()
      .map((v, i) => `L${x(low.length - 1 - i).toFixed(1)},${y(v).toFixed(1)}`)
      .join(' ')
    return `${top} ${bot} Z`
  }

  const sdPath = serie.map((m, i) => `${i === 0 ? 'M' : 'L'}${x(m.k).toFixed(1)},${y(m.sd).toFixed(1)}`).join(' ')
  const alcPath = serie.map((m, i) => `${i === 0 ? 'M' : 'L'}${x(m.k).toFixed(1)},${y(m.alcance).toFixed(1)}`).join(' ')
  const ult = serie[serie.length - 1]

  return (
    <div className="sim-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Curvas de integração S_D e alcance externo por número de docentes afastados"
      >
        <line x1={PL} y1={PT} x2={PL} y2={PT + ih} className="ax" />
        <line x1={PL} y1={PT + ih} x2={PL + iw} y2={PT + ih} className="ax" />
        {[0, 0.5, 1].map((t) => (
          <text key={t} x={PL - 5} y={y(t) + 3} textAnchor="end" className="ax-lbl">
            {t.toFixed(1).replace('.', ',')}
          </text>
        ))}
        {[0, 12, 24, 36, 48].map((k) => (
          <text key={k} x={x(k)} y={H - 5} textAnchor="middle" className="ax-lbl">
            {k}
          </text>
        ))}

        {/* Limiares de função preservada */}
        <line x1={PL} y1={y(LIMIAR_SD)} x2={PL + iw} y2={y(LIMIAR_SD)} className="lim-sd" />
        <line x1={PL} y1={y(LIMIAR_ALCANCE)} x2={PL + iw} y2={y(LIMIAR_ALCANCE)} className="lim-alc" />

        {/* Faixas de referência aleatória (IC 95% e mediana) */}
        {refAleat && (
          <>
            <path d={banda(refAleat.sd.p025, refAleat.sd.p975)} className="band-sd" />
            <path d={banda(refAleat.alcance.p025, refAleat.alcance.p975)} className="band-alc" />
            <path d={linha(refAleat.sd.p50)} className="med-sd" />
            <path d={linha(refAleat.alcance.p50)} className="med-alc" />
          </>
        )}

        {/* Curvas da simulação atual */}
        <path d={sdPath} className="cur-sd" />
        <path d={alcPath} className="cur-alc" />
        <circle cx={x(ult.k)} cy={y(ult.sd)} r="3.5" className="dot-sd" />
        <circle cx={x(ult.k)} cy={y(ult.alcance)} r="3.5" className="dot-alc" />
      </svg>
      <div className="sim-leg">
        <span>
          <i className="sw-sd" />
          S_D (limiar 0,427)
        </span>
        <span>
          <i className="sw-alc" />
          Alcance (limiar 0,50)
        </span>
        <span>
          <i className="sw-band" />
          Aleatório IC 95% / med.
        </span>
      </div>
    </div>
  )
}

export function SimuladorPanel({
  rede,
  w,
  refAleat,
  mobOpen = false,
}: {
  rede: Rede
  w: Float64Array
  refAleat: ReferenciaAleatoria | null
  mobOpen?: boolean
}) {
  const {
    simAberto,
    afastados,
    cenarioAtivo,
    animando,
    toggleSim,
    afastaDocente,
    reintegraDocente,
    limpaSimulacao,
    setCenarioAtivo,
    setAnimando,
  } = useStore()

  const workerRef = useRef<Worker | null>(null)
  const simReqRef = useRef(0)

  useEffect(() => {
    if (typeof Worker === 'undefined') return
    const worker = new Worker(new URL('../workers/simulacao.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker
    const initMsg: SimWorkerRequest = { type: 'init', rede }
    worker.postMessage(initMsg)
    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [rede])

  useEffect(() => {
    if (!animando || !cenarioAtivo) {
      simReqRef.current++
      return
    }
    const worker = workerRef.current
    if (!worker) {
      const timer = window.setInterval(() => {
        const atual = useStore.getState().afastados
        const prox = proximoAfastamento(rede, new Set(atual), cenarioAtivo)
        if (prox === null) setAnimando(false)
        else afastaDocente(prox)
      }, 260)
      return () => window.clearInterval(timer)
    }

    let cancelado = false
    let timer: number | null = null
    const agendaPasso = () => {
      if (cancelado) return
      const id = ++simReqRef.current
      const atual = useStore.getState().afastados
      const req: SimWorkerRequest = { type: 'next', id, afastados: atual, cenario: cenarioAtivo }
      worker.postMessage(req)
    }

    worker.onmessage = (e: MessageEvent<SimWorkerResponse>) => {
      if (cancelado || e.data.id !== simReqRef.current) return
      if (e.data.prox === null) {
        setAnimando(false)
        return
      }
      afastaDocente(e.data.prox)
      timer = window.setTimeout(agendaPasso, 260)
    }

    agendaPasso()
    return () => {
      cancelado = true
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [animando, cenarioAtivo, rede, afastaDocente, setAnimando])

  const serie = useMemo(() => serieSimulacao(rede, w, afastados), [rede, w, afastados])
  const atual = serie[serie.length - 1]
  const k = atual.k
  const medSd = refAleat?.sd.p50[k]
  const medAlc = refAleat?.alcance.p50[k]

  const iniciaCenario = (c: Cenario) => {
    setCenarioAtivo(c)
    setAnimando(true)
  }

  return (
    <section
      className={`card sim ${simAberto ? 'open' : ''}`}
      data-mob-open={mobOpen ? 'true' : undefined}
      aria-label="Simulador de afastamento"
    >
      <div className="sim-bar">
        <button type="button" className="sim-toggle" aria-expanded={simAberto} onClick={() => toggleSim()}>
          <span className="kick">Simulador de afastamento</span>
          {afastados.length > 0 && (
            <span className="badge">
              {afastados.length} afastado{afastados.length > 1 ? 's' : ''}
            </span>
          )}
          <span className="chev">{simAberto ? '▾' : '▴'}</span>
        </button>

        {simAberto && (
          <div className="sim-actions">
            {CENARIOS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`btn-sm ${cenarioAtivo === c.id && animando ? 'on' : ''}`}
                onClick={() => iniciaCenario(c.id)}
              >
                {c.label}
              </button>
            ))}
            {animando && (
              <button type="button" className="btn-sm" onClick={() => setAnimando(false)}>
                Pausar
              </button>
            )}
            <button
              type="button"
              className="btn-sm"
              onClick={limpaSimulacao}
              disabled={afastados.length === 0 && !animando}
            >
              Limpar
            </button>
            <button
              type="button"
              className="btn-sm"
              onClick={() => baixaTexto('simulacao_afastamento.csv', exportaSimulacaoCSV(serie))}
            >
              Exportar CSV
            </button>
          </div>
        )}
      </div>

      {simAberto && (
        <div className="sim-body">
          <div className="sim-left">
            <div className="sim-metrics" aria-live="polite">
              <div className={`met ${atual.sd < LIMIAR_SD ? 'warn' : ''}`}>
                <small>Integração S_D</small>
                <b>{fmt4(atual.sd)}</b>
                {medSd !== undefined && <span className="med-ref">aleat. med.: {fmt3(medSd)}</span>}
                {atual.sd < LIMIAR_SD && <span className="warn-tag">função não preservada</span>}
              </div>
              <div className={`met ${atual.alcance < LIMIAR_ALCANCE ? 'warn' : ''}`}>
                <small>Alcance externo</small>
                <b>{fmt4(atual.alcance)}</b>
                {medAlc !== undefined && <span className="med-ref">aleat. med.: {fmt3(medAlc)}</span>}
                {atual.alcance < LIMIAR_ALCANCE && <span className="warn-tag">função não preservada</span>}
              </div>
              <div className="met">
                <small>Vínculos entre áreas</small>
                <b>{atual.vinculos}</b>
              </div>
              <div className="met">
                <small>Peso retido</small>
                <b>{fmt4(atual.peso)}</b>
              </div>
            </div>

            <div className="sim-seq">
              <div className="kick">Docentes afastados ({afastados.length}) — clique para reintegrar</div>
              <div className="chips">
                {afastados.length === 0 ? (
                  <span className="muted-txt">
                    Nenhum docente afastado. Selecione um docente no grafo ou inicie um cenário.
                  </span>
                ) : (
                  afastados.map((idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="chip-af"
                      onClick={() => reintegraDocente(idx)}
                      aria-label={`Reintegrar ${rede.nos[idx][0]}`}
                    >
                      {rede.nos[idx][0]} ×
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <GraficoCurvas serie={serie} refAleat={refAleat} />
        </div>
      )}
    </section>
  )
}
