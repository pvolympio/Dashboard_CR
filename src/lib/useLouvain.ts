import { useEffect, useMemo, useRef, useState } from 'react'
import { comunidadesSubgrafo, preparaSubgrafoDocentes, type Comunidades, type Rede } from './rede'
import type { WorkerRequest, WorkerResponse } from '../workers/louvainHandler'

/** Executa Louvain em Web Worker com debounce de 120 ms e cancelamento de respostas obsoletas. */
export function useLouvain(rede: Rede | null, w: Float64Array, resolucao: number) {
  const [com, setCom] = useState<Comunidades | null>(null)
  const [calculando, setCalculando] = useState(false)
  const sub = useMemo(() => (rede ? preparaSubgrafoDocentes(rede) : null), [rede])

  const workerRef = useRef<Worker | null>(null)
  const reqIdRef = useRef(0)
  const inicializadoRef = useRef(false)

  useEffect(() => {
    if (!sub || typeof Worker === 'undefined') return
    const worker = new Worker(new URL('../workers/louvain.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker
    inicializadoRef.current = false
    const initMsg: WorkerRequest = { type: 'init', sub }
    worker.postMessage(initMsg)

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      if (e.data.id !== reqIdRef.current) return
      setCom(e.data.com)
      setCalculando(false)
    }

    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [sub])

  useEffect(() => {
    if (!sub || w.length === 0) return
    const worker = workerRef.current
    if (!worker) {
      setCom(comunidadesSubgrafo(sub, w, resolucao))
      return
    }
    const dispara = () => {
      setCalculando(true)
      const id = ++reqIdRef.current
      const copy = new Float64Array(w)
      const msg: WorkerRequest = { type: 'run', id, w: copy, resolucao }
      worker.postMessage(msg, [copy.buffer])
    }
    if (!inicializadoRef.current) {
      inicializadoRef.current = true
      dispara()
      return
    }
    const timer = window.setTimeout(dispara, 120)
    return () => window.clearTimeout(timer)
  }, [sub, w, resolucao])

  return { com, calculando }
}
