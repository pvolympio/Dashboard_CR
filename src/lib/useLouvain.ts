import { useEffect, useMemo, useRef, useState } from 'react'
import { comunidadesSubgrafo, preparaSubgrafoDocentes, type Comunidades, type Rede } from './rede'
import type { WorkerRequest, WorkerResponse } from '../workers/louvain.worker'

/** Executa Louvain em Web Worker com fila de tamanho 1 (single-flight + coalescing), sem travar a UI. */
export function useLouvain(rede: Rede | null, w: Float64Array, resolucao: number) {
  const [com, setCom] = useState<Comunidades | null>(null)
  const [calculando, setCalculando] = useState(false)
  const sub = useMemo(() => (rede ? preparaSubgrafoDocentes(rede) : null), [rede])

  const workerRef = useRef<Worker | null>(null)
  const inFlightRef = useRef(false)
  const pendingRef = useRef<{ w: Float64Array; resolucao: number } | null>(null)
  const reqIdRef = useRef(0)

  const dispatch = (worker: Worker, weights: Float64Array, res: number) => {
    inFlightRef.current = true
    setCalculando(true)
    const id = ++reqIdRef.current
    const copy = new Float64Array(weights)
    const msg: WorkerRequest = { type: 'run', id, w: copy, resolucao: res }
    worker.postMessage(msg, [copy.buffer])
  }

  useEffect(() => {
    if (!sub || typeof Worker === 'undefined') return
    const worker = new Worker(new URL('../workers/louvain.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker
    inFlightRef.current = false
    pendingRef.current = null
    const initMsg: WorkerRequest = { type: 'init', sub }
    worker.postMessage(initMsg)

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      if (e.data.id === reqIdRef.current) setCom(e.data.com)
      const next = pendingRef.current
      if (next) {
        pendingRef.current = null
        dispatch(worker, next.w, next.resolucao)
      } else {
        inFlightRef.current = false
        setCalculando(false)
      }
    }

    return () => {
      worker.terminate()
      workerRef.current = null
      inFlightRef.current = false
      pendingRef.current = null
    }
  }, [sub])

  useEffect(() => {
    if (!sub || w.length === 0) return
    const worker = workerRef.current
    if (!worker) {
      setCom(comunidadesSubgrafo(sub, w, resolucao))
      return
    }
    if (inFlightRef.current) {
      pendingRef.current = { w, resolucao }
    } else {
      dispatch(worker, w, resolucao)
    }
  }, [sub, w, resolucao])

  return { com, calculando }
}
