import type { Rede } from '../lib/rede'
import { proximoAfastamento, type Cenario } from '../lib/simulacao'

export type SimWorkerRequest =
  { type: 'init'; rede: Rede } | { type: 'next'; id: number; afastados: number[]; cenario: Cenario }

export type SimWorkerResponse = { id: number; prox: number | null }

let redeCache: Rede | null = null

self.addEventListener('message', (e: MessageEvent<SimWorkerRequest>) => {
  const msg = e.data
  if (msg.type === 'init') {
    redeCache = msg.rede
    return
  }
  if (msg.type === 'next' && redeCache) {
    const prox = proximoAfastamento(redeCache, new Set(msg.afastados), msg.cenario)
    const res: SimWorkerResponse = { id: msg.id, prox }
    self.postMessage(res)
  }
})
